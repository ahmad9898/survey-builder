import { Box, Divider, IconButton, Link, Stack, Typography } from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import CheckIcon from '@mui/icons-material/Check';

const MAX_DOTS = 8;

export interface RunnerHeaderProps {
  surveyTitle: string;
  currentStep: number;
  totalSteps: number;
  canGoBack: boolean;
  onBack: () => void;
  /** Shown as the "Exit" link in the header, only when provided -- see SurveyRunnerProps.exitPath, which is what actually supplies this. */
  onExit?: () => void;
}

export function RunnerHeader({ surveyTitle, currentStep, totalSteps, canGoBack, onBack, onExit }: RunnerHeaderProps) {
  const dotCount = Math.min(totalSteps, MAX_DOTS);

  return (
    <Stack
      direction="row"
      alignItems="center"
      justifyContent="space-between"
      sx={{ height: 64, px: { xs: 2, sm: 4 }, borderBottom: '1px solid', borderColor: 'divider' }}
    >
      <Stack direction="row" alignItems="center" spacing={1}>
        <IconButton onClick={onBack} disabled={!canGoBack} size="small" aria-label="Back to previous question">
          <ChevronLeftIcon />
        </IconButton>
        <Box
          sx={{
            width: 28,
            height: 28,
            borderRadius: '8px',
            bgcolor: 'primary.main',
            color: 'primary.contrastText',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <CheckIcon sx={{ fontSize: 16 }} />
        </Box>
        <Typography sx={{ fontWeight: 700, fontSize: 15 }}>{surveyTitle}</Typography>
      </Stack>

      <Stack direction="row" alignItems="center" spacing={1.5}>
        <Typography variant="body2" color="text.secondary">
          {currentStep} of {totalSteps}
        </Typography>
        <Stack direction="row" spacing={0.5} aria-hidden="true">
          {Array.from({ length: dotCount }, (_, i) => i + 1).map((step) => (
            <Box
              key={step}
              sx={{
                width: step === currentStep ? 18 : 6,
                height: 6,
                borderRadius: 3,
                bgcolor: step <= currentStep ? 'primary.main' : 'action.disabledBackground',
                transition: 'width .2s ease, background-color .2s ease',
              }}
            />
          ))}
        </Stack>
        {onExit && (
          <>
            <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
            <Link component="button" underline="hover" color="text.secondary" variant="body2" onClick={onExit}>
              Exit
            </Link>
          </>
        )}
      </Stack>
    </Stack>
  );
}
