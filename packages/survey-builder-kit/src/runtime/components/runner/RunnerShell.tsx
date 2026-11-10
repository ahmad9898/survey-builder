import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Box } from '@mui/material';
import { usePlayerStore, usePlayerStoreApi } from '../../store/playerStore';
import { resolveNextPage, isPageBlockedByRule } from '../../../domain/branchingEngine';
import { evaluateConditionGroup } from '../../../domain/conditionEvaluator';
import { estimateProgress } from '../../../domain/flowLayout';
import { formatAnswerDisplay } from '../../../domain/answerFormatting';
import type { QuestionDef } from '../../../types/survey';
import type { PortalTarget } from '../../../SurveyRunner';
import { ProgressRail } from './ProgressRail';
import { RunnerHeader } from './RunnerHeader';
import { QuestionStage, type StageDirection } from './QuestionStage';
import { MultiQuestionStage } from './MultiQuestionStage';
import { ReviewScreen, type ReviewItem } from './ReviewScreen';
import { validateQuestion, canAttemptAdvance, getDisqualifyingNotices } from './questionValidation';
import { usePortalTarget, portalWrapperClassName } from './usePortalTarget';

// `predefinedQuestionIds` hides a question the same way a visibilityRule
// does, but it's host-driven (SurveyRunnerProps.predefinedAnswers) rather
// than survey-authored -- a question the host already supplied an answer
// for is never shown to the respondent, regardless of what its own
// visibilityRule says.
function isVisible(question: QuestionDef, answers: Record<string, unknown>, predefinedQuestionIds: Set<string>): boolean {
  if (predefinedQuestionIds.has(question.id)) return false;
  return !question.visibilityRule || evaluateConditionGroup(question.visibilityRule, answers);
}

function visibleQuestionsOf(
  questions: QuestionDef[],
  answers: Record<string, unknown>,
  predefinedQuestionIds: Set<string>,
): QuestionDef[] {
  return questions.filter((q) => isVisible(q, answers, predefinedQuestionIds));
}

// What's pushed into `history.state` for each step the respondent reaches
// via Continue/Skip/Edit/the in-app Back button -- just enough to restore
// WHICH step they're on (`currentPageId`/`visitedPageStack`/`reviewing`),
// never their answers (those stay in the player store, untouched by any of
// this -- see SurveyRunnerProps' "beforeunload" bullet in the README).
// `sbk`/`step` are this library's own markers: `sbk` tells a popstate
// listener a given history entry is actually one of ours (the previous
// entry -- whatever the host's page was before the respondent landed here,
// or a DIFFERENT host page entirely -- almost certainly isn't, and must be
// left alone rather than misread as step data); `step` is a monotonically
// increasing counter, compared against the last-seen one to tell a
// backward pop from a forward (redo) one without having to infer it from
// stack lengths, which `reviewing` can make ambiguous.
interface SbkHistoryState {
  sbk: true;
  step: number;
  currentPageId: string;
  visitedPageStack: string[];
  reviewing: boolean;
}

function isSbkHistoryState(state: unknown): state is SbkHistoryState {
  return !!state && typeof state === 'object' && (state as { sbk?: unknown }).sbk === true;
}

export interface RunnerShellProps {
  exitPath?: string;
  bgColor?: string;
  renderAssessmentTo?: PortalTarget;
  renderProgressBarTo?: PortalTarget;
  renderStepsTo?: PortalTarget;
  renderExitTo?: PortalTarget;
}

