import { useCallback, useRef, useState } from 'react';
import { Box } from '@mui/material';
import { usePlayerStore, usePlayerStoreApi } from '../../store/playerStore';
import { resolveNextPage } from '../../../domain/branchingEngine';
import { evaluateConditionGroup } from '../../../domain/conditionEvaluator';
import { estimateProgress } from '../../../domain/flowLayout';
import { formatAnswerDisplay } from '../../../domain/answerFormatting';
import type { QuestionDef } from '../../../types/survey';
import { ProgressRail } from './ProgressRail';
import { RunnerHeader } from './RunnerHeader';
import { QuestionStage, type StageDirection } from './QuestionStage';
import { MultiQuestionStage } from './MultiQuestionStage';
import { ReviewScreen, type ReviewItem } from './ReviewScreen';
import { validateQuestion, canAttemptAdvance, getDisqualifyingNotices } from './questionValidation';

function isVisible(question: QuestionDef, answers: Record<string, unknown>): boolean {
  return !question.visibilityRule || evaluateConditionGroup(question.visibilityRule, answers);
}

function visibleQuestionsOf(questions: QuestionDef[], answers: Record<string, unknown>): QuestionDef[] {
  return questions.filter((q) => isVisible(q, answers));
}

// The runner's atomic step is a PAGE: a page with exactly one visible
// question gets the full-screen single-question treatment (QuestionStage);
// a page with more than one shows them all together on one screen
// (MultiQuestionStage) rather than splitting fields that belong together
// (e.g. "Weight & Height") into separate steps.
export function RunnerShell({ exitPath }: { exitPath?: string }) {
  const survey = usePlayerStore((s) => s.survey);
  const currentPageId = usePlayerStore((s) => s.currentPageId);
  const answers = usePlayerStore((s) => s.answers);
  const visitedPageStack = usePlayerStore((s) => s.visitedPageStack);
  const setAnswers = usePlayerStore((s) => s.setAnswers);
  const goNext = usePlayerStore((s) => s.goNext);
  const goBack = usePlayerStore((s) => s.goBack);
  const storeApi = usePlayerStoreApi();

  const [direction, setDirection] = useState<StageDirection>('forward');
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [reviewing, setReviewing] = useState(false);

  if (!survey || !currentPageId) return null;
  const currentPage = survey.pages.find((p) => p.id === currentPageId);
  if (!currentPage) return null;

  const visibleQuestions = visibleQuestionsOf(currentPage.questions, answers);
  if (visibleQuestions.length === 0) {
    // Nothing to show on this page (every question hidden by a visibility
    // rule) -- move straight on rather than showing an empty screen.
    goNext();
    return null;
  }
  const isMultiQuestion = visibleQuestions.length > 1;
  const canGoBack = visitedPageStack.length > 1;

  const progress = estimateProgress(survey, visitedPageStack);
  const isFinalPage = resolveNextPage(currentPage, answers) === 'end';
  // A page marked "blocks submission" (a disqualification/referral notice)
  // is a hard stop -- there's no Continue/Submit past it, not even a
  // Review/Submit screen.
  const pageBlocksSubmission = !!currentPage.blocksSubmission;

  const advancePastCurrentPage = () => {
    const next = resolveNextPage(currentPage, answers);
    if (next === 'end') {
      setReviewing(true);
      return;
    }
    setDirection('forward');
    goNext();
  };

  const handleAdvance = () => {
    if (pageBlocksSubmission) return;
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

  // A few single-question controls (Boolean, SingleChoiceFew, RatingScale)
  // call their `onAdvance` prop from inside a short setTimeout so the
  // selected state is visible first. That timeout captures whatever specific
  // `handleAdvance` function instance was current AT CLICK TIME -- but
  // `onChange` for that same click only lands in `answers` on the NEXT
  // render, after which this whole component re-creates `handleAdvance` with
  // the updated closure. Without this indirection the delayed call would
  // validate against the answers as of BEFORE the click (e.g. a boolean
  // `false` read back as "missing"). Routing every advance through a stable
  // ref fixes that: the ref is updated on every render, so whichever
  // instance's timeout fires always calls the LATEST handleAdvance.
  const handleAdvanceRef = useRef(handleAdvance);
  handleAdvanceRef.current = handleAdvance;
  const stableAdvance = useCallback(() => handleAdvanceRef.current(), []);

  const handleSkip = () => {
    // canSkip (below) already hides the Skip button once there's a
    // disqualifying selection -- this mirrors that check defensively, same
    // reasoning as handleAdvance's own canAttemptAdvance guard, so Skip can
    // never become a back door around a disqualifying answer.
    if (pageBlocksSubmission || hasDisqualifyingSelection) return;
    setErrorMessage(undefined);
    advancePastCurrentPage();
  };

  const handleBack = () => {
    if (reviewing) {
      setReviewing(false);
      return;
    }
    setErrorMessage(undefined);
    setFieldErrors({});
    if (!canGoBack) return;
    setDirection('backward');
    goBack();
  };

  const handleEdit = (questionId: string) => {
    const state = storeApi.getState();
    if (!state.survey) return;
    let targetPageId: string | null = null;
    for (const pageId of state.visitedPageStack) {
      const page = state.survey.pages.find((p) => p.id === pageId);
      if (!page) continue;
      if (visibleQuestionsOf(page.questions, state.answers).some((q) => q.id === questionId)) {
        targetPageId = pageId;
        break;
      }
    }
    if (!targetPageId) {
      setReviewing(false);
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
  };

  const singleQuestion = visibleQuestions[0];
  const hasDisqualifyingSelection =
    !isMultiQuestion && getDisqualifyingNotices(singleQuestion, answers[singleQuestion.id]).length > 0;
  const canSkip =
    !isMultiQuestion &&
    !singleQuestion.required &&
    singleQuestion.type !== 'label' &&
    !pageBlocksSubmission &&
    !hasDisqualifyingSelection;

  const reviewItems: ReviewItem[] = reviewing
    ? visitedPageStack
        .flatMap((pageId) => survey.pages.find((p) => p.id === pageId)?.questions ?? [])
        .filter((q) => q.type !== 'label' && isVisible(q, answers))
        .map((question) => ({ question, answerText: formatAnswerDisplay(question, answers[question.id]) }))
    : [];

  const liveMessage = errorMessage ?? (reviewing ? 'Review your answers' : `Question ${progress.currentStep} of ${progress.totalSteps}`);

  return (
    // No bgcolor here deliberately: RunnerHeader paints its own opaque
    // background, but the question/review area below doesn't -- so a
    // host's bgColor background (see SurveyRunner.tsx) shows through there
    // instead of being hidden under a second, redundant opaque layer.
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <ProgressRail percent={(progress.currentStep / Math.max(1, progress.totalSteps)) * 100} />
      <RunnerHeader
        surveyTitle={survey.title}
        currentStep={progress.currentStep}
        totalSteps={progress.totalSteps}
        canGoBack={reviewing || canGoBack}
        onBack={handleBack}
        // A full browser navigation, not a client-side route change -- this
        // library has no router of its own (and can't depend on one; see
        // SurveyRunnerProps.exitPath's own comment), so this is the only
        // host-agnostic way to leave. Fine for a same-origin SPA route too,
        // just not as seamless as that host's own client-side navigation.
        onExit={exitPath ? () => window.location.assign(exitPath) : undefined}
      />
      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', alignItems: 'center', px: 3, py: 4 }}>
        {reviewing ? (
          <ReviewScreen items={reviewItems} onEdit={handleEdit} onSubmit={() => goNext()} />
        ) : isMultiQuestion ? (
          <MultiQuestionStage
            questions={visibleQuestions}
            pageTitle={currentPage.title}
            pageNumber={progress.currentStep}
            answers={answers}
            onChangeQuestion={(id, value) => setAnswers({ ...answers, [id]: value })}
            onAdvance={stableAdvance}
            onBack={handleBack}
            canGoBack={canGoBack}
            canAttemptAdvance={!pageBlocksSubmission && visibleQuestions.every((q) => canAttemptAdvance(q, answers[q.id]))}
            isFinalPage={isFinalPage}
            errors={fieldErrors}
            direction={direction}
          />
        ) : (
          <QuestionStage
            question={singleQuestion}
            questionNumber={progress.currentStep}
            categoryLabel={currentPage.title}
            value={answers[singleQuestion.id]}
            onChange={(value) => setAnswers({ ...answers, [singleQuestion.id]: value })}
            onAdvance={stableAdvance}
            onBack={handleBack}
            onSkip={handleSkip}
            canGoBack={canGoBack}
            canSkip={canSkip}
            canAttemptAdvance={!pageBlocksSubmission && canAttemptAdvance(singleQuestion, answers[singleQuestion.id])}
            isFinalQuestion={isFinalPage}
            error={errorMessage}
            direction={direction}
          />
        )}
      </Box>
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
