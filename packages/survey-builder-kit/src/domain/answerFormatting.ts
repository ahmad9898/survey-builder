import dayjs from 'dayjs';
import type { QuestionDef } from '../types/survey';

// Shared by the runner's own pre-submit Review screen and
// buildResponsePayload's `displayValue` -- one formatter, so the summary a
// respondent reviews before submitting and the `displayValue` saved into
// the response can't drift apart.
export function formatAnswerDisplay(question: QuestionDef, value: unknown): string {
  if (value === undefined || value === null || value === '') return '(skipped)';
  if (question.type === 'boolean') return value ? 'Yes' : 'No';
  if (question.type === 'date' && typeof value === 'string') {
    const parsed = dayjs(value);
    return parsed.isValid() ? parsed.format('MMMM D, YYYY') : String(value);
  }
  if (Array.isArray(value)) return value.length > 0 ? value.join(', ') : '(skipped)';
  return String(value);
}
