import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { HomePage } from './pages/HomePage';
import { PlayerPage } from './pages/PlayerPage';
import { BuilderPage } from './pages/BuilderPage';
import { ViewerPage } from './pages/ViewerPage';
import { VerifyHarnessPage } from './pages/VerifyHarnessPage';
import { CustomChromePlayerPage } from './pages/CustomChromePlayerPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/run/:surveyId" element={<PlayerPage />} />
        <Route path="/builder/:surveyId" element={<BuilderPage />} />
        <Route path="/viewer" element={<ViewerPage />} />
        {/* TEMPORARY -- see VerifyHarnessPage.tsx's own comment. */}
        <Route path="/verify-harness" element={<VerifyHarnessPage />} />
        {/* Demo of SurveyRunnerProps' render*To props -- see CustomChromePlayerPage.tsx's own comment. */}
        <Route path="/custom-chrome" element={<CustomChromePlayerPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
