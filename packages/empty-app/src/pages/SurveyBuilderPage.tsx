import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { SurveyBuilder } from 'survey-builder-kit'
import type { Survey } from 'survey-builder-kit'

// Two screens, toggled by local state:
//  - 'menu': the two buttons the task asked for.
//  - 'editor': <SurveyBuilder> itself, mounted once `survey` is decided.
//
// `survey` is `null` for "New Survey" (SurveyBuilder's documented way of
// saying "start blank" -- it creates an empty one internally) or the
// parsed JSON for "Import Survey JSON".
type View = 'menu' | 'editor'

export function SurveyBuilderPage() {
  const [view, setView] = useState<View>('menu')
  const [survey, setSurvey] = useState<Survey | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleNewSurvey() {
    setSurvey(null)
    setImportError(null)
    setView('editor')
  }

  function handleImportClick() {
    fileInputRef.current?.click()
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    // Let the same input be used again later (choosing the same file twice
    // in a row wouldn't otherwise re-fire onChange).
    event.target.value = ''
    if (!file) return

    try {
      const text = await file.text()
      const parsed = JSON.parse(text) as Survey
      setSurvey(parsed)
      setImportError(null)
      setView('editor')
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Could not read that file as JSON.')
    }
  }

  // The task's actual "on save" requirement -- SurveyBuilder's onSave fires
  // with the current Survey JSON once per click of its own header's Save
  // button. No persistence happens here; we just print it.
  function handleSave(savedSurvey: Survey) {
    console.log('SurveyBuilder onSave:', savedSurvey)
  }

  if (view === 'editor') {
    return (
      // position: fixed breaks this out of the home page's centered,
      // width-capped #root layout (see src/index.css) so SurveyBuilder gets
      // the full viewport it expects -- see the README's note that it
      // renders at height: 100% of whatever contains it.
      <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', background: '#fff' }}>
        <div style={{ padding: '8px 16px', borderBottom: '1px solid #e5e4e7', flex: '0 0 auto' }}>
          <button type="button" onClick={() => setView('menu')}>
            ← Back
          </button>
        </div>
        <div style={{ flex: '1 1 auto', minHeight: 0 }}>
          <SurveyBuilder survey={survey} onSave={handleSave} />
        </div>
      </div>
    )
  }

  return (
    <section style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '64px 20px' }}>
      <h1>Survey Builder</h1>
      <p>
        <Link to="/">← Back to home</Link>
      </p>
      <div style={{ display: 'flex', gap: 12 }}>
        <button type="button" onClick={handleNewSurvey}>
          New Survey
        </button>
        <button type="button" onClick={handleImportClick}>
          Import Survey JSON
        </button>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
      {importError && <p style={{ color: 'crimson' }}>{importError}</p>}
    </section>
  )
}
