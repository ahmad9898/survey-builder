import { Alert, AlertTitle, Typography } from '@mui/material';
import type { QuestionControlProps } from './types';

// Per the explicit instruction behind this redesign: an unmapped QuestionType
// must never silently fall back to a guessed layout. This is a loud,
// clearly-marked dev-only state -- a real respondent should never see it; if
// one does, it means the compiler started emitting a type this runner's
// control registry doesn't know about yet.
export function UnsupportedControl({ question }: QuestionControlProps) {
  return (
    <Alert severity="error" variant="outlined">
      <AlertTitle>Unsupported question type</AlertTitle>
      <Typography variant="body2">
        Question <code>{question.id}</code> has type <code>{question.type}</code>, which this runner has no control
        for. This is a developer-facing error, not something a respondent should ever see.
      </Typography>
    </Alert>
  );
}
