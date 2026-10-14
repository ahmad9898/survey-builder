import { useEffect, useRef } from 'react';
import Box from '@mui/material/Box';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { CacheProvider } from '@emotion/react';
import createCache from '@emotion/cache';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import type { Survey } from './types/survey';
import type { SurveyResponse } from './types/response';
import { CURRENT_ANSWERS_FORMAT_VERSION } from './types/response';
import { theme } from './theme';
import { PlayerStoreProvider } from './runtime/store/PlayerStoreProvider';
import { usePlayerStore } from './runtime/store/playerStore';
import { RunnerShell } from './runtime/components/runner/RunnerShell';
import { SubmittedScreen } from './runtime/components/runner/SubmittedScreen';
import { validateSurvey, normalizeSurvey } from './domain/surveySchema';
import { computeScore } from './domain/scoringEngine';
import { buildResponsePayload } from './domain/responsePayload';
import { newId } from './lib/id';
import { SurveyValidationError } from './components/SurveyValidationError';

export interface SurveyRunnerProps {
  /** The survey to present to a respondent. */
  survey: Survey;
  /** Resume a partially-answered survey. Only read on mount (and if `survey.id` later changes). */
  initialAnswers?: Record<string, unknown>;
  /** Fires (debounced ~500ms) as the respondent answers, for autosave-style host integration. */
  onChange?: (answers: Record<string, unknown>) => void;
  /**
   * Fires once, when the respondent reaches the end of the survey, with a
   * full SurveyResponse -- not just the raw answers -- so a host doesn't
   * have to re-derive visitedPageIds/score/timestamps by hand. `id` is a
   * freshly generated id for this one run (a host that wants to dedupe
   * retakes should key off `surveyId` + `completedAt`, not `id`).
   */
  onSubmit?: (response: SurveyResponse) => void;
  /**
   * Shows an "Exit" link in the header when provided; clicking it navigates
   * the browser to this path/URL. A full browser navigation (`window.
   * location`), not client-side routing -- this library has no router of
   * its own and can't depend on one (react-router isn't a peer dependency),
   * so this is the only way to leave that works regardless of what, if
   * anything, the host uses for routing. Omit this prop to hide the Exit
   * link entirely.
   */
  exitPath?: string;
  /**
   * Added to this component's own root element's `className`, nothing more
   * -- not a DOM node or a ref, despite the name. Lets a host theme ONE
   * mounted instance purely from its own CSS (`.acme-blue-theme { ... }`),
   * without touching this library's internals or re-rendering with a
   * different theme object per instance. Omit it for no extra class.
   */
  targetElement?: string;
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
          {/* The one DOM wrapper between the (non-DOM) providers above and
              whichever branch renders below -- targetElement's whole
              mechanism is this className, so it has to land on every
              render path (error / in-progress / submitted), not just one.
              height: '100%' here, not on this Box's child, is what lets
              the existing "renders at height: 100% of whatever you mount
              it in" contract keep working with an extra DOM layer now in
              between. */}
          <Box className={props.targetElement} sx={{ height: '100%' }}>
            {!validation.valid ? (
              <SurveyValidationError errors={validation.errors} />
            ) : (
              <PlayerStoreProvider>
                <SurveyRunnerInner {...props} survey={normalizeSurvey(props.survey)} />
              </PlayerStoreProvider>
            )}
          </Box>
        </LocalizationProvider>
      </ThemeProvider>
    </CacheProvider>
  );
}

function SurveyRunnerInner({ survey, initialAnswers, onChange, onSubmit, exitPath }: SurveyRunnerProps) {
  const playerSurvey = usePlayerStore((s) => s.survey);
  const answers = usePlayerStore((s) => s.answers);
  const finished = usePlayerStore((s) => s.finished);
  const visitedPageStack = usePlayerStore((s) => s.visitedPageStack);
  const loadSurvey = usePlayerStore((s) => s.loadSurvey);
  const setAnswers = usePlayerStore((s) => s.setAnswers);

  // Timestamps this specific run (not the survey itself) -- reset alongside
  // the store's own state whenever a genuinely different survey is loaded,
  // same gating as loadSurvey below.
  const startedAtRef = useRef(new Date().toISOString());

  // Loads on mount, and again if the host swaps in a DIFFERENT survey later
  // (different id) -- but not on every re-render, so the respondent's own
  // in-progress answers aren't wiped by the host simply re-rendering with an
  // equivalent survey object.
  const lastLoadedSurveyId = useRef<string | null>(null);
  useEffect(() => {
    if (lastLoadedSurveyId.current === survey.id) return;
    lastLoadedSurveyId.current = survey.id;
    startedAtRef.current = new Date().toISOString();
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
      // Scoring/branching both read the plain raw-value map, same as always
      // -- only the OUTGOING onSubmit payload's `answers` gets the rich,
      // self-describing treatment (see buildResponsePayload's own comment).
      const score = survey.scoring?.enabled
        ? computeScore(survey.scoringMap, answers, survey.scoring.categories, survey.scoring.passThreshold)
        : undefined;
      onSubmit?.({
        id: newId('response'),
        surveyId: survey.id,
        title: survey.title,
        ...(survey.type ? { type: survey.type } : {}),
        surveyVersion: survey.version,
        answersFormatVersion: CURRENT_ANSWERS_FORMAT_VERSION,
        answers: buildResponsePayload(survey, answers, { visitedPageIds: visitedPageStack }),
        visitedPageIds: visitedPageStack,
        score,
        startedAt: startedAtRef.current,
        completedAt: new Date().toISOString(),
      });
    }
    if (!finished) hasSubmittedRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished]);

  if (!playerSurvey) return null;
  return finished ? <SubmittedScreen /> : <RunnerShell exitPath={exitPath} />;
}
