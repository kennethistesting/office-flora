import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Missing authorization header')

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const publishableKeys = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') || '{}')
    const secretKeys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}')
    const publishableKey = publishableKeys.default || Deno.env.get('SUPABASE_ANON_KEY')!
    const secretKey = secretKeys.default || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const openaiKey = Deno.env.get('OPENAI_API_KEY')!

    const userClient = createClient(supabaseUrl, publishableKey, { global: { headers: { Authorization: authHeader } } })
    const admin = createClient(supabaseUrl, secretKey)
    const { data: { user }, error: userError } = await userClient.auth.getUser()
    if (userError || !user) throw new Error('Not signed in')

    const { storagePath, capturedAt, notes } = await req.json()
    if (!storagePath || !storagePath.startsWith(`${user.id}/`)) throw new Error('Invalid storage path')

    const { data: photoBlob, error: downloadError } = await admin.storage.from('flora-photos').download(storagePath)
    if (downloadError) throw downloadError
    const bytes = new Uint8Array(await photoBlob.arrayBuffer())
    const base64 = toBase64(bytes)
    const mime = photoBlob.type || 'image/jpeg'

    const analysisPrompt = `You are the curator for Office Flora, a tasteful botanical photo archive. Analyze the image conservatively. Do not pretend cultivar-level certainty from a decorative flower photo. Return ONLY valid JSON with this exact shape:\n{
      "flower_name":"best common display name or Unknown flower",
      "common_name":"common name",
      "scientific_name":"genus/species if reasonably confident, otherwise genus or empty string",
      "confidence":0,
      "arrangement_style":"short design style",
      "design_notes":"2-4 sentences about composition, negative space, color, texture, vessel and form",
      "dominant_colors":["#hex","#hex","#hex","#hex","#hex"],
      "tags":["tag"],
      "identification_candidates":[{"name":"candidate","confidence":0,"why":"brief visual evidence"}],
      "needs_review":false
    }
    Confidence is 0-100. Set needs_review true below 70 confidence. Keep tags lowercase. The user's optional note is: ${notes || '(none)'}`

    const aiRes = await fetch('https://api.openai.com/v1/responses', {
      method:'POST',
      headers:{'Authorization':`Bearer ${openaiKey}`,'Content-Type':'application/json'},
      body:JSON.stringify({
        model:'gpt-5-mini',
        input:[{role:'user',content:[
          {type:'input_text',text:analysisPrompt},
          {type:'input_image',image_url:`data:${mime};base64,${base64}`}
        ]}]
      })
    })
    if (!aiRes.ok) throw new Error(`OpenAI analysis failed: ${await aiRes.text()}`)
    const aiJson = await aiRes.json()
    const analysis = parseJson(aiJson.output_text)

    const drawingPrompt = `Create a refined botanical field-study illustration of the flower arrangement in the supplied reference photo. Preserve the recognizable flower species, bloom count, stem direction, leaves, vessel silhouette and overall asymmetry. Cream paper background, delicate graphite-and-watercolor botanical rendering, restrained natural colors, subtle hand-drawn annotation lines without readable text, museum archive aesthetic. No border, no branding, no people.`

    const imageRes = await fetch('https://api.openai.com/v1/responses', {
      method:'POST',
      headers:{'Authorization':`Bearer ${openaiKey}`,'Content-Type':'application/json'},
      body:JSON.stringify({
        model:'gpt-5',
        input:[{role:'user',content:[
          {type:'input_text',text:drawingPrompt},
          {type:'input_image',image_url:`data:${mime};base64,${base64}`,detail:'high'}
        ]}],
        tools:[{
          type:'image_generation',
          action:'edit',
          size:'1024x1536',
          quality:'medium',
          background:'opaque',
          input_fidelity:'high'
        }],
        tool_choice:{type:'image_generation'}
      })
    })

    let generated: string | null = null
    if (imageRes.ok) {
      const imgJson = await imageRes.json()
      const imageCall = (imgJson.output || []).find((item:any) => item.type === 'image_generation_call')
      generated = imageCall?.result || null
    }

    let illustrationPath = null
    let illustrationUrl = null
    if (generated) {
        const generatedBytes = Uint8Array.from(atob(generated), c => c.charCodeAt(0))
        illustrationPath = `${user.id}/${crypto.randomUUID()}.png`
        const { error: illUploadError } = await admin.storage.from('flora-illustrations').upload(illustrationPath, generatedBytes, { contentType:'image/png' })
        if (illUploadError) throw illUploadError
    }

    const photoSigned = await admin.storage.from('flora-photos').createSignedUrl(storagePath, 60 * 60 * 24 * 365)
    if (illustrationPath) {
      const signed = await admin.storage.from('flora-illustrations').createSignedUrl(illustrationPath, 60 * 60 * 24 * 365)
      illustrationUrl = signed.data?.signedUrl || null
    }

    const row = {
      user_id:user.id,
      captured_at:capturedAt || new Date().toISOString().slice(0,10),
      photo_path:storagePath,
      photo_url:photoSigned.data?.signedUrl,
      illustration_path:illustrationPath,
      illustration_url:illustrationUrl,
      flower_name:analysis.flower_name,
      common_name:analysis.common_name,
      scientific_name:analysis.scientific_name,
      confidence:clampNumber(analysis.confidence,0,100),
      arrangement_style:analysis.arrangement_style,
      notes:notes || analysis.design_notes,
      design_notes:analysis.design_notes,
      dominant_colors:Array.isArray(analysis.dominant_colors)?analysis.dominant_colors.slice(0,6):[],
      tags:Array.isArray(analysis.tags)?analysis.tags.slice(0,12):[],
      identification_candidates:Array.isArray(analysis.identification_candidates)?analysis.identification_candidates.slice(0,4):[],
      needs_review:Boolean(analysis.needs_review),
    }

    const { data: entry, error: insertError } = await admin.from('flora_entries').insert(row).select().single()
    if (insertError) throw insertError

    return Response.json({ entry }, { headers: { ...corsHeaders, 'Content-Type':'application/json' } })
  } catch (error) {
    return Response.json({ error: error.message || 'Unknown error' }, { status:400, headers: { ...corsHeaders, 'Content-Type':'application/json' } })
  }
})

function parseJson(text:string) {
  if (!text) throw new Error('No analysis returned')
  const cleaned = text.trim().replace(/^```json\s*/i,'').replace(/```$/,'').trim()
  return JSON.parse(cleaned)
}
function clampNumber(v:unknown,min:number,max:number){const n=Number(v);return Number.isFinite(n)?Math.min(max,Math.max(min,Math.round(n))):0}
function toBase64(bytes:Uint8Array){let binary='';const chunk=0x8000;for(let i=0;i<bytes.length;i+=chunk){binary+=String.fromCharCode(...bytes.subarray(i,Math.min(i+chunk,bytes.length)))}return btoa(binary)}
