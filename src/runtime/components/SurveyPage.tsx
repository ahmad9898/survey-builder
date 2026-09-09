import { JsonForms } from '@jsonforms/react';
import type { ErrorObject } from 'ajv';
import { useEffect, useState } from 'react';
import { Alert, Box, Button, Stack, Typography } from '@mui/material';
import { materialCells } from '@jsonforms/material-renderers';
import { usePlayerStore } from '../store/playerStore';
import { builderRenderers } from '../../renderers';
import { describeValidationErrors } from '../../domain/validationMessages';
import { validateDateAge } from '../../domain/ageValidation';

export function SurveyPage() {
  const survey = usePlayerStore((s) => s.survey);
  const currentPageId = usePlayerStore((s) => s.currentPageId);
  const answers = usePlayerStore((s) => s.answers);
  const setAnswers = usePlayerStore((s) => s.setAnswers);
  const goNext = usePlayerStore((s) => s.goNext);
  const goBack = usePlayerStore((s) => s.goBack);
  const visitedPageStack = usePlayerStore((s) => s.visitedPageStack);

  const [errors, setErrors] = useState<ErrorObject[]>([]);
  // Field-level errors never render inline; instead a summary of custom
  // messages appears at the top of the page when the visitor tries to
  // advance. Resets whenever the page changes.
  const [messages, setMessages] = useState<string[]>([]);

  useEffect(() => {
    setMessages([]);
  }, [currentPageId]);

  if (!survey || !currentPageId) return null;
  const page = survey.pages.find((p) => p.id === currentPageId);
  if (!page) return null;

  const canGoBack = visitedPageStack.length > 1;

  const handleNext = () => {
    const schemaMessages = describeValidationErrors(errors, page.questions).map((m) => m.message);
    // Age is relative to "now", not something AJV's static schema can check,
    // so it's validated separately against the live answers here.
    const ageMessages = page.questions
      .map((q) => validateDateAge(q, answers[q.id]))
      .filter((message): message is string => message !== null);
    const allMessages = [...schemaMessages, ...ageMessages];

    if (allMessages.length > 0) {
      setMessages(allMessages);
      return;
    }
    goNext();
  };

  return (
    <Box sx={{ maxWidth: 640, mx: 'auto', p: 3 }}>
      <Typography variant="h5" gutterBottom>
        {page.title}
      </Typography>
      {messages.length > 0 && (
        <Alert severity="error" sx={{ mb: 2 }}>
          <Stack spacing={0.5}>
            {messages.map((message, i) => (
              <Typography key={i} variant="body2">
                {message}
              </Typography>
            ))}
          </Stack>
        </Alert>
      )}
      <JsonForms
        schema={page.schema}
        uischema={page.uischema}
        data={answers}
        renderers={builderRenderers}
        cells={materialCells}
        validationMode="ValidateAndHide"
        onChange={({ data, errors }) => {
          // The date control (and possibly others) can re-fire onChange with
          // unchanged data shortly after a real edit (e.g. on blur, when
          // focus moves to the Next button) — only clear a just-shown banner
          // when the data has genuinely changed, so that duplicate/delayed
          // call doesn't wipe the message handleNext just set.
          if (JSON.stringify(data) !== JSON.stringify(answers)) {
            setMessages([]);
          }
          setAnswers(data);
          setErrors(errors ?? []);
        }}
      />
      <Stack direction="row" spacing={2} sx={{ mt: 3 }}>
        <Button variant="outlined" disabled={!canGoBack} onClick={goBack}>
          Back
        </Button>
        <Button variant="contained" onClick={handleNext}>
          Next
        </Button>
      </Stack>
    </Box>
  );
}
