import { useEffect, useRef } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { CacheProvider } from '@emotion/react';
import createCache from '@emotion/cache';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import type { Survey } from './types/survey';
import { theme } from './theme';
import { PlayerStoreProvider } from './runtime/store/PlayerStoreProvider';
import { usePlayerStore } from './runtime/store/playerStore';
import { RunnerShell } from './runtime/components/runner/RunnerShell';
import { SubmittedScreen } from './runtime/components/runner/SubmittedScreen';
import { validateSurvey, normalizeSurvey } from './domain/surveySchema';
import { SurveyValidationError } from './components/SurveyValidationError';

export interface SurveyRunnerProps {
  /** The survey to present to a respondent. */
  survey: Survey;
  /** Resume a partially-answered survey. Only read on mount (and if `survey.id` later changes). */
  initialAnswers?: Record<string, unknown>;
  /** Fires (debounced ~500ms) as the respondent answers, for autosave-style host integration. */
  onChange?: (answers: Record<string, unknown>) => void;
  /** Fires once, when the respondent reaches the end of the survey. */
  onSubmit?: (answers: Record<string, unknown>) => void;
}

// One Emotion cache per component, keyed distinctly from SurveyBuilder's --
// scopes this library's injected styles so they can't collide with a host
// project's own MUI/Emotion setup if it has one (two different <style>
// insertion points, not a shared/global one).
const emotionCache = createCache({ key: 'sbk-runner' });

/**
 * Presents a survey to a respondent and reports their answers back to the
 * host. Client-only (uses no SSR-unsafe browser APIs directly, but renders
 * nothing useful without a DOM) -- see the README's SSR caveat.
 */
export function SurveyRunner(props: SurveyRunnerProps) {
  // Validated on mount (and again if the host swaps in a different `survey`
  // prop) -- a malformed survey renders a clear error state here instead of
  // crashing somewhere deep inside the branching/scoring code that assumes
  // well-formed data.
  const validation = validateSurvey(props.survey);

  return (
    <CacheProvider value={emotionCache}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <LocalizationProvider dateAdapter={AdapterDayjs}>
          {!validation.valid ? (
            <SurveyValidationError errors={validation.errors} />
          ) : (
            <PlayerStoreProvider>
              <SurveyRunnerInner {...props} survey={normalizeSurvey(props.survey)} />
            </PlayerStoreProvider>
          )}
        </LocalizationProvider>
      </ThemeProvider>
    </CacheProvider>
  );
}

function SurveyRunnerInner({ survey, initialAnswers, onChange, onSubmit }: SurveyRunnerProps) {
  const playerSurvey = usePlayerStore((s) => s.survey);
  const answers = usePlayerStore((s) => s.answers);
  const finished = usePlayerStore((s) => s.finished);
  const loadSurvey = usePlayerStore((s) => s.loadSurvey);
  const setAnswers = usePlayerStore((s) => s.setAnswers);

  // Loads on mount, and again if the host swaps in a DIFFERENT survey later
  // (different id) -- but not on every re-render, so the respondent's own
  // in-progress answers aren't wiped by the host simply re-rendering with an
  // equivalent survey object.
  const lastLoadedSurveyId = useRef<string | null>(null);
  useEffect(() => {
    if (lastLoadedSurveyId.current === survey.id) return;
    lastLoadedSurveyId.current = survey.id;
    loadSurvey(survey);
    if (initialAnswers) setAnswers(initialAnswers);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [survey.id]);

  // Debounced onChange, same reasoning as SurveyBuilder's onChange: don't
  // fire on every keystroke.
  const changeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasMountedChange = useRef(false);
  useEffect(() => {
    if (!hasMountedChange.current) {
      hasMountedChange.current = true;
      return;
    }
    if (changeTimer.current) clearTimeout(changeTimer.current);
    changeTimer.current = setTimeout(() => onChange?.(answers), 500);
    return () => {
      if (changeTimer.current) clearTimeout(changeTimer.current);
    };
  }, [answers, onChange]);

  // Fires once per completed run, not on every render while `finished` stays
  // true (e.g. a parent re-render after onSubmit updates host state).
  const hasSubmittedRef = useRef(false);
  useEffect(() => {
    if (finished && !hasSubmittedRef.current) {
      hasSubmittedRef.current = true;
      onSubmit?.(answers);
    }
    if (!finished) hasSubmittedRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished]);

  if (!playerSurvey) return null;
  return finished ? <SubmittedScreen /> : <RunnerShell />;
}