// The runner's atomic step is a PAGE: a page with exactly one visible
// question gets the full-screen single-question treatment (QuestionStage);
// a page with more than one shows them all together on one screen
// (MultiQuestionStage) rather than splitting fields that belong together
// (e.g. "Weight & Height") into separate steps.
export function RunnerShell({
  exitPath,
  bgColor,
  renderAssessmentTo,
  renderProgressBarTo,
  renderStepsTo,
  renderExitTo,
}: RunnerShellProps) {
  // Unlike `renderAssessmentTo` below, these three default to HIDDEN, not
  // built-in, when omitted -- `?? null` coerces the omitted (`undefined`)
  // case to the same "don't render this piece anywhere" input `null` already
  // means, so a host sees no progress bar/step counter/Exit link at all
  // unless it explicitly points one at a target. The quiz body itself keeps
  // the opposite default (shown built-in) so a survey is still usable with
  // zero `render*To` config.
  const progressBarTarget = usePortalTarget('renderProgressBarTo', renderProgressBarTo ?? null);
  const stepsTarget = usePortalTarget('renderStepsTo', renderStepsTo ?? null);
  // `renderExitTo` only matters when `exitPath` is set at all -- forced to
  // `null` (hidden, no selector lookup, no warning) otherwise, same as
  // omitting it.
  const exitTarget = usePortalTarget('renderExitTo', exitPath ? (renderExitTo ?? null) : null);
  const assessmentTarget = usePortalTarget('renderAssessmentTo', renderAssessmentTo);

  const survey = usePlayerStore((s) => s.survey);
  const currentPageId = usePlayerStore((s) => s.currentPageId);
  const answers = usePlayerStore((s) => s.answers);
  const predefinedQuestionIds = usePlayerStore((s) => s.predefinedQuestionIds);
  const visitedPageStack = usePlayerStore((s) => s.visitedPageStack);
  const setAnswers = usePlayerStore((s) => s.setAnswers);
  const goNext = usePlayerStore((s) => s.goNext);
  const storeApi = usePlayerStoreApi();

  const [direction, setDirection] = useState<StageDirection>('forward');
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [reviewing, setReviewing] = useState(false);

  // The last `step` counter value this component itself applied -- compared
  // against an incoming popstate's `step` to tell a backward pop from a
  // forward (redo) one (see SbkHistoryState's own comment). Starts at 0,
  // matching the `replaceState` seed below.
  const historyStepRef = useRef(0);

  // Seeds the CURRENT history entry (the one the host's page already
  // occupies -- `replaceState`, never `pushState`, so this never adds a
  // new entry or changes the URL) with this run's starting position, once,
  // on mount. Without this, the entry a respondent would land back on by
  // pressing Back from step 2 would carry no step data at all.
  useEffect(() => {
    const state = storeApi.getState();
    if (!state.currentPageId) return;
    historyStepRef.current = 0;
    const payload: SbkHistoryState = {
      sbk: true,
      step: 0,
      currentPageId: state.currentPageId,
      visitedPageStack: state.visitedPageStack,
      reviewing: false,
    };
    window.history.replaceState(payload, '', window.location.href);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The one and only place browser Back/Forward are handled -- restores
  // position directly from what THIS entry's own `history.state` carries
  // (never re-derived from current answers/branch logic, unlike goNext),
  // and never calls pushState/back/forward itself, so there's no loop. A
  // popped state that isn't one of ours (e.g. the host's own previous page,
  // reached by pressing Back past this run's first step) is left alone --
  // nothing here reacts to it, so the host's own navigation proceeds
  // exactly as it would without this library in the picture.
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (!isSbkHistoryState(event.state)) return;
      const goingBackward = event.state.step < historyStepRef.current;
      historyStepRef.current = event.state.step;
      storeApi.getState().restoreNavigation(event.state.currentPageId, event.state.visitedPageStack);
      setReviewing(event.state.reviewing);
      setDirection(goingBackward ? 'backward' : 'forward');
      setErrorMessage(undefined);
      setFieldErrors({});
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [storeApi]);

  if (!survey || !currentPageId) return null;
  const currentPage = survey.pages.find((p) => p.id === currentPageId);
  if (!currentPage) return null;

  const visibleQuestions = visibleQuestionsOf(currentPage.questions, answers, predefinedQuestionIds);
  // Nothing to show at all -- every question on this page is either hidden
  // by its own visibilityRule or hidden via predefinedAnswers (see
  // isVisible above; predefinedAnswers actually HIDES the question, unlike
  // initialAnswers, which only pre-fills it -- a page covered entirely by
  // initialAnswers still renders normally below, pre-filled values and
  // all, so the respondent can see and change them, not skip past them
  // unaware). Move straight on rather than showing an empty screen.
  // Deliberately NOT a history step (no pushHistoryStep call) -- a page
  // skipped this way is never actually shown to the respondent, so there's
  // nothing for Back to usefully return them to. This also runs during
  // render (an existing pattern, not introduced here), where touching
  // `window.history` would be its own hazard -- see pushHistoryStep's own
  // comment for why every other transition calls it from an event handler
  // or effect instead.
  if (visibleQuestions.length === 0) {
    goNext();
    return null;
  }
  const isMultiQuestion = visibleQuestions.length > 1;
  const canGoBack = visitedPageStack.length > 1;

  const progress = estimateProgress(survey, visitedPageStack);
  const isFinalPage = resolveNextPage(currentPage, answers) === 'end';
  // A hard stop -- no Continue/Submit past it, not even a Review/Submit
  // screen -- from either of two sources: a page marked "blocks submission"
  // outright (a disqualification/referral notice), or a 'block'-action
  // branch rule on this page currently matching the answers so far (see
  // isPageBlockedByRule's own comment). Both are treated identically by
  // everything below.
  const submissionBlocked = !!currentPage.blocksSubmission || isPageBlockedByRule(currentPage, answers);

  // Called after EVERY intentional forward-like transition (Continue/Skip
  // advancing to a new page or into review, and Edit jumping to an earlier
  // page from review) -- never from the popstate handler itself, which is
  // what keeps this loop-free. Reads the just-updated store state rather
  // than taking it as a parameter, so it's always pushing what's actually
  // on screen a moment later, regardless of which caller just changed it.
  const pushHistoryStep = (nextReviewing: boolean) => {
    const state = storeApi.getState();
    if (!state.currentPageId) return;
    historyStepRef.current += 1;
    const payload: SbkHistoryState = {
      sbk: true,
      step: historyStepRef.current,
      currentPageId: state.currentPageId,
      visitedPageStack: state.visitedPageStack,
      reviewing: nextReviewing,
    };
    window.history.pushState(payload, '', window.location.href);
  };

  const advancePastCurrentPage = () => {
    const next = resolveNextPage(currentPage, answers);
    if (next === 'end') {
      setReviewing(true);
      pushHistoryStep(true);
      return;
    }
    setDirection('forward');
    goNext();
    pushHistoryStep(false);
  };

  const handleAdvance = () => {
    if (submissionBlocked) return;
    if (isMultiQuestion) {
      const newErrors: Record<string, string> = {};
      for (const q of visibleQuestions) {
        if (!canAttemptAdvance(q, answers[q.id])) {
          newErrors[q.id] = 'Select at least one option.';
          continue;
        }
        const messages = validateQuestion(currentPage, q, answers);
        if (messages.length > 0) newErrors[q.id] = messages[0];
      }
      setFieldErrors(newErrors);
      if (Object.keys(newErrors).length > 0) return;
      advancePastCurrentPage();
      return;
    }

    const question = visibleQuestions[0];
    if (!canAttemptAdvance(question, answers[question.id])) return;
    const messages = validateQuestion(currentPage, question, answers);
    if (messages.length > 0) {
      setErrorMessage(messages[0]);
      return;
    }
    setErrorMessage(undefined);
    advancePastCurrentPage();
  };

  // Re-validates JUST the one question that changed, against the answers it
  // would produce, and clears its error the moment that question alone
  // becomes valid -- not on every keystroke regardless of validity, and not
  // by re-running every other visible question's validation too (those
  // don't change just because a sibling field did). A still-invalid edit
  // leaves the existing message in place rather than replacing it with a
  // different one -- the error only updates on the next real advance
  // attempt (handleAdvance), same as before this change.
  const handleChangeQuestion = (questionId: string, value: unknown) => {
    const nextAnswers = { ...answers, [questionId]: value };
    setAnswers(nextAnswers);

    const question = visibleQuestions.find((q) => q.id === questionId);
    if (!question) return;

    if (isMultiQuestion) {
      if (!(questionId in fieldErrors)) return;
      const stillInvalid = !canAttemptAdvance(question, value) || validateQuestion(currentPage, question, nextAnswers).length > 0;
      if (stillInvalid) return;
      const { [questionId]: _cleared, ...rest } = fieldErrors;
      setFieldErrors(rest);
      return;
    }

    if (!errorMessage) return;
    if (validateQuestion(currentPage, question, nextAnswers).length > 0) return;
    setErrorMessage(undefined);
  };

  const handleSkip = () => {
    // canSkip (below) already hides the Skip button once there's a
    // disqualifying selection -- this mirrors that check defensively, same
    // reasoning as handleAdvance's own canAttemptAdvance guard, so Skip can
    // never become a back door around a disqualifying answer.
    if (submissionBlocked || hasDisqualifyingSelection) return;
    setErrorMessage(undefined);
    advancePastCurrentPage();
  };

  // Routes through the browser's own history (`window.history.back()`)
  // instead of mutating state directly -- the actual restoration (store
  // position, `reviewing`, direction, clearing errors) all happens in the
  // popstate handler above, the SAME place a physical browser Back press
  // lands, so the in-app button and the browser button are indistinguishable
  // once triggered. Does nothing when there's nowhere within this run to go
  // back to (first page, not reviewing) -- calling history.back()
  // unconditionally would instead leave the assessment entirely, back to
  // whatever the host's own previous page was.
  const handleBack = () => {
    if (reviewing || canGoBack) window.history.back();
  };

  const handleEdit = (questionId: string) => {
    const state = storeApi.getState();
    if (!state.survey) return;
    let targetPageId: string | null = null;
    for (const pageId of state.visitedPageStack) {
      const page = state.survey.pages.find((p) => p.id === pageId);
      if (!page) continue;
      if (visibleQuestionsOf(page.questions, state.answers, state.predefinedQuestionIds).some((q) => q.id === questionId)) {
        targetPageId = pageId;
        break;
      }
    }
    if (!targetPageId) {
      setReviewing(false);
      pushHistoryStep(false);
      return;
    }
    // Pop pages off the EXISTING visitedPageStack (via the player store's own
    // goBack, unchanged) until we're back on the target page -- never
    // rewrites the stack directly.
    while (storeApi.getState().currentPageId !== targetPageId && storeApi.getState().visitedPageStack.length > 1) {
      storeApi.getState().goBack();
    }
    setDirection('backward');
    setReviewing(false);
    // A new step, not a browser Back -- opening the editor from review is
    // its own forward-like transition (see pushHistoryStep's own comment),
    // even though it moves the underlying page stack backward.
    pushHistoryStep(false);
  };

  const singleQuestion = visibleQuestions[0];
  const hasDisqualifyingSelection =
    !isMultiQuestion && getDisqualifyingNotices(singleQuestion, answers[singleQuestion.id]).length > 0;
  const canSkip =
    !isMultiQuestion &&
    !singleQuestion.required &&
    singleQuestion.type !== 'label' &&
    // Never skippable regardless of its own `required` flag (which is
    // never actually set true for it anyway) -- same reasoning as
    // canAttemptAdvance's own turnstile case.
    singleQuestion.type !== 'turnstile' &&
    !submissionBlocked &&
    !hasDisqualifyingSelection;

  const reviewItems: ReviewItem[] = reviewing
    ? visitedPageStack
        .flatMap((pageId) => survey.pages.find((p) => p.id === pageId)?.questions ?? [])
        .filter((q) => q.type !== 'label' && isVisible(q, answers, predefinedQuestionIds))
        .map((question) => ({ question, answerText: formatAnswerDisplay(question, answers[question.id]) }))
    : [];

  const liveMessage = errorMessage ?? (reviewing ? 'Review your answers' : `Question ${progress.currentStep} of ${progress.totalSteps}`);

  const bodyContent = reviewing ? (
    <ReviewScreen items={reviewItems} onEdit={handleEdit} onSubmit={() => goNext()} />
  ) : isMultiQuestion ? (
    <MultiQuestionStage
      questions={visibleQuestions}
      pageTitle={currentPage.showTitle ? currentPage.title : undefined}
      answers={answers}
      onChangeQuestion={handleChangeQuestion}
      onAdvance={handleAdvance}
      onBack={handleBack}
      canGoBack={canGoBack}
      canAttemptAdvance={!submissionBlocked && visibleQuestions.every((q) => canAttemptAdvance(q, answers[q.id]))}
      isFinalPage={isFinalPage}
      errors={fieldErrors}
      direction={direction}
    />
  ) : (
    <QuestionStage
      question={singleQuestion}
      categoryLabel={currentPage.showTitle ? currentPage.title : undefined}
      value={answers[singleQuestion.id]}
      onChange={(value) => handleChangeQuestion(singleQuestion.id, value)}
      onAdvance={handleAdvance}
      onBack={handleBack}
      onSkip={handleSkip}
      canGoBack={canGoBack}
      canSkip={canSkip}
      canAttemptAdvance={!submissionBlocked && canAttemptAdvance(singleQuestion, answers[singleQuestion.id])}
      isFinalQuestion={isFinalPage}
      error={errorMessage}
      direction={direction}
    />
  );
  // The same wrapper Box the body has always rendered in (scroll/centering/
  // padding) -- portaled wholesale when `renderAssessmentTo` moves it, so it
  // looks identical wherever it ends up (see SurveyRunnerProps.
  // renderAssessmentTo's own comment: this is a placement change only).
  const bodyBox = (
    <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', alignItems: 'center', px: 3, py: 4 }}>
      {bodyContent}
    </Box>
  );

  return (
    // No bgcolor here deliberately: RunnerHeader paints its own opaque
    // background, but the question/review area below doesn't -- so a
    // host's bgColor background (see SurveyRunner.tsx) shows through there
    // instead of being hidden under a second, redundant opaque layer.
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* No built-in spot for this any more -- hidden unless renderProgressBarTo
          points at a real target (see RunnerShell's own comment on why this
          one defaults to hidden, unlike the quiz body below). */}
      {progressBarTarget &&
        createPortal(
          <div className={portalWrapperClassName(bgColor, 'sbk-progress-bar')}>
            <ProgressRail percent={(progress.currentStep / Math.max(1, progress.totalSteps)) * 100} />
          </div>,
          progressBarTarget,
        )}
      <RunnerHeader
        currentStep={progress.currentStep}
        totalSteps={progress.totalSteps}
        // A full browser navigation, not a client-side route change -- this
        // library has no router of its own (and can't depend on one; see
        // SurveyRunnerProps.exitPath's own comment), so this is the only
        // host-agnostic way to leave. Fine for a same-origin SPA route too,
        // just not as seamless as that host's own client-side navigation.
        onExit={exitPath ? () => window.location.assign(exitPath) : undefined}
        stepsTarget={stepsTarget}
        exitTarget={exitTarget}
        bgColor={bgColor}
      />
      {assessmentTarget === undefined && bodyBox}
      {assessmentTarget &&
        createPortal(<div className={portalWrapperClassName(bgColor, 'sbk-assessment')}>{bodyBox}</div>, assessmentTarget)}
      <Box role="status" aria-live="polite" sx={visuallyHidden}>
        {liveMessage}
      </Box>
    </Box>
  );
}

const visuallyHidden = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0,
} as const;
