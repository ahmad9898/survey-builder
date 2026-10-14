import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
// The Flow map inside <SurveyBuilder> needs React Flow's own stylesheet --
// see survey-builder-kit's README "Install" section. Importing it once here
// (rather than inside the page that renders <SurveyBuilder>) matches how the
// README recommends doing it, and means it's loaded no matter which route
// mounts the component first.
import 'survey-builder-kit/style.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
