import { Alert, AlertTitle, Box, List, ListItem, Typography } from '@mui/material';

// Rendered in place of <SurveyBuilder>/<SurveyRunner> when the `survey` prop
// fails validateSurvey() on mount -- a clear, contained error instead of an
// obscure crash somewhere inside the branching/scoring/flow-map code that
// assumes well-formed data.
export function SurveyValidationError({ errors }: { errors?: string[] }) {
  return (
    <Box sx={{ p: 3, maxWidth: 640 }}>
      <Alert severity="error">
        <AlertTitle>Invalid survey data</AlertTitle>
        <Typography variant="body2" sx={{ mb: errors?.length ? 1 : 0 }}>
          The <code>survey</code> prop doesn't match the shape this component expects.
        </Typography>
        {errors && errors.length > 0 && (
          <List dense sx={{ listStyleType: 'disc', pl: 2 }}>
            {errors.map((err, i) => (
              <ListItem key={i} sx={{ display: 'list-item', p: 0 }}>
                <Typography variant="body2" component="code" sx={{ fontFamily: 'monospace' }}>
                  {err}
                </Typography>
              </ListItem>
            ))}
          </List>
        )}
      </Alert>
    </Box>
  );
}
