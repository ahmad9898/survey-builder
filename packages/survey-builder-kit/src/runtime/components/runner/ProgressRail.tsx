import { Box } from '@mui/material';

// 3px bar pinned to the very top of the runner, filled portion animating to
// each new progress estimate rather than jumping (see estimateProgress's own
// comment for why the estimate itself can move, not just the index).
export function ProgressRail({ percent }: { percent: number }) {
  return (
    <Box sx={{ position: 'sticky', top: 0, zIndex: 10, height: 3, bgcolor: 'divider' }}>
      <Box
        sx={{
          height: '100%',
          width: `${Math.min(100, Math.max(0, percent))}%`,
          bgcolor: 'primary.main',
          transition: 'width .25s ease',
        }}
      />
    </Box>
  );
}
