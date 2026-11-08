import { useEffect, useState } from 'react';
import { Box, Drawer, IconButton, Stack, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useBuilderStore } from '../store/builderStore';
import { evaluateConditionGroup } from '../../domain/conditionEvaluator';
import { resolveNextPage, isPageBlockedByRule } from '../../domain/branchingEngine';
import { QuestionStage } from '../../runtime/components/runner/QuestionStage';
import { MultiQuestionStage } from '../../runtime/components/runner/MultiQuestionStage';
import { validateQuestion, canAttemptAdvance } from '../../runtime/components/runner/questionValidation';
import type { QuestionDef, SurveyPage } from '../../types/survey';

function visibleQuestionsOf(questions: QuestionDef[], answers: Record<string, unknown>): QuestionDef[] {
  return questions.filter((q) => !q.visibilityRule || evaluateConditionGroup(q.visibilityRule, answers));
}

// Renders the current page with the exact same components <SurveyRunner>
// itself uses (QuestionStage/MultiQuestionStage, and through them every
// per-type control) -- not a separate JSONForms-driven approximation that
// can drift from what a respondent actually sees. The only things this
// deliberately fakes, since there's no real multi-page survey to navigate
// here, are Back (always hidden -- there's nothing before this one page)
// and Skip (always hidden -- "skip to the next page" has no meaning when
// there's no next page); Continue/Submit still runs the exact same
// validation and shows the exact same inline errors it would in the runner.
export function PreviewDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const survey = useBuilderStore((s) => s.survey);
  const selectedPageId = useBuilderStore((s) => s.selectedPageId);
  const page = survey.pages.find((p) => p.id === selectedPageId);

  // Ephemeral, builder-only sample data so the author can click through
  // choices and see SHOW/HIDE rules, disqualifying-option banners, and
  // validation messages fire live, reset whenever the page changes.
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setAnswers({});
    setErrorMessage(undefined);
    setFieldErrors({});
  }, [page?.id]);

  const visibleQuestions = page ? visibleQuestionsOf(page.questions, answers) : [];
  const isMultiQuestion = visibleQuestions.length > 1;
  const singleQuestion = visibleQuestions[0];

  const handleAdvance = (currentPage: SurveyPage) => {
    const submissionBlocked = !!currentPage.blocksSubmission || isPageBlockedByRule(currentPage, answers);
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
      return;
    }

    if (!singleQuestion || !canAttemptAdvance(singleQuestion, answers[singleQuestion.id])) return;
    const messages = validateQuestion(currentPage, singleQuestion, answers);
    setErrorMessage(messages[0]);
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      slotProps={{ paper: { sx: { width: 420, display: 'flex', flexDirection: 'column' } } }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ p: 2.5, pb: 1.5, flexShrink: 0 }}>
        <Typography variant="subtitle1">Live preview</Typography>
        <IconButton size="small" onClick={onClose} aria-label="Close preview">
          <CloseIcon fontSize="small" />
        </IconButton>
      </Stack>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', px: 2.5, mb: 2, flexShrink: 0 }}>
        {page?.title ?? 'Current page'} — try answering to see conditional questions appear.
      </Typography>
      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', px: 2.5, pb: 3 }}>
        {!page || page.questions.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            Add questions to see a preview.
          </Typography>
        ) : visibleQuestions.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No questions are visible with the current answers.
          </Typography>
        ) : isMultiQuestion ? (
          <MultiQuestionStage
            key={page.id}
            questions={visibleQuestions}
            pageTitle={page.showTitle ? page.title : undefined}
            answers={answers}
            onChangeQuestion={(id, value) => setAnswers({ ...answers, [id]: value })}
            onAdvance={() => handleAdvance(page)}
            onBack={() => {}}
            canGoBack={false}
            canAttemptAdvance={
              !page.blocksSubmission &&
              !isPageBlockedByRule(page, answers) &&
              visibleQuestions.every((q) => canAttemptAdvance(q, answers[q.id]))
            }
            isFinalPage={resolveNextPage(page, answers) === 'end'}
            errors={fieldErrors}
            direction="forward"
          />
        ) : (
          <QuestionStage
            key={page.id}
            question={singleQuestion}
            categoryLabel={page.showTitle ? page.title : undefined}
            value={answers[singleQuestion.id]}
            onChange={(value) => setAnswers({ ...answers, [singleQuestion.id]: value })}
            onAdvance={() => handleAdvance(page)}
            onBack={() => {}}
            onSkip={() => {}}
            canGoBack={false}
            canSkip={false}
            canAttemptAdvance={
              !page.blocksSubmission && !isPageBlockedByRule(page, answers) && canAttemptAdvance(singleQuestion, answers[singleQuestion.id])
            }
            isFinalQuestion={resolveNextPage(page, answers) === 'end'}
            error={errorMessage}
            direction="forward"
          />
        )}
      </Box>
    </Drawer>
  );
}
