import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { SurveyRunner, newSurvey } from 'survey-builder-kit'
import type { Survey, SurveyResponse } from 'survey-builder-kit'

// Keyed by questionId -- pre-fills these fields (still shown, still
// editable) rather than hiding them; see <SurveyRunner>'s own
// predefinedAnswers prop instead if they should be hidden from the
// respondent entirely.
const initialAnswers: Record<string, unknown> = {
  'first-name': 'ahmad',
  'last-name': 'ahmad',
  email: 'ahmad@gmail.com',
}

// Same two-button shape as SurveyBuilderPage, but <SurveyRunner>'s `survey`
// prop is REQUIRED (unlike <SurveyBuilder>, which treats survey={null} as
// "start blank" internally) -- there's no respondent-facing survey to run
// until one exists. So "New Survey" here calls the library's own exported
// newSurvey() helper to produce a valid (if empty: one page, no questions)
// Survey object ourselves, and hands that to the Runner.
type View = 'menu' | 'runner'

export function SurveyRunnerPage() {
  const [view, setView] = useState<View>('menu')
  const [survey, setSurvey] = useState<Survey | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleNewSurvey() {
    setSurvey(newSurvey())
    setImportError(null)
    setView('runner')
  }

  function handleImportClick() {
    fileInputRef.current?.click()
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    try {
      const text = await file.text()
      const parsed = JSON.parse(text) as Survey
      setSurvey(parsed)
      setImportError(null)
      setView('runner')
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Could not read that file as JSON.')
    }
  }
  const assessmentCallback = (response: SurveyResponse, submitted: boolean) => {
    console.log('assessmentCallback', response, 'submitted: ' + submitted);
  };
  // onSubmit is the Runner's equivalent of the Builder's onSave: it fires
  // once, when the respondent reaches the end of the survey -- now with a
  // full SurveyResponse (answers plus visitedPageIds/score/timestamps),
  // not just the bare answers. Nothing is persisted here.
  function handleSubmit(_response: SurveyResponse) {
    //console.log('SurveyRunner onSubmit:', _response)
  }

  if (view === 'runner' && survey) {
    return (
      <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', background: '#fff' }}>
        <div style={{ padding: '8px 16px', borderBottom: '1px solid #e5e4e7', flex: '0 0 auto' }}>
          <button type="button" onClick={() => setView('menu')}>
            ← Back
          </button>
        </div>
        <div style={{ flex: '1 1 auto', minHeight: 0 }}>
          <SurveyRunner
            survey={survey}
            onSubmit={handleSubmit}
            onAnswer={assessmentCallback}
            initialAnswers={initialAnswers}
          />
        </div>
      </div>
    )
  }

  return (
    <section style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '64px 20px' }}>
      <h1>Survey Runner</h1>
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
