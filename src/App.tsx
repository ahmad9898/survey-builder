import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { HomePage } from './pages/HomePage';
import { PlayerPage } from './pages/PlayerPage';
import { BuilderPage } from './pages/BuilderPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/run/:surveyId" element={<PlayerPage />} />
        <Route path="/builder/:surveyId" element={<BuilderPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
