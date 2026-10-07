import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Box, Typography, useTheme } from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';

// The pill that marks whichever page the player runtime actually opens on
// first (survey.startPageId). A real node in the graph -- not styling on the
// first page node -- so it reads as an unmissable starting point even before
// looking at any page's content, and so it gets its own reserved space from
// dagre (see START_NODE_ID in flowLayout.ts) instead of overlapping whatever
// happens to be nearby. Memoized like the other node/edge types, though it
// takes no props that ever change -- it only ever re-renders on a theme swap.
export const StartNode = memo(function StartNode() {
  const theme = useTheme();
  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.5,
        px: 1.25,
        py: 0.6,
        borderRadius: 999,
        bgcolor: theme.custom.successBanner.bg,
        border: `1px solid ${theme.custom.successBanner.text}`,
        boxShadow: '0 1px 2px rgba(16,24,40,0.04)',
      }}
    >
      <PlayArrowIcon sx={{ fontSize: 13, color: theme.custom.successBanner.text }} />
      <Typography
        variant="caption"
        sx={{ fontWeight: 700, fontSize: 10, letterSpacing: 0.3, color: theme.custom.successBanner.text }}
      >
        START
      </Typography>
      <Handle id="source" type="source" position={Position.Right} style={{ opacity: 0 }} />
    </Box>
  );
});
