import type { QuestionType } from '../types/survey';

export interface QuestionTypeMeta {
  type: QuestionType;
  paletteLabel: string;
  defaultLabel: string;
}

export const QUESTION_TYPES: QuestionTypeMeta[] = [
  { type: 'shortText', paletteLabel: 'Short Text', defaultLabel: 'Short text question' },
  { type: 'longText', paletteLabel: 'Long Text', defaultLabel: 'Long text question' },
  { type: 'singleChoice', paletteLabel: 'Single Choice', defaultLabel: 'Single choice question' },
  { type: 'multipleChoice', paletteLabel: 'Multiple Choice', defaultLabel: 'Multiple choice question' },
  { type: 'rating', paletteLabel: 'Rating', defaultLabel: 'Rating question' },
  { type: 'nps', paletteLabel: 'NPS', defaultLabel: 'How likely are you to recommend us?' },
  { type: 'number', paletteLabel: 'Number', defaultLabel: 'Number question' },
  { type: 'boolean', paletteLabel: 'Yes / No', defaultLabel: 'Yes/no question' },
  { type: 'date', paletteLabel: 'Date', defaultLabel: 'Date question' },
  { type: 'label', paletteLabel: 'Label', defaultLabel: 'Display text' },
  { type: 'turnstile', paletteLabel: 'Turnstile', defaultLabel: 'Verification' },
];

export function questionTypeMeta(type: QuestionType): QuestionTypeMeta {
  const meta = QUESTION_TYPES.find((t) => t.type === type);
  if (!meta) throw new Error(`Unknown question type: ${type}`);
  return meta;
}
