import type { JsonSchema, UISchemaElement } from '@jsonforms/core';
import type { QuestionDef, QuestionType, SurveyPage } from '../types/survey';
import { compileVisibilityRule } from './conditionCompiler';

function compileQuestionSchema(q: QuestionDef): JsonSchema {
  switch (q.type) {
    case 'shortText':
    case 'longText': {
      const minLength =
        q.minLength !== undefined
          ? q.required
            ? Math.max(q.minLength, 1)
            : q.minLength
          : q.required
            ? 1
            : undefined;
      return {
        type: 'string',
        ...(minLength !== undefined ? { minLength } : {}),
        ...(q.maxLength !== undefined ? { maxLength: q.maxLength } : {}),
        ...(q.pattern ? { pattern: q.pattern } : {}),
      };
    }
    case 'singleChoice':
      return { type: 'string', enum: q.choices ?? [] };
    case 'multipleChoice':
      return {
        type: 'array',
        items: { type: 'string', enum: q.choices ?? [] },
        uniqueItems: true,
      };
    case 'rating':
      return { type: 'integer', minimum: q.min ?? 1, maximum: q.max ?? 5 };
    case 'nps':
      return { type: 'integer', minimum: q.min ?? 0, maximum: q.max ?? 10 };
    case 'number':
      return {
        type: 'number',
        ...(q.min !== undefined ? { minimum: q.min } : {}),
        ...(q.max !== undefined ? { maximum: q.max } : {}),
      };
    case 'boolean':
      return { type: 'boolean' };
    case 'date':
      return { type: 'string', format: 'date' };
    case 'turnstile':
      return { type: 'string' };
    default:
      return { type: 'string' };
  }
}

const RENDERER_HINT: Partial<Record<QuestionType, string>> = {
  rating: 'rating',
  nps: 'nps',
  turnstile: 'turnstile',
};

function compileQuestionUiElement(q: QuestionDef): UISchemaElement {
  const rule = compileVisibilityRule(q.visibilityRule);

  if (q.type === 'label') {
    return {
      type: 'Label',
      text: q.label,
      ...(rule ? { rule } : {}),
    } as UISchemaElement;
  }

  const scope = `#/properties/${q.id}`;
  const rendererHint = RENDERER_HINT[q.type];

  // Built once and merged, rather than several independent `options: {...}`
  // spreads -- each of those would silently replace the whole `options`
  // object rather than merge into it, so e.g. a longText question with both
  // a description AND `multi` would have lost the description.
  const options: Record<string, unknown> = {};
  if (q.description) options.description = q.description;
  if (rendererHint) options.renderer = rendererHint;
  if (q.type === 'longText') options.multi = true;
  // UI-schema metadata only -- AJV never sees this, it's read by the
  // runner's choice controls and the Builder's options list. Omitted
  // entirely (not even an empty object) when there's nothing disqualifying,
  // so a plain question's compiled UI schema doesn't grow a stray key.
  if (q.disqualifyingOptions && Object.keys(q.disqualifyingOptions).length > 0) {
    options.disqualifyingOptions = q.disqualifyingOptions;
  }

  return {
    type: 'Control',
    scope,
    label: q.label,
    ...(Object.keys(options).length > 0 ? { options } : {}),
    ...(rule ? { rule } : {}),
  } as UISchemaElement;
}

// Compiles a page's builder-level QuestionDef[] into the JSON Schema + UI Schema
// pair JSONForms actually renders from. Called on every builder store mutation
// so the live preview and the exported survey JSON stay in sync automatically.
export function compilePage(page: Pick<SurveyPage, 'questions'>): {
  schema: JsonSchema;
  uischema: UISchemaElement;
} {
  const properties: Record<string, JsonSchema> = {};
  const required: string[] = [];

  for (const q of page.questions) {
    if (q.type === 'label') continue; // display-only, carries no answer data
    properties[q.id] = compileQuestionSchema(q);
    // turnstile is unconditionally required -- there's no meaningful
    // "optional CAPTCHA", and the Builder doesn't even expose a Required
    // toggle for it (see QuestionCard.tsx), so `q.required` itself can't be
    // relied on to ever be true here.
    if (q.required || q.type === 'turnstile') required.push(q.id);
  }

  return {
    schema: {
      type: 'object',
      properties,
      ...(required.length > 0 ? { required } : {}),
    } as JsonSchema,
    uischema: {
      type: 'VerticalLayout',
      elements: page.questions.map(compileQuestionUiElement),
    },
  };
}
