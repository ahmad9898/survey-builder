import Ajv, { type ErrorObject } from 'ajv';
import { CURRENT_ANSWERS_FORMAT_VERSION } from '../types/response';

// Validates the CURRENT (self-describing, array-of-entries `answers`)
// SurveyResponse shape only -- a response saved under any earlier
// answersFormatVersion (a plain `Record<string, unknown>` answers map, or
// the v2 `Record<string, AnswerEntry>` shape) will correctly fail this,
// which is exactly the signal the Answers Viewer uses to fall back to its
// degraded, legacy-shape rendering instead of treating a mismatch as a
// hard error -- see CURRENT_ANSWERS_FORMAT_VERSION's own comment for the
// full version history.
const answerOptionSchema = {
  type: 'object',
  required: ['value', 'label', 'selected'],
  properties: {
    value: { type: 'string' },
    label: { type: 'string' },
    selected: { type: 'boolean' },
    disqualifying: { type: 'boolean' },
  },
} as const;

const answerEntrySchema = {
  type: 'object',
  required: ['questionId', 'pageId', 'pageTitle', 'type', 'label', 'displayValue'],
  properties: {
    questionId: { type: 'string' },
    // Not required -- a response saved by a version of buildResponsePayload
    // before `slug` existed won't have it, even though it already claims
    // answersFormatVersion 2 (slug is purely additive to that shape).
    slug: { type: 'string' },
    pageId: { type: 'string' },
    pageTitle: { type: 'string' },
    type: { type: 'string' },
    label: { type: 'string' },
    // `value` is deliberately unconstrained -- a scalar, an array, or
    // absent entirely (an unanswered optional question, or a label entry).
    displayValue: { type: 'string' },
    skipped: { type: 'boolean' },
    options: { type: 'array', items: answerOptionSchema },
    disqualifying: { type: 'boolean' },
    disqualifyMessage: { type: 'string' },
  },
} as const;

const scoreResultSchema = {
  type: 'object',
  required: ['total', 'byCategory'],
  properties: {
    total: { type: 'number' },
    byCategory: {
      type: 'array',
      items: {
        type: 'object',
        required: ['categoryId', 'label', 'points'],
        properties: {
          categoryId: { type: 'string' },
          label: { type: 'string' },
          points: { type: 'number' },
        },
      },
    },
    passed: { type: 'boolean' },
  },
} as const;

export const surveyResponseSchema = {
  $id: 'survey-builder-kit/survey-response',
  type: 'object',
  required: ['id', 'surveyId', 'surveyVersion', 'answersFormatVersion', 'answers', 'visitedPageIds', 'startedAt'],
  properties: {
    id: { type: 'string' },
    surveyId: { type: 'string' },
    // Neither required -- a response saved before these existed won't have
    // them, even though it already claims answersFormatVersion 2 (purely
    // additive to that shape, same as `slug` on an answer entry). `type`
    // here is a PROPERTY NAME (SurveyResponse.type, the survey's own
    // free-text category), unrelated to this schema's own `type: 'object'`
    // keyword above or its value `{ type: 'string' }` below -- property
    // names and the JSON Schema `type` keyword are different namespaces.
    title: { type: 'string' },
    type: { type: 'string' },
    surveyVersion: { type: 'number' },
    answersFormatVersion: { const: CURRENT_ANSWERS_FORMAT_VERSION },
    answers: {
      type: 'array',
      items: answerEntrySchema,
    },
    visitedPageIds: { type: 'array', items: { type: 'string' } },
    score: scoreResultSchema,
    startedAt: { type: 'string' },
    completedAt: { type: 'string' },
  },
} as const;

const ajv = new Ajv({ allErrors: true, strict: false });
const validateFn = ajv.compile(surveyResponseSchema);

export interface SurveyResponseValidationResult {
  valid: boolean;
  errors?: string[];
}

function formatErrors(errors: ErrorObject[] | null | undefined): string[] {
  if (!errors) return [];
  return errors.map((e) => `${e.instancePath || '(root)'} ${e.message ?? 'is invalid'}`);
}

export function validateSurveyResponse(data: unknown): SurveyResponseValidationResult {
  const valid = validateFn(data);
  return valid ? { valid: true } : { valid: false, errors: formatErrors(validateFn.errors) };
}
