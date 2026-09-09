import type { ErrorObject } from 'ajv';
import type { QuestionDef } from '../types/survey';

export interface ValidationMessage {
  questionId: string;
  message: string;
}

// Maps a question's id to the property AJV reports the error against:
// 'required' errors are reported on the parent object with the field name in
// params.missingProperty, everything else is reported on the field's own path.
function questionIdFromError(error: ErrorObject): string | undefined {
  if (error.keyword === 'required') {
    return (error.params as { missingProperty?: string }).missingProperty;
  }
  return error.instancePath.replace(/^\//, '') || undefined;
}

function resolveMessage(question: QuestionDef, error: ErrorObject): string {
  const label = question.label || 'This field';
  switch (error.keyword) {
    case 'required':
      return question.requiredMessage || `${label} is required.`;
    case 'pattern':
      return question.patternMessage || `${label} is not in a valid format.`;
    case 'minLength':
    case 'maxLength':
      return question.lengthMessage || `${label} length is invalid.`;
    case 'minimum':
    case 'maximum':
      return question.rangeMessage || `${label} is out of the allowed range.`;
    default:
      return `${label} is invalid.`;
  }
}

// Turns raw AJV errors into deduplicated, question-scoped messages, preferring
// each question's custom message over AJV's generic wording. Used to render a
// single summary banner rather than per-field inline errors.
export function describeValidationErrors(
  errors: ErrorObject[],
  questions: QuestionDef[],
): ValidationMessage[] {
  const byId = new Map(questions.map((q) => [q.id, q]));
  const seen = new Set<string>();
  const results: ValidationMessage[] = [];

  for (const error of errors) {
    const questionId = questionIdFromError(error);
    if (!questionId) continue;
    const question = byId.get(questionId);
    if (!question) continue;

    const message = resolveMessage(question, error);
    const key = `${questionId}:${message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    results.push({ questionId, message });
  }

  return results;
}
