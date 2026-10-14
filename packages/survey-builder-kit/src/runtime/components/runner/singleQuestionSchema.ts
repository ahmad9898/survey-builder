import type { JsonSchema } from '@jsonforms/core';
import type { SurveyPage } from '../../../types/survey';

// Slices ONE question's already-compiled property schema out of a page's
// full page.schema (produced by schemaCompiler.ts, untouched) -- so a single
// question can be validated in isolation without the page's OTHER required
// questions (not yet shown, in this one-question-per-screen runner) being
// spuriously reported as missing.
export function singleQuestionSchema(page: SurveyPage, questionId: string): JsonSchema {
  const propertySchema = (page.schema.properties as Record<string, JsonSchema> | undefined)?.[questionId];
  const isRequired = (page.schema.required as string[] | undefined)?.includes(questionId) ?? false;
  return {
    type: 'object',
    properties: { [questionId]: propertySchema ?? {} },
    ...(isRequired ? { required: [questionId] } : {}),
  } as JsonSchema;
}
