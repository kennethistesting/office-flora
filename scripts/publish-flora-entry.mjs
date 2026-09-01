import fs from 'node:fs/promises'

const manifestPath = process.argv[2]

if (!manifestPath) {
  throw new Error('Usage: node scripts/publish-flora-entry.mjs <manifest.json>')
}

const publishToken = process.env.OFFICE_FLORA_PUBLISH_TOKEN
if (!publishToken) {
  throw new Error('Missing OFFICE_FLORA_PUBLISH_TOKEN')
}

const functionUrl = 'https://wkineyxaltgwikhghsox.supabase.co/functions/v1/publish-flora-entry'

const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'))

async function readBase64({ file, files }) {
  const paths = files?.length ? files : file ? [file] : []
  if (!paths.length) return null

  const parts = []
  for (const path of paths) {
    parts.push((await fs.readFile(path, 'utf8')).trim())
  }
  return parts.join('')
}

const photoBase64 = await readBase64({
  file: manifest.photo_base64_file,
  files: manifest.photo_base64_files,
})

const illustrationBase64 = await readBase64({
  file: manifest.illustration_base64_file,
  files: manifest.illustration_base64_files,
})

const payload = {
  slug: manifest.slug,
  flower_name: manifest.flower_name,
  common_name: manifest.common_name ?? null,
  scientific_name: manifest.scientific_name ?? null,
  captured_at: manifest.captured_at ?? null,
  confidence: manifest.confidence ?? null,
  arrangement_style: manifest.arrangement_style ?? null,
  notes: manifest.notes ?? null,
  colors: manifest.colors ?? [],
  tags: manifest.tags ?? [],
  photo_base64: photoBase64,
  photo_type: manifest.photo_type ?? 'image/jpeg',
  illustration_base64: illustrationBase64,
  illustration_type: manifest.illustration_type ?? 'image/png',
}

const response = await fetch(functionUrl, {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'x-publish-token': publishToken,
  },
  body: JSON.stringify(payload),
})

const text = await response.text()
let result
try {
  result = JSON.parse(text)
} catch {
  result = { raw: text }
}

if (!response.ok || !result.success) {
  console.error('Office Flora publish failed:', result)
  process.exit(1)
}

console.log(`Published ${result.entry?.slug ?? manifest.slug}`)
