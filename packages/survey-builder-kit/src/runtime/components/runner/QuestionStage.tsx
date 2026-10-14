import { Box, Button, Stack, Typography } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import KeyboardReturnIcon from '@mui/icons-material/KeyboardReturn';
import type { QuestionDef } from '../../../types/survey';
import { controlForQuestion } from './controls';
import { getDisqualifyingNotices } from './questionValidation';
import { DisqualifyingBanner } from './DisqualifyingBanner';

export type StageDirection = 'forward' | 'backward';

export interface QuestionStageProps {
  question: QuestionDef;
  questionNumber: number; // 1-based, across the whole survey
  categoryLabel?: string;
  value: unknown;
  onChange: (value: unknown) => void;
  onAdvance: () => void;
  onBack: () => void;
  onSkip: () => void;
  canGoBack: boolean;
  canSkip: boolean;
  canAttemptAdvance: boolean;
  isFinalQuestion: boolean;
  error?: string;
  direction: StageDirection;
}

export function QuestionStage({
  question,
  questionNumber,
  categoryLabel,
  value,
  onChange,
  onAdvance,
  onBack,
  onSkip,
  canGoBack,
  canSkip,
  canAttemptAdvance,
  isFinalQuestion,
  error,
  direction,
}: QuestionStageProps) {
  const Control = controlForQuestion(question);
  const isInformational = question.type === 'label';
  const continueHint = question.type === 'longText' ? '⌘/Ctrl + ↵' : '↵';
  const disqualifyingNotices = getDisqualifyingNotices(question, value);

  return (
    <Box
      key={question.id}
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
        '@media (prefers-reduced-motion: reduce)': {
          animationName: 'sbkRunnerFadeIn',
        },
        '@keyframes sbkRunnerFadeIn': {
          from: { opacity: 0 },
          to: { opacity: 1 },
        },
      }}
    >
      {!isInformational && (
        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 1.5 }}>
          <Typography sx={{ color: 'primary.main', fontWeight: 700, fontSize: 15 }}>
            {String(questionNumber).padStart(2, '0')}
          </Typography>
          {categoryLabel && (
            <>
              <Box sx={{ width: 20, height: 1, bgcolor: 'divider' }} />
              <Typography variant="body2" color="text.secondary">
                {categoryLabel}
              </Typography>
            </>
          )}
        </Stack>
      )}

      {!isInformational && (
        <Typography
          sx={{
            fontSize: { xs: 26, sm: 34 },
            fontWeight: 700,
            letterSpacing: '-0.01em',
            lineHeight: 1.2,
            mb: question.description ? 1 : 3,
          }}
        >
          {question.label}
        </Typography>
      )}

      {!isInformational && question.description && (
        <Typography sx={{ fontSize: 14.5, color: 'text.secondary', mb: 3 }}>{question.description}</Typography>
      )}

      <Control question={question} value={value} onChange={onChange} onAdvance={onAdvance} autoFocus />

      <DisqualifyingBanner notices={disqualifyingNotices} />

      {error && (
        <Typography
          role="alert"
          sx={{
            mt: 1.5,
            color: 'error.main',
            fontSize: 14,
            animation: 'sbkRunnerErrorFadeIn 150ms ease',
            '@keyframes sbkRunnerErrorFadeIn': { from: { opacity: 0 }, to: { opacity: 1 } },
          }}
        >
          {error}
        </Typography>
      )}

      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mt: 4 }}>
        <Button
          startIcon={<ArrowBackIcon fontSize="small" />}
          onClick={onBack}
          disabled={!canGoBack}
          sx={{ color: 'text.secondary', visibility: canGoBack ? 'visible' : 'hidden' }}
        >
          Back
        </Button>

        <Stack direction="row" alignItems="center" spacing={2}>
          {canSkip && (
            <Button onClick={onSkip} sx={{ color: 'text.secondary', textTransform: 'none' }}>
              Skip
            </Button>
          )}
          {!isInformational && canAttemptAdvance && (
            <Stack direction="row" alignItems="center" spacing={0.5} sx={{ color: 'text.secondary', fontSize: 13 }}>
              <span>press</span>
              <Box
                component="span"
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  px: 0.75,
                  py: 0.25,
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 0.75,
                  fontSize: 12,
                }}
              >
                {question.type === 'longText' ? continueHint : <KeyboardReturnIcon sx={{ fontSize: 14 }} />}
              </Box>
            </Stack>
          )}
          <Button
            variant="contained"
            disableElevation
            endIcon={<ArrowForwardIcon fontSize="small" />}
            onClick={onAdvance}
            disabled={!canAttemptAdvance}
          >
            {isFinalQuestion ? 'Submit' : 'Continue'}
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}
