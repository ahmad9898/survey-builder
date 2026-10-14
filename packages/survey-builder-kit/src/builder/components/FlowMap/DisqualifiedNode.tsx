import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Box, Typography, useTheme } from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

// The shared terminal every disqualifying-option edge points at (see
// DISQUALIFIED_NODE_ID in flowLayout.ts) -- one "Disqualified" outcome for
// the whole survey, not one per question, the same way there's one Start
// pill regardless of how many pages exist. Distinct from a blocksSubmission
// page (a real page node with its own content); this pill has none -- it's
// purely the destination of an answer that ends things right there.
export const DisqualifiedNode = memo(function DisqualifiedNode() {
  const theme = useTheme();
  const tokens = theme.custom.warningBanner;
  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.5,
        px: 1.25,
        py: 0.6,
        borderRadius: 999,
        bgcolor: tokens.bg,
        border: `1px solid ${tokens.icon}`,
        boxShadow: '0 1px 2px rgba(16,24,40,0.04)',
      }}
    >
      <Handle id="target" type="target" position={Position.Left} style={{ opacity: 0 }} />
      <WarningAmberIcon sx={{ fontSize: 13, color: tokens.icon }} />
      <Typography variant="caption" sx={{ fontWeight: 700, fontSize: 10, letterSpacing: 0.3, color: tokens.textStrong }}>
        DISQUALIFIED
      </Typography>
    </Box>
  );
});
