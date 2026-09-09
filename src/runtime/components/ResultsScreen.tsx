import { Box, Button, Chip, Divider, Stack, Typography } from '@mui/material';
import { usePlayerStore } from '../store/playerStore';

export function ResultsScreen() {
  const answers = usePlayerStore((s) => s.answers);
  const score = usePlayerStore((s) => s.score);
  const reset = usePlayerStore((s) => s.reset);

  return (
    <Box sx={{ maxWidth: 640, mx: 'auto', p: 3 }}>
      <Typography variant="h5" gutterBottom>
        Thanks for completing the survey!
      </Typography>

      {score && (
        <Box sx={{ my: 2, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
          <Stack direction="row" alignItems="center" spacing={2}>
            <Typography variant="h4">{score.total}</Typography>
            <Typography variant="body2" color="text.secondary">
              total points
            </Typography>
            {score.passed !== undefined && (
              <Chip
                label={score.passed ? 'Passed' : 'Did not pass'}
                color={score.passed ? 'success' : 'default'}
                size="small"
              />
            )}
          </Stack>
          {score.byCategory.length > 0 && (
            <>
              <Divider sx={{ my: 1.5 }} />
              <Stack spacing={0.5}>
                {score.byCategory.map((c) => (
                  <Stack direction="row" justifyContent="space-between" key={c.categoryId}>
                    <Typography variant="body2">{c.label}</Typography>
                    <Typography variant="body2">{c.points}</Typography>
                  </Stack>
                ))}
              </Stack>
            </>
          )}
        </Box>
      )}

      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
        Your answers
      </Typography>
      <Typography variant="body2" component="pre" sx={{ whiteSpace: 'pre-wrap' }}>
        {JSON.stringify(answers, null, 2)}
      </Typography>
      <Stack direction="row" spacing={2} sx={{ mt: 3 }}>
        <Button variant="outlined" onClick={reset}>
          Retake
        </Button>
      </Stack>
    </Box>
  );
}
