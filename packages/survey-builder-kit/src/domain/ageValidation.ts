import type { QuestionDef } from '../types/survey';

// Full years elapsed between an ISO date string and `today`, the same way
// birthday-based age is normally counted (not yet had this year's birthday
// -> one year less). Kept separate from AJV/JSON-Schema because the bound
// is relative to "now", not a fixed value baked in when the survey was built.
export function calculateAgeYears(dateStr: string, today: Date = new Date()): number | null {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return null;

  let age = today.getFullYear() - date.getFullYear();
  const monthDiff = today.getMonth() - date.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < date.getDate())) {
    age -= 1;
  }
  return age;
}

// Checks a single date question's minYears/maxYears constraint against the
// answer currently entered for it. Returns a message when violated, else null.
export function validateDateAge(
  question: QuestionDef,
  value: unknown,
  today: Date = new Date(),
): string | null {
  if (question.type !== 'date') return null;
  if (question.minYears === undefined && question.maxYears === undefined) return null;
  if (typeof value !== 'string' || value === '') return null;

  const age = calculateAgeYears(value, today);
  if (age === null) return null;

  const tooYoung = question.minYears !== undefined && age < question.minYears;
  const tooOld = question.maxYears !== undefined && age > question.maxYears;
  if (!tooYoung && !tooOld) return null;

  return question.yearsMessage || `${question.label || 'This field'} does not meet the required age.`;
}
