import { useEffect, useMemo, useRef } from 'react';
import Box from '@mui/material/Box';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { CacheProvider } from '@emotion/react';
import createCache from '@emotion/cache';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import type { Survey } from './types/survey';
import type { AnswerEntry, PredefinedAnswer, SurveyResponse } from './types/response';
import { CURRENT_ANSWERS_FORMAT_VERSION } from './types/response';
import { createLibraryTheme } from './theme';
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
  /**
   * Resume a partially-answered survey. Only read on mount (and if
   * `survey.id` later changes). Each question still renders normally,
   * pre-filled with its value -- unlike `predefinedAnswers`, nothing is
   * ever hidden on a MIXED page. But if every question on a page already
   * has a value from `initialAnswers`, that whole page is skipped outright
   * (the respondent never lands on it) -- there would be nothing left to
   * show or answer there anyway. (This can't be triggered by the
   * respondent finishing a page themselves -- only questions that already
   * had a value here BEFORE the respondent started count.)
   */
  initialAnswers?: Record<string, unknown>;
  /**
   * Answers already known before the respondent starts -- e.g. from a
   * prior step in a larger flow, or profile data already on file. Only
   * read on mount (and again if `survey.id` changes), same as
   * `initialAnswers` -- but unlike `initialAnswers`, each of these
   * questions is also hidden from the respondent entirely, not just
   * pre-filled, even on a page with other, non-predefined questions still
   * showing. A page where every question is predefined (or otherwise
   * already fully covered by `initialAnswers`) is skipped outright.
   *
   * The value still counts as a real answer for validation/branching/
   * scoring, and shows up normally in `onSubmit`/`onAnswer` -- this only
   * changes what's rendered, not what's considered answered. If both
   * `initialAnswers` and `predefinedAnswers` set the same question,
   * `predefinedAnswers` wins (and that question is hidden).
   */
  predefinedAnswers?: PredefinedAnswer[];
  /** Fires (debounced ~500ms) as the respondent answers, for autosave-style host integration. */
  onChange?: (answers: Record<string, unknown>) => void;
  /**
   * Fires once per page advance -- when the respondent moves on to the
   * next page, not on every keystroke/selection within a page (see
   * `onChange` for that) -- with `submitted: false` and `response.answers`
   * scoped to just that page's questions flagged `hasTrigger: true`
   * (QuestionDef); a page with none of those doesn't fire at all. At that
   * point `response.completedAt` is omitted (the survey isn't finished
   * yet) and `response.id` is this one call's own id, not a stable id
   * shared across calls.
   *
   * At actual completion, this fires once more, differently: `submitted:
   * true`, and `response.answers` is EVERY answer from the whole survey --
   * every page, `hasTrigger` or not -- the same full set `onSubmit` itself
   * gets (a separate, independently-built `SurveyResponse` -- the two
   * calls' `response.id`s don't match each other).
   *
   * `response` is a full `SurveyResponse` either way -- same shape as
   * `onSubmit`'s own parameter (id/surveyId/title/type/surveyVersion/
   * answersFormatVersion/answers/visitedPageIds/score/startedAt/
   * completedAt) -- not just a bare `AnswerEntry[]`, so a host doesn't have
   * to track survey-level context (which survey, which run, live score so
   * far) separately from the answers themselves.
   *
   * Does not fire on back-navigation (including jumping back via the
   * review screen's "Edit").
   */
  onAnswer?: (response: SurveyResponse, submitted: boolean) => void;
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
  bgColor?: string;
  /**
   * Overrides the library's default primary color (`#4f46e5`) for this one
   * mounted instance -- every `primary.main`/`.dark`/`.light`/`.contrastText`
   * usage throughout the component (the progress rail, selected-option
   * cards/borders, the submit/continue button, etc.) reads from the theme,
   * so this one value reaches all of them. `dark`/`light`/`contrastText`
   * are derived from it automatically. Unlike `bgColor`, this DOES
   * re-render under a different theme object -- there's no way to override
   * MUI's `sx={{ color: 'primary.main' }}` tokens from plain host CSS the
   * way `bgColor` overrides literal CSS properties.
   */
  primaryColor?: string;
  /**
   * Opaque pass-through value -- this library does nothing with it beyond
   * handing it back unchanged on every `SurveyResponse` (`onAnswer`'s and
   * `onSubmit`'s), so a host can stamp a response with its own identifier
   * (e.g. which SKU/plan this assessment run belongs to) without this
   * library needing to know what it means.
   */
  serviceSku?: string;
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
  const theme = useMemo(() => createLibraryTheme(props.primaryColor), [props.primaryColor]);

  return (
    <CacheProvider value={emotionCache}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <LocalizationProvider dateAdapter={AdapterDayjs}>
          {/* The one DOM wrapper between the (non-DOM) providers above and
              whichever branch renders below -- bgColor's whole mechanism is
              this className, so it has to land on every render path
              (error / in-progress / submitted), not just one. height:
              '100%' here, not on this Box's child, is what lets the
              existing "renders at height: 100% of whatever you mount it
              in" contract keep working with an extra DOM layer now in
              between. */}
          <Box className={props.bgColor} sx={{ height: '100%' }}>
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

function SurveyRunnerInner({
  survey,
  initialAnswers,
  predefinedAnswers,
  onChange,
  onAnswer,
  onSubmit,
  exitPath,
  serviceSku,
}: SurveyRunnerProps) {
  const playerSurvey = usePlayerStore((s) => s.survey);
  const answers = usePlayerStore((s) => s.answers);
  const finished = usePlayerStore((s) => s.finished);
  const visitedPageStack = usePlayerStore((s) => s.visitedPageStack);
  const loadSurvey = usePlayerStore((s) => s.loadSurvey);
  const setAnswers = usePlayerStore((s) => s.setAnswers);
  const setPredefinedQuestionIds = usePlayerStore((s) => s.setPredefinedQuestionIds);
  const setInitialAnswerQuestionIds = usePlayerStore((s) => s.setInitialAnswerQuestionIds);

  // Timestamps this specific run (not the survey itself) -- reset alongside
  // the store's own state whenever a genuinely different survey is loaded,
  // same gating as loadSurvey below.
  const startedAtRef = useRef(new Date().toISOString());

  // Shared by onAnswer's two call sites below AND onSubmit's own effect --
  // builds a full SurveyResponse around whichever already-built `entries`
  // the caller hands in (either the full survey or one page's hasTrigger
  // subset), not from `answers` directly, so each call site stays in
  // control of what's scoped in. `id` is fresh per call (NOT a stable id
  // shared across a run's several onAnswer calls, or with onSubmit's own
  // response -- see onAnswer's own doc comment). `score` is recomputed
  // from whatever `answers` currently holds every time, including
  // mid-survey -- a "live" score, not necessarily the final one.
  const buildSurveyResponse = (
    entries: AnswerEntry[],
    visitedPageIds: string[],
    completedAt?: string,
  ): SurveyResponse => {
    const score = survey.scoring?.enabled
      ? computeScore(survey.scoringMap, answers, survey.scoring.categories, survey.scoring.passThreshold)
      : undefined;
    return {
      id: newId('response'),
      surveyId: survey.id,
      title: survey.title,
      ...(survey.type ? { type: survey.type } : {}),
      surveyVersion: survey.version,
      answersFormatVersion: CURRENT_ANSWERS_FORMAT_VERSION,
      answers: entries,
      visitedPageIds,
      score,
      startedAt: startedAtRef.current,
      ...(completedAt ? { completedAt } : {}),
      ...(serviceSku ? { serviceSku } : {}),
    };
  };

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

    // predefinedAnswers wins over initialAnswers on a shared id -- merged
    // in that order so its values are the ones actually present in
    // `answers` for whichever ids overlap.
    if (initialAnswers || predefinedAnswers) {
      setAnswers({
        ...initialAnswers,
        ...Object.fromEntries((predefinedAnswers ?? []).map((a) => [a.id, a.value])),
      });
    }
    if (predefinedAnswers?.length) {
      setPredefinedQuestionIds(new Set(predefinedAnswers.map((a) => a.id)));
    }
    if (initialAnswers && Object.keys(initialAnswers).length > 0) {
      setInitialAnswerQuestionIds(new Set(Object.keys(initialAnswers)));
    }
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

  // Unlike onChange above, tracks PAGE transitions (visitedPageStack/
  // finished), not `answers` directly -- so editing within a page fires
  // nothing, only actually advancing does. visitedPageStack growing means
  // a forward move (goBack shrinks it instead, so back-navigation and
  // jumping back via the review screen's "Edit" are both correctly
  // ignored); `finished` flipping true with the stack UNCHANGED is the
  // final page's own advance (goNext sets `finished` instead of pushing a
  // new page once there's nowhere left to go). Either way, the page that
  // was just left is the last entry of the stack as it stood BEFORE this
  // transition -- captured via the refs below, snapshotted every run so
  // the next transition compares against the right "before" state.
  const prevVisitedPageStackRef = useRef(visitedPageStack);
  const prevFinishedRef = useRef(finished);
  useEffect(() => {
    const prevStack = prevVisitedPageStackRef.current;
    const prevFinished = prevFinishedRef.current;
    prevVisitedPageStackRef.current = visitedPageStack;
    prevFinishedRef.current = finished;

    const movedForward = visitedPageStack.length > prevStack.length;
    const justFinished = finished && !prevFinished;
    if (!movedForward && !justFinished) return;

    if (justFinished) {
      // The one exception to "only hasTrigger questions, only the page just
      // left": at actual completion, report EVERY answer from the whole
      // survey (every page in visitedPageStack, hasTrigger or not) -- the
      // same full set onSubmit's own response.answers gets, just delivered
      // through onAnswer too (as its own separately-built SurveyResponse,
      // not literally the same object onSubmit gets). finished is always
      // true here, so this is unconditionally `submitted: true`.
      const fullEntries = buildResponsePayload(survey, answers, { visitedPageIds: visitedPageStack });
      onAnswer?.(buildSurveyResponse(fullEntries, visitedPageStack, new Date().toISOString()), true);
      return;
    }

    const leftPageId = prevStack[prevStack.length - 1];
    if (!leftPageId) return;
    // Scoped to just that one page's id -- buildResponsePayload only walks
    // the pages named here, so this is "that page's answers", not
    // everything visited so far. Then filtered further, to only the
    // questions on that page flagged `hasTrigger: true` -- a page with none
    // of those fires nothing at all. `visitedPageIds` on the response is
    // still the full stack-so-far, same meaning as onSubmit's -- only
    // `answers` itself is narrowed.
    const triggerEntries = buildResponsePayload(survey, answers, { visitedPageIds: [leftPageId] }).filter(
      (entry) => entry.hasTrigger,
    );
    if (triggerEntries.length > 0) onAnswer?.(buildSurveyResponse(triggerEntries, visitedPageStack), false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visitedPageStack, finished]);

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
        ...(serviceSku ? { serviceSku } : {}),
      });
    }
    if (!finished) hasSubmittedRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished]);

  if (!playerSurvey) return null;
  return finished ? <SubmittedScreen /> : <RunnerShell exitPath={exitPath} />;
}

/**
 * Element-factory wrapper around <SurveyRunner> -- same props, returned as a
 * React element instead of written as JSX. Useful when the props are
 * assembled somewhere that isn't itself writing JSX for this element (e.g. a
 * plain function); the returned element still has to be rendered by React as
 * usual (e.g. `{renderAssessment(props)}` inside a component's JSX).
 */
export function renderAssessment(props: SurveyRunnerProps) {
  return <SurveyRunner {...props} />;
}
