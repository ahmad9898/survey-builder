import { Box, Button, Link, Stack, Typography } from '@mui/material';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import type { QuestionDef } from '../../../types/survey';

export interface ReviewItem {
  question: QuestionDef;
  answerText: string;
}

export interface ReviewScreenProps {
  items: ReviewItem[];
  onEdit: (questionId: string) => void;
  onSubmit: () => void;
}

// Shown once a respondent reaches the end of the survey, before the final
// submit actually fires -- a scrollable list of question/answer pairs in the
// same card language as the Builder's question cards, each editable without
// losing anything already answered after it.
export function ReviewScreen({ items, onEdit, onSubmit }: ReviewScreenProps) {
  return (
    <Box sx={{ width: '100%', maxWidth: 620, mx: 'auto' }}>
      <Typography sx={{ fontSize: 28, fontWeight: 700, mb: 0.5 }}>Review your answers</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Everything looks good? Submit below, or edit any answer first.
      </Typography>

      <Stack spacing={1.5} sx={{ maxHeight: '55vh', overflowY: 'auto', pr: 0.5 }}>
        {items.map(({ question, answerText }) => (
          <Box
            key={question.id}
            sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: '10px', bgcolor: 'background.paper' }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2" color="text.secondary">
                  {question.label}
                </Typography>
                <Typography sx={{ fontWeight: 600, mt: 0.25, wordBreak: 'break-word' }}>{answerText}</Typography>
              </Box>
              <Link component="button" underline="hover" variant="body2" onClick={() => onEdit(question.id)} sx={{ flexShrink: 0 }}>
                Edit
              </Link>
            </Stack>
          </Box>
        ))}
      </Stack>

      <Stack direction="row" justifyContent="flex-end" sx={{ mt: 4 }}>
        <Button variant="contained" disableElevation endIcon={<ArrowForwardIcon fontSize="small" />} onClick={onSubmit}>
          Submit
        </Button>
      </Stack>
    </Box>
  );
}
