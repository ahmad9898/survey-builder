import { createPortal } from 'react-dom';
import { Box, Link, Stack, Typography } from '@mui/material';
import { portalWrapperClassName, type ResolvedPortalTarget } from './usePortalTarget';

const MAX_DOTS = 8;

export interface RunnerHeaderProps {
  currentStep: number;
  totalSteps: number;
  /** Shown as the "Exit" link in the header, only when provided -- see SurveyRunnerProps.exitPath, which is what actually supplies this. */
  onExit?: () => void;
  /**
   * Resolved SurveyRunnerProps.renderStepsTo -- unlike most `render*To`
   * pieces, this one has no built-in spot to fall back to: RunnerShell
   * already coerces an omitted prop to `null` before resolving it (see its
   * own comment), so this is only ever `null` (don't render) or a real
   * `Element` (portal there) by the time it reaches this component.
   */
  stepsTarget: ResolvedPortalTarget;
  /** Resolved SurveyRunnerProps.renderExitTo -- same `null`-or-`Element` shape as `stepsTarget` above. */
  exitTarget: ResolvedPortalTarget;
  /** See SurveyRunnerProps.bgColor -- only used to stamp it on a portaled piece's wrapper (see portalWrapperClassName). */
  bgColor?: string;
}

// No built-in header bar any more -- the Back button + survey title that
// used to live here were deleted outright (not just hidden behind a prop).
// Back-navigation is still available per-question, via QuestionStage/
// MultiQuestionStage's own Back button. The step counter + dots and the
// Exit link still have no built-in spot of their own either (see
// RunnerShell) -- the only way to see either is to portal it somewhere via
// renderStepsTo/renderExitTo.
export function RunnerHeader({ currentStep, totalSteps, onExit, stepsTarget, exitTarget, bgColor }: RunnerHeaderProps) {
  const dotCount = Math.min(totalSteps, MAX_DOTS);

  const stepsContent = (
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
    </Stack>
  );

  // Only matters when `exitPath` is set at all (that's what makes `onExit`
  // defined in the first place) -- with no `exitPath`, this is `null`
  // regardless of `exitTarget`, so Exit stays hidden wherever it would go,
  // same as before this feature existed.
  const exitContent = onExit ? (
    <Link component="button" underline="hover" color="text.secondary" variant="body2" onClick={onExit}>
      Exit
    </Link>
  ) : null;

  return (
    <>
      {stepsTarget &&
        createPortal(<div className={portalWrapperClassName(bgColor, 'sbk-steps')}>{stepsContent}</div>, stepsTarget)}
      {exitContent &&
        exitTarget &&
        createPortal(<div className={portalWrapperClassName(bgColor, 'sbk-exit')}>{exitContent}</div>, exitTarget)}
    </>
  );
}
