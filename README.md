# Office Flora 🌿

A public botanical archive for flowers and arrangements found around the office.

The website is intentionally **read-only**. Visitors can browse published entries, search the archive, open an entry, view the original photograph, botanical study, identification, palette, and design notes. There is no public upload screen and no admin login.

Your private publishing workflow happens outside the website.

## How the publishing workflow works

```text
You photograph a flower
        ↓
Upload it in ChatGPT
        ↓
Identify + write metadata + generate botanical study
        ↓
Create an Office Flora entry package
        ↓
Add package to content/entries/ and push to GitHub
        ↓
GitHub Action securely syncs it to Supabase
        ↓
Public website shows the new published entry
```

This keeps the public site clean and prevents visitors from adding or changing content.

## Architecture

```text
PUBLIC
GitHub Pages (React/Vite)
        |
        | publishable Supabase key
        v
Supabase Postgres + public image storage
        |
        └── only rows where status = 'published' are readable

PRIVATE PUBLISHING
content/entries/* in GitHub
        |
        | GitHub Actions secrets
        v
scripts/sync-content.mjs
        |
        | Supabase service role key
        v
Supabase
```

The Supabase **service role key never appears in the website**. It only lives in GitHub Actions secrets or your local environment.

## Entry package format

Each flower lives in its own folder:

```text
content/entries/
└── 001-phalaenopsis-orchid/
    ├── entry.json
    ├── photo.jpeg
    └── illustration.png
```

Example `entry.json`:

```json
{
  "slug": "phalaenopsis-orchid-001",
  "captured_at": "2026-08-31",
  "status": "published",
  "flower_name": "Phalaenopsis orchid",
  "common_name": "Moth orchid",
  "scientific_name": "Phalaenopsis",
  "confidence": 98,
  "arrangement_style": "Minimalist / sculptural",
  "notes": "Creamy white petals with a vivid orange-yellow lip...",
  "design_notes": "The dark stems act almost like drawn lines...",
  "dominant_colors": ["#f7f4e9", "#ffe6a3", "#e69a18"],
  "tags": ["orchid", "white", "sculptural"],
  "needs_review": false,
  "photo": "photo.jpeg",
  "illustration": "illustration.png"
}
```

Use `"status": "draft"` to sync an entry without exposing it on the public website. The public site only selects `status = published`.

## 1. Create a Supabase project

Create a project on the Supabase free tier.

From Project Settings → API, collect:

- Project URL
- Publishable / anon key
- Service role key

The **publishable key** is safe for the public website because database writes are blocked by Row Level Security.

The **service role key is secret** and must only go in GitHub Actions secrets or a private local environment.

## 2. Connect the frontend

Copy:

```bash
cp .env.example .env
```

Set:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

## 3. Create the database + storage

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

The migration creates:

- `flora_entries`
- `status` with `draft` / `published`
- public read access only for published rows
- public image buckets for published photo assets
- no browser write policies

## 4. Test locally

```bash
npm install
npm run dev
```

Without Supabase configuration, the site shows the sample orchid in preview mode.

## 5. Publish the sample entry locally

Set private environment variables in your terminal:

```bash
export SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
npm run publish-content
```

The sync script uploads the images and upserts the entry by `slug`, so it is safe to run again after edits.

## 6. Configure GitHub Actions

In GitHub → Settings → Secrets and variables → Actions, add:

### Public build secrets

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
```

### Private publisher secrets

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
```

Never commit `SUPABASE_SERVICE_ROLE_KEY` to the repository.

Two workflows are included:

- `deploy.yml` builds and publishes the website to GitHub Pages.
- `publish-content.yml` syncs `content/entries/**` to Supabase whenever those files change on `main`, or when manually triggered.

## 7. Publish future flowers through ChatGPT

The intended routine is simple:

1. Upload a flower photo in ChatGPT.
2. Say **“add this to Office Flora.”**
3. We identify the likely flower and flag uncertainty where appropriate.
4. We generate the archive metadata and botanical study.
5. We create a new `content/entries/###-slug/` package.
6. You add that folder to the GitHub repo and push it.
7. GitHub Actions publishes it to Supabase automatically.

If you later connect GitHub to ChatGPT with write access, this workflow can become even tighter because the generated entry package could be committed directly rather than copied manually.

## Public/privacy model

The site is public by design, so photographs and illustrations for published entries are stored in public Supabase buckets. Do not publish photos containing private office information, badges, documents, screens, addresses, or people you do not intend to share publicly.

Draft database rows are hidden from the public query, but the content publishing script should only upload assets when you are comfortable with those assets being publicly accessible.

## Next nice additions

- browse by flower, color, season, and arrangement style
- permanent shareable URLs such as `/flower/phalaenopsis-orchid-001`
- “related flowers” at the bottom of an entry
- yearly Office Flora recap
- a small species index showing how often each flower appears
