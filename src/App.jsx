import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Loader2, Search } from 'lucide-react'
import { configured, supabase } from './supabase'

const sample = {
  id: 'sample-orchid',
  slug: 'phalaenopsis-orchid-001',
  captured_at: '2026-08-31',
  published_at: '2026-08-31T15:00:00.000Z',
  flower_name: 'Phalaenopsis orchid',
  common_name: 'Moth orchid',
  scientific_name: 'Phalaenopsis',
  confidence: 98,
  arrangement_style: 'Minimalist / sculptural',
  notes: 'Creamy white petals with a vivid orange-yellow lip. Sparse vertical stems and generous negative space give the arrangement an architectural feel.',
  design_notes: 'The dark stems act almost like drawn lines, while the moss creates a secondary focal point beneath the flowers.',
  dominant_colors: ['#f7f4e9','#ffe6a3','#e69a18','#6b8123','#2b2b2b'],
  tags: ['orchid','white','sculptural','indoor','moss'],
  photo_url: './orchid-sample.jpeg',
  illustration_url: './orchid-botanical.png',
  status: 'published',
  sample: true,
}

function App() {
  const [loading, setLoading] = useState(true)
  const [entries, setEntries] = useState([])
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(null)
  const [message, setMessage] = useState('')

  useEffect(() => {
    async function loadEntries() {
      if (!configured) {
        setEntries([sample])
        setLoading(false)
        return
      }

      const { data, error } = await supabase
        .from('flora_entries')
        .select('*')
        .eq('status', 'published')
        .order('captured_at', { ascending: false })

      if (error) {
        setMessage('The archive could not be loaded right now.')
        setEntries([])
      } else {
        setEntries(data || [])
      }
      setLoading(false)
    }

    loadEntries()
  }, [])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return entries
    return entries.filter((entry) =>
      [entry.flower_name, entry.common_name, entry.scientific_name, entry.arrangement_style, entry.notes, entry.design_notes, ...(entry.tags || [])]
        .join(' ')
        .toLowerCase()
        .includes(q),
    )
  }, [entries, query])

  if (loading) return <Centered><Loader2 className="spin" /> Loading Office Flora…</Centered>
  if (selected) return <Detail entry={selected} onBack={() => setSelected(null)} />

  return <div>
    <header className="site-header">
      <button className="brand" onClick={() => setSelected(null)}>OFFICE FLORA</button>
      <span className="header-note">A botanical archive</span>
    </header>

    <main className="page">
      {!configured && <div className="setup-banner"><strong>Preview mode.</strong> Connect Supabase to load the public archive.</div>}
      <section className="hero">
        <p className="eyebrow">AN ONGOING BOTANICAL ARCHIVE</p>
        <h1 className="display hero-title">Flowers that passed<br />through the office.</h1>
        <p className="hero-sub">Photograph them. Identify them. Remember them.</p>
      </section>

      <section className="toolbar">
        <label className="search"><Search size={18} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search orchid, white, sculptural…" /></label>
        <span className="muted small">{visible.length} {visible.length === 1 ? 'entry' : 'entries'}</span>
      </section>

      {message && <p className="status archive-message">{message}</p>}

      <section className="gallery">
        {visible.map((entry, i) => <button className="flora-card" key={entry.id} onClick={() => setSelected(entry)}>
          <div className="card-image-wrap"><img src={entry.illustration_url || entry.photo_url} alt={`Botanical study of ${entry.flower_name || 'flower'}`} /></div>
          <div className="card-meta">
            <div>
              <p className="eyebrow tiny">ENTRY {String(i + 1).padStart(3, '0')}</p>
              <h2 className="display">{entry.flower_name || 'Unknown flower'}</h2>
              <p className="muted">{entry.common_name || entry.arrangement_style}</p>
            </div>
            <p className="muted small">{formatDate(entry.captured_at)}</p>
          </div>
        </button>)}
      </section>

      {!visible.length && !message && <section className="empty-state"><p className="display">Nothing found.</p><span>Try another flower, color, or style.</span></section>}

      <footer className="site-footer">
        <span>OFFICE FLORA</span>
        <span>Ephemeral arrangements, permanently archived.</span>
      </footer>
    </main>
  </div>
}

function Detail({ entry, onBack }) {
  const colors = entry.dominant_colors || entry.colors || []
  return <main className="page detail-page">
    <button className="back" onClick={onBack}><ArrowLeft size={17} /> Back to archive</button>

    <section className={`detail-comparison ${entry.illustration_url ? '' : 'single'}`}>
      <figure className="comparison-panel">
        <div className="comparison-image"><img src={entry.photo_url} alt={`Original photograph of ${entry.flower_name || 'flower'}`} /></div>
        <figcaption><span>ORIGINAL PHOTOGRAPH</span><em>{formatDate(entry.captured_at)}</em></figcaption>
      </figure>
      {entry.illustration_url && <figure className="comparison-panel">
        <div className="comparison-image botanical"><img src={entry.illustration_url} alt={`Botanical study of ${entry.flower_name || 'flower'}`} /></div>
        <figcaption><span>BOTANICAL STUDY</span><em>Illustration on paper</em></figcaption>
      </figure>}
    </section>

    <article className="detail-copy detail-copy-below">
      <p className="eyebrow">OFFICE FLORA</p>
      <h1 className="display detail-title">{entry.flower_name || 'Unknown flower'}</h1>
      <p className="detail-common">{entry.common_name}</p>
      <div className="facts">
        <Fact label="Confidence" value={entry.confidence ? `${entry.confidence}%` : 'Uncertain'} />
        <Fact label="Captured" value={formatDate(entry.captured_at)} />
        <Fact label="Arrangement" value={entry.arrangement_style || '—'} />
        <Fact label="Scientific name" value={entry.scientific_name || '—'} />
      </div>
      {colors.length > 0 && <div><p className="eyebrow tiny">PALETTE</p><div className="swatches">{colors.map(c => <span key={c} className="swatch" style={{ background: c }} title={c} />)}</div></div>}
      <p className="detail-notes">{entry.notes}</p>
      {entry.design_notes && <div className="design-note"><strong>Design note</strong><p>{entry.design_notes}</p></div>}
      <div className="tags">{(entry.tags || []).map(tag => <span key={tag}>{tag}</span>)}</div>
    </article>
  </main>
}

function Fact({ label, value }) { return <div className="fact"><span>{label}</span><strong>{value}</strong></div> }
function Centered({ children }) { return <div className="centered">{children}</div> }
function formatDate(v) { if (!v) return 'Undated'; const [y, m, d] = v.split('-').map(Number); return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, d))) }

export default App
