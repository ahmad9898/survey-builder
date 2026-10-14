import { Box, Button, Chip, Divider, Stack, Typography } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { usePlayerStore } from '../../store/playerStore';

// Replaces the question stage once the survey is actually submitted -- a
// simple centered confirmation, restyled to the same tokens as the rest of
// the redesign rather than the raw answers-JSON dump the old ResultsScreen
// showed (a respondent was never meant to see that; the host already gets
// the same data back via onSubmit).
export function SubmittedScreen() {
  const score = usePlayerStore((s) => s.score);
  const reset = usePlayerStore((s) => s.reset);

  return (
    <Box sx={{ width: '100%', maxWidth: 480, mx: 'auto', textAlign: 'center' }}>
      <Box
        sx={{
          width: 64,
          height: 64,
          mx: 'auto',
          mb: 3,
          borderRadius: '50%',
          bgcolor: 'success.light',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <CheckCircleIcon sx={{ fontSize: 36, color: 'success.main' }} />
      </Box>
      <Typography sx={{ fontSize: 28, fontWeight: 700, mb: 1 }}>Thanks for completing the survey!</Typography>
      <Typography variant="body2" color="text.secondary">
        Your answers have been submitted.
      </Typography>

      {score && (
        <Box sx={{ mt: 4, p: 2.5, border: '1px solid', borderColor: 'divider', borderRadius: '10px', textAlign: 'left' }}>
          <Stack direction="row" alignItems="center" spacing={2}>
            <Typography sx={{ fontSize: 28, fontWeight: 700 }}>{score.total}</Typography>
            <Typography variant="body2" color="text.secondary">
              total points
            </Typography>
            {score.passed !== undefined && (
              <Chip label={score.passed ? 'Passed' : 'Did not pass'} color={score.passed ? 'success' : 'default'} size="small" />
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

      <Button variant="outlined" onClick={reset} sx={{ mt: 4 }}>
        Retake
      </Button>
    </Box>
  );
}
