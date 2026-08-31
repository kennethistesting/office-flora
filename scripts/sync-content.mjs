import { createClient } from '@supabase/supabase-js'
import { readdir, readFile } from 'node:fs/promises'
import { basename, dirname, extname, join, resolve } from 'node:path'
import process from 'node:process'

const supabaseUrl = process.env.SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const contentRoot = resolve('content/entries')
const folders = (await readdir(contentRoot, { withFileTypes: true })).filter(d => d.isDirectory())

for (const folder of folders) {
  const dir = join(contentRoot, folder.name)
  const manifestPath = join(dir, 'entry.json')
  let entry
  try {
    entry = JSON.parse(await readFile(manifestPath, 'utf8'))
  } catch {
    console.warn(`Skipping ${folder.name}: no valid entry.json`)
    continue
  }

  if (!entry.slug || !entry.photo || !entry.captured_at) {
    throw new Error(`${folder.name}: slug, photo, and captured_at are required`)
  }

  const photoPath = await uploadAsset('flora-photos', dir, entry.photo, `${entry.slug}/photo${extname(entry.photo).toLowerCase()}`)
  const photoUrl = supabase.storage.from('flora-photos').getPublicUrl(photoPath).data.publicUrl

  let illustrationPath = null
  let illustrationUrl = null
  if (entry.illustration) {
    illustrationPath = await uploadAsset('flora-illustrations', dir, entry.illustration, `${entry.slug}/illustration${extname(entry.illustration).toLowerCase()}`)
    illustrationUrl = supabase.storage.from('flora-illustrations').getPublicUrl(illustrationPath).data.publicUrl
  }

  const payload = {
    slug: entry.slug,
    captured_at: entry.captured_at,
    status: entry.status === 'published' ? 'published' : 'draft',
    published_at: entry.status === 'published' ? (entry.published_at || new Date().toISOString()) : null,
    photo_path: photoPath,
    photo_url: photoUrl,
    illustration_path: illustrationPath,
    illustration_url: illustrationUrl,
    flower_name: entry.flower_name || null,
    common_name: entry.common_name || null,
    scientific_name: entry.scientific_name || null,
    confidence: Number.isFinite(entry.confidence) ? entry.confidence : null,
    arrangement_style: entry.arrangement_style || null,
    notes: entry.notes || null,
    design_notes: entry.design_notes || null,
    dominant_colors: Array.isArray(entry.dominant_colors) ? entry.dominant_colors : [],
    tags: Array.isArray(entry.tags) ? entry.tags : [],
    identification_candidates: Array.isArray(entry.identification_candidates) ? entry.identification_candidates : [],
    needs_review: Boolean(entry.needs_review),
  }

  const { error } = await supabase.from('flora_entries').upsert(payload, { onConflict: 'slug' })
  if (error) throw error
  console.log(`Published ${entry.slug}`)
}

async function uploadAsset(bucket, dir, filename, destination) {
  const bytes = await readFile(join(dir, filename))
  const contentType = mimeType(filename)
  const { error } = await supabase.storage.from(bucket).upload(destination, bytes, {
    contentType,
    upsert: true,
  })
  if (error) throw error
  return destination
}

function mimeType(filename) {
  const ext = extname(filename).toLowerCase()
  if (ext === '.png') return 'image/png'
  if (ext === '.webp') return 'image/webp'
  return 'image/jpeg'
}
