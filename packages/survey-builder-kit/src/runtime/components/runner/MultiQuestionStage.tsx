import { Box, Button, Stack, Typography } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import type { QuestionDef } from '../../../types/survey';
import { controlForQuestion } from './controls';
import type { StageDirection } from './QuestionStage';
import { getDisqualifyingNotices } from './questionValidation';
import { DisqualifyingBanner } from './DisqualifyingBanner';

export interface MultiQuestionStageProps {
  questions: QuestionDef[];
  pageTitle: string;
  pageNumber: number; // 1-based, across the whole survey -- the first of this page's questions
  answers: Record<string, unknown>;
  onChangeQuestion: (questionId: string, value: unknown) => void;
  onAdvance: () => void;
  onBack: () => void;
  canGoBack: boolean;
  canAttemptAdvance: boolean;
  isFinalPage: boolean;
  errors: Record<string, string>;
  direction: StageDirection;
}

// A page with more than one visible question is shown as one step, not
// split further -- fields that genuinely belong together (e.g. "Weight &
// Height") stay together, the same way the Builder groups them on one page.
// Unlike the single-question stage, selecting an option here never auto-
// advances (there's more to fill in), and there's no "press ↵"/Skip
// affordance -- Continue validates every visible question on the page at
// once.
export function MultiQuestionStage({
  questions,
  pageTitle,
  pageNumber,
  answers,
  onChangeQuestion,
  onAdvance,
  onBack,
  canGoBack,
  canAttemptAdvance,
  isFinalPage,
  errors,
  direction,
}: MultiQuestionStageProps) {
  const noop = () => {};

  return (
    <Box
      key={questions.map((q) => q.id).join('|')}
      sx={{
        width: '100%',
        maxWidth: 620,
        mx: 'auto',
        animation: `${direction === 'forward' ? 'sbkRunnerSlideInForward' : 'sbkRunnerSlideInBackward'} 220ms ease`,
        '@keyframes sbkRunnerSlideInForward': {
          from: { opacity: 0, transform: 'translateX(12px)' },
          to: { opacity: 1, transform: 'translateX(0)' },
        },
        '@keyframes sbkRunnerSlideInBackward': {
          from: { opacity: 0, transform: 'translateX(-12px)' },
          to: { opacity: 1, transform: 'translateX(0)' },
        },
        '@media (prefers-reduced-motion: reduce)': { animationName: 'sbkRunnerFadeIn' },
        '@keyframes sbkRunnerFadeIn': { from: { opacity: 0 }, to: { opacity: 1 } },
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 1.5 }}>
        <Typography sx={{ color: 'primary.main', fontWeight: 700, fontSize: 15 }}>
          {String(pageNumber).padStart(2, '0')}
        </Typography>
      </Stack>

      <Typography sx={{ fontSize: { xs: 26, sm: 34 }, fontWeight: 700, letterSpacing: '-0.01em', lineHeight: 1.2, mb: 4 }}>
        {pageTitle}
      </Typography>

      <Stack spacing={4}>
        {questions.map((question) => {
          const Control = controlForQuestion(question);
          const isInformational = question.type === 'label';
          const error = errors[question.id];
          const disqualifyingNotices = getDisqualifyingNotices(question, answers[question.id]);
          return (
            <Box key={question.id}>
              {!isInformational && (
                <Typography sx={{ fontSize: 17, fontWeight: 600, mb: question.description ? 0.5 : 1.5 }}>
                  {question.label}
                </Typography>
              )}
              {!isInformational && question.description && (
                <Typography sx={{ fontSize: 14, color: question.descriptionColor || 'text.secondary', mb: 1.5 }}>
                  {question.description}
                </Typography>
              )}
              <Control
                question={question}
                value={answers[question.id]}
                onChange={(value) => onChangeQuestion(question.id, value)}
                onAdvance={noop}
              />
              <DisqualifyingBanner notices={disqualifyingNotices} />
              {error && (
                <Typography
                  role="alert"
                  sx={{
                    mt: 1,
                    color: 'error.main',
                    fontSize: 14,
                    animation: 'sbkRunnerErrorFadeIn 150ms ease',
                    '@keyframes sbkRunnerErrorFadeIn': { from: { opacity: 0 }, to: { opacity: 1 } },
                  }}
                >
                  {error}
                </Typography>
              )}
            </Box>
          );
        })}
      </Stack>

      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mt: 4 }}>
        <Button
          startIcon={<ArrowBackIcon fontSize="small" />}
          onClick={onBack}
          disabled={!canGoBack}
          sx={{ color: 'text.secondary', visibility: canGoBack ? 'visible' : 'hidden' }}
        >
          Back
        </Button>
        <Button
          variant="contained"
          disableElevation
          endIcon={<ArrowForwardIcon fontSize="small" />}
          onClick={onAdvance}
          disabled={!canAttemptAdvance}
        >
          {isFinalPage ? 'Submit' : 'Continue'}
        </Button>
      </Stack>
    </Box>
  );
}
