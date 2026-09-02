import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
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
  dominant_colors: ['#f7f4e9', '#ffe6a3', '#e69a18', '#6b8123', '#2b2b2b'],
  tags: ['orchid', 'white', 'sculptural', 'indoor', 'moss'],
  photo_url: './orchid-sample.jpeg',
  illustration_url: './orchid-botanical.png',
  status: 'published',
  sample: true,
}

const coverImages = Array.from({ length: 11 }, (_, index) =>
  `./cover-collage/entry-${String(index + 1).padStart(3, '0')}.webp`,
)

function App() {
  const [loading, setLoading] = useState(true)
  const [entries, setEntries] = useState([])
  const [readerOpen, setReaderOpen] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
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
        .order('slug', { ascending: false })

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

  useEffect(() => {
    if (!readerOpen) return undefined

    function handleKeyDown(event) {
      if (event.key === 'Escape') setReaderOpen(false)
      if (event.key === 'ArrowLeft') setCurrentIndex(index => Math.max(0, index - 1))
      if (event.key === 'ArrowRight') setCurrentIndex(index => Math.min(entries.length - 1, index + 1))
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [entries.length, readerOpen])

  if (loading) {
    return <Centered><Loader2 className="spin" /> Loading Office Flora…</Centered>
  }

  const currentEntry = entries[currentIndex]

  if (readerOpen && currentEntry) {
    return <Reader
      entry={currentEntry}
      index={currentIndex}
      total={entries.length}
      onClose={() => setReaderOpen(false)}
      onPrevious={() => setCurrentIndex(index => Math.max(0, index - 1))}
      onNext={() => setCurrentIndex(index => Math.min(entries.length - 1, index + 1))}
    />
  }

  return <div className="site-shell">
    <main className="cover-page">
      {!configured && <div className="setup-banner"><strong>Preview mode.</strong> Connect Supabase to load the public archive.</div>}

      <section className="cover-stage" aria-labelledby="cover-title">
        <button
          className="archive-cover"
          type="button"
          onClick={() => entries.length > 0 && setReaderOpen(true)}
          aria-label="Open Flowers that passed through the office"
          disabled={!entries.length}
        >
          <span className="cover-collage" aria-hidden="true">
            {coverImages.map((src, index) => <span className={`cover-tile tile-${index + 1}`} key={src}>
              <img src={src} alt="" />
            </span>)}
          </span>
          <span className="cover-volume">VOL. I</span>
          <span className="cover-title-block">
            <span className="cover-title" id="cover-title">Flowers that<br />passed through<br />the office</span>
            <span className="cover-subtitle">A botanical archive</span>
          </span>
        </button>
        {message && <p className="archive-message" role="status">{message}</p>}
      </section>
    </main>
  </div>
}

function Reader({ entry, index, total, onClose, onPrevious, onNext }) {
  const colors = entry.dominant_colors || entry.colors || []
  const entryNumber = total - index
  const plate = toRoman(entryNumber)
  const hasIllustration = Boolean(entry.illustration_url)
  const originalImageRef = useRef(null)
  const [matchedImageHeight, setMatchedImageHeight] = useState(null)

  useEffect(() => {
    const originalImage = originalImageRef.current
    if (!originalImage || !hasIllustration) return undefined
    setMatchedImageHeight(null)

    const updateHeight = () => {
      const height = Math.round(originalImage.getBoundingClientRect().height)
      if (height > 0) setMatchedImageHeight(height)
    }

    const image = originalImage.querySelector('img')
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(updateHeight)

    updateHeight()
    observer?.observe(originalImage)
    image?.addEventListener('load', updateHeight)
    window.addEventListener('resize', updateHeight)

    return () => {
      observer?.disconnect()
      image?.removeEventListener('load', updateHeight)
      window.removeEventListener('resize', updateHeight)
    }
  }, [entry.photo_url, hasIllustration])

  return <main className="reader-shell">
    <header className="reader-toolbar">
      <button className="reader-back" type="button" onClick={onClose}>
        <ArrowLeft size={16} /> Cover
      </button>
      <span>Botanical archive</span>
      <span className="reader-count">Entry {String(entryNumber).padStart(3, '0')} of {String(total).padStart(3, '0')}</span>
    </header>

    <article className="book-spread">
      <button
        className="edge-navigation edge-navigation-previous"
        type="button"
        onClick={onPrevious}
        disabled={index === 0}
        aria-label="Previous archive entry"
      >
        <ChevronLeft size={22} />
      </button>

      <section className="image-page">
        <p className="plate-number">Office Flora · Plate {plate}</p>

        <div className={`image-pair ${hasIllustration ? '' : 'single'}`}>
          <figure className="image-study">
            <figcaption>Original photograph</figcaption>
            <div className="entry-image original-image" ref={originalImageRef}>
              <img src={entry.photo_url} alt={`Original photograph of ${entry.flower_name || 'flower arrangement'}`} />
            </div>
          </figure>

          {hasIllustration && <figure className="image-study">
            <figcaption>Botanical study</figcaption>
            <div
              className="entry-image botanical-image"
              style={matchedImageHeight ? { '--matched-image-height': `${matchedImageHeight}px` } : undefined}
            >
              <img src={entry.illustration_url} alt={`Botanical study of ${entry.flower_name || 'flower arrangement'}`} />
            </div>
          </figure>}
        </div>

        <div className="plate-footer">
          <span>{entry.common_name || entry.flower_name || 'Untitled arrangement'}</span>
          <span>Office Flora</span>
        </div>
      </section>

      <aside className="entry-page">
        <div className="entry-content">
          <div className="entry-heading">
            <p className="entry-label">Entry {String(entryNumber).padStart(3, '0')}</p>
            <h1 className="entry-title">{entry.flower_name || 'Unknown flower'}</h1>
            <p className="scientific-name">{entry.scientific_name || entry.common_name || 'Identification pending'}</p>
          </div>

          <dl className="entry-facts">
            <Fact label="Captured" value={formatDate(entry.captured_at)} />
            <Fact label="Arrangement" value={entry.arrangement_style || '—'} />
            <Fact label="Common name" value={entry.common_name || '—'} />
            <Fact label="Confidence" value={entry.confidence ? `${entry.confidence}%` : 'Uncertain'} />
          </dl>

          {entry.notes && <p className="entry-notes">{entry.notes}</p>}

          {colors.length > 0 && <section className="palette-block" aria-label="Observed color palette">
            <p className="section-label">Observed palette</p>
            <div className="swatches">{colors.map((color, colorIndex) =>
              <span key={`${color}-${colorIndex}`} className="swatch" style={{ backgroundColor: color }} title={color} />
            )}</div>
          </section>}

          {entry.design_notes && <section className="design-note">
            <p className="section-label">Design note</p>
            <p>{entry.design_notes}</p>
          </section>}

          {(entry.tags || []).length > 0 && <div className="tags">
            {entry.tags.map(tag => <span key={tag}>{tag}</span>)}
          </div>}
        </div>

        <nav className="reader-navigation" aria-label="Browse archive entries">
          <button type="button" onClick={onPrevious} disabled={index === 0}>
            <ChevronLeft size={16} /> Previous
          </button>
          <button type="button" onClick={onNext} disabled={index === total - 1}>
            Next <ChevronRight size={16} />
          </button>
        </nav>
      </aside>

      <button
        className="edge-navigation edge-navigation-next"
        type="button"
        onClick={onNext}
        disabled={index === total - 1}
        aria-label="Next archive entry"
      >
        <ChevronRight size={22} />
      </button>
    </article>
  </main>
}

function Fact({ label, value }) {
  return <div><dt>{label}</dt><dd>{value}</dd></div>
}

function Centered({ children }) {
  return <div className="centered">{children}</div>
}

function formatDate(value) {
  if (!value) return 'Undated'
  const [year, month, day] = value.split('-').map(Number)
  return new Intl.DateTimeFormat(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day)))
}

function toRoman(value) {
  const numerals = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
    [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
  ]
  let remaining = value
  return numerals.reduce((result, [number, numeral]) => {
    while (remaining >= number) {
      result += numeral
      remaining -= number
    }
    return result
  }, '')
}

export default App
