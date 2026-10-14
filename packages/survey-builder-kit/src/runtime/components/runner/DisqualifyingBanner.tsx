import { Box, Stack, Typography, useTheme } from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import type { DisqualifyingNotice } from '../../../types/survey';

// Same warning-banner visual language as the informational/label question
// treatment (icon chip + bold title + body copy, warning tokens) -- shown
// directly below a choice question's option list when the current selection
// includes one or more options flagged disqualifying
// (QuestionDef.disqualifyingOptions). Multiple simultaneously-selected
// disqualifying options (multi-select) each get their own title/body block,
// in the options' own list order.
export function DisqualifyingBanner({ notices }: { notices: DisqualifyingNotice[] }) {
  const tokens = useTheme().custom.warningBanner;
  if (notices.length === 0) return null;

  return (
    <Box
      role="alert"
      sx={{
        mt: 2,
        p: 2,
        borderRadius: 1.5,
        bgcolor: tokens.bg,
        border: '1px solid',
        borderColor: tokens.border,
        display: 'flex',
        gap: 1.5,
        animation: 'sbkDisqualifyFadeIn 150ms ease',
        '@keyframes sbkDisqualifyFadeIn': { from: { opacity: 0 }, to: { opacity: 1 } },
      }}
    >
      <Box
        sx={{
          flexShrink: 0,
          width: 28,
          height: 28,
          borderRadius: 1,
          bgcolor: tokens.iconBg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <WarningAmberIcon sx={{ fontSize: 18, color: tokens.icon }} />
      </Box>
      <Stack spacing={1.5} sx={{ minWidth: 0 }}>
        {notices.map((notice, i) => (
          <Box key={i}>
            <Typography variant="subtitle2" sx={{ color: tokens.textStrong, fontWeight: 700 }}>
              {notice.title}
            </Typography>
            {notice.body && (
              <Typography variant="body2" sx={{ color: tokens.text, mt: 0.25 }}>
                {notice.body}
              </Typography>
            )}
          </Box>
        ))}
      </Stack>
    </Box>
  );
}
