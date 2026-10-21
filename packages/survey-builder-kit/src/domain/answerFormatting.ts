import dayjs from 'dayjs';
import type { QuestionDef } from '../types/survey';

// Shared by the runner's own pre-submit Review screen and
// buildResponsePayload's `displayValue` -- one formatter, so the summary a
// respondent reviews before submitting and the `displayValue` saved into
// the response can't drift apart.
export function formatAnswerDisplay(question: QuestionDef, value: unknown): string {
  if (value === undefined || value === null || value === '') return '(skipped)';
  // The raw value here is the Turnstile token itself (a ~2000-char opaque,
  // single-use string) -- shown as "Verified" instead, since dumping that
  // into a human-facing review list or export would be useless to read.
  // The real token still lives in AnswerEntry.value untouched; only this
  // DISPLAY string is substituted.
  if (question.type === 'turnstile') return 'Verified';
  if (question.type === 'boolean') return value ? 'Yes' : 'No';
  if (question.type === 'date' && typeof value === 'string') {
    const parsed = dayjs(value);
    return parsed.isValid() ? parsed.format('MMMM D, YYYY') : String(value);
  }
  if (Array.isArray(value)) return value.length > 0 ? value.join(', ') : '(skipped)';
  return String(value);
}
