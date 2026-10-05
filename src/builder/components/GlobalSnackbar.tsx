import { Alert, Snackbar } from '@mui/material';
import { useSnackbarStore } from '../store/snackbarStore';

export function GlobalSnackbar() {
  const message = useSnackbarStore((s) => s.message);
  const severity = useSnackbarStore((s) => s.severity);
  const clear = useSnackbarStore((s) => s.clear);

  return (
    <Snackbar
      open={message !== null}
      autoHideDuration={4000}
      onClose={clear}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
    >
      <Alert severity={severity} onClose={clear} variant="filled" sx={{ width: '100%' }}>
        {message}
      </Alert>
    </Snackbar>
  );
}
