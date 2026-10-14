import { Box, Typography, useTheme } from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import type { QuestionControlProps } from './types';

// The same warning-banner treatment the Builder uses for a blocking notice
// card (icon chip + bold heading + body copy, warning tokens), at a larger
// scale befitting a full question-stage screen. No input -- Continue is the
// only affordance.
export function LabelInfoControl({ question }: QuestionControlProps) {
  const theme = useTheme();
  const tokens = theme.custom.warningBanner;

  return (
    <Box
      sx={{
        p: 3,
        borderRadius: 2,
        bgcolor: tokens.bg,
        border: '1px solid',
        borderColor: tokens.border,
        display: 'flex',
        gap: 2,
        alignItems: 'flex-start',
      }}
    >
      <Box
        sx={{
          flexShrink: 0,
          width: 44,
          height: 44,
          borderRadius: 1.5,
          bgcolor: tokens.iconBg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <WarningAmberIcon sx={{ fontSize: 26, color: tokens.icon }} />
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="h6" sx={{ color: tokens.textStrong, fontWeight: 700 }}>
          {question.label}
        </Typography>
        {question.description && (
          <Typography variant="body1" sx={{ color: tokens.text, mt: 0.5 }}>
            {question.description}
          </Typography>
        )}
      </Box>
    </Box>
  );
}
