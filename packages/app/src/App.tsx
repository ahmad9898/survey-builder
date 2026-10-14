import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { HomePage } from './pages/HomePage';
import { PlayerPage } from './pages/PlayerPage';
import { BuilderPage } from './pages/BuilderPage';
import { VerifyHarnessPage } from './pages/VerifyHarnessPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/run/:surveyId" element={<PlayerPage />} />
        <Route path="/builder/:surveyId" element={<BuilderPage />} />
        {/* TEMPORARY -- see VerifyHarnessPage.tsx's own comment. */}
        <Route path="/verify-harness" element={<VerifyHarnessPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
