import dayjs from 'dayjs';
import type { QuestionDef } from '../types/survey';
import { OTHER_OPTION_VALUE } from '../types/survey';

// Substitutes the "Other" sentinel for whatever the respondent actually
// typed (falling back to the question's own Other label if, somehow, that
// text is missing) -- never the raw OTHER_OPTION_VALUE string, which means
// nothing to a human reader.
function resolveOtherLabel(question: QuestionDef, otherText: string | undefined): string {
  return otherText?.trim() || question.otherOptionLabel || 'Other';
}

// Shared by the runner's own pre-submit Review screen and
// buildResponsePayload's `displayValue` -- one formatter, so the summary a
// respondent reviews before submitting and the `displayValue` saved into
// the response can't drift apart. `otherText` is only read for a
// singleChoice/multipleChoice question whose own `value` reflects its
// "Other" option being selected -- see QuestionDef.allowOtherOption.
export function formatAnswerDisplay(question: QuestionDef, value: unknown, otherText?: string): string {
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
  if (question.type === 'singleChoice' && value === OTHER_OPTION_VALUE) {
    return resolveOtherLabel(question, otherText);
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return '(skipped)';
    return value.map((v) => (v === OTHER_OPTION_VALUE ? resolveOtherLabel(question, otherText) : String(v))).join(', ');
  }
  return String(value);
}
