import Ajv, { type ErrorObject } from 'ajv';
import { CURRENT_SCHEMA_VERSION, type DisqualifyingNotice, type Survey } from '../types/survey';

// JSON Schema for the Survey document itself -- validates the shape of what
// a host hands in via <SurveyBuilder survey={...}>/<SurveyRunner survey={...}>,
// so a malformed prop produces a clear error state instead of an obscure
// crash somewhere deep in the branching/scoring/flow-map code that assumes
// well-formed data. Deliberately doesn't validate the *compiled* per-page
// `schema`/`uischema` (JSONForms documents, derived data) beyond "is an
// object" -- that's schemaCompiler's job to keep in sync, not something a
// host is expected to hand-author.
const conditionLeafSchema = {
  type: 'object',
  required: ['fieldPath', 'operator'],
  properties: {
    fieldPath: { type: 'string' },
    operator: {
      enum: ['eq', 'neq', 'contains', 'gt', 'gte', 'lt', 'lte', 'isEmpty', 'isNotEmpty'],
    },
  },
} as const;

// ConditionGroup nests ConditionLeaf | ConditionGroup -- expressed via `$ref`
// to a named definition so Ajv can resolve the recursion.
const conditionGroupSchema = {
  type: 'object',
  required: ['logic', 'conditions'],
  properties: {
    logic: { enum: ['AND', 'OR'] },
    conditions: {
      type: 'array',
      items: { $ref: '#/definitions/conditionNode' },
    },
  },
} as const;

const branchRuleSchema = {
  type: 'object',
  required: ['id', 'when', 'goToPageId'],
  properties: {
    id: { type: 'string' },
    when: { $ref: '#/definitions/conditionGroup' },
    goToPageId: { type: 'string' },
  },
} as const;

const questionDefSchema = {
  type: 'object',
  required: ['id', 'type', 'label'],
  properties: {
    id: { type: 'string' },
    type: {
      enum: [
        'shortText',
        'longText',
        'singleChoice',
        'multipleChoice',
        'rating',
        'nps',
        'number',
        'boolean',
        'date',
        'label',
      ],
    },
    label: { type: 'string' },
  },
} as const;

const surveyPageSchema = {
  type: 'object',
  required: ['id', 'title', 'questions', 'schema', 'uischema', 'branch', 'defaultNextPageId'],
  properties: {
    id: { type: 'string' },
    title: { type: 'string' },
    questions: { type: 'array', items: questionDefSchema },
    schema: { type: 'object' },
    uischema: { type: 'object' },
    branch: { type: 'array', items: branchRuleSchema },
    defaultNextPageId: { type: 'string' },
  },
} as const;

export const surveySchema = {
  $id: 'survey-builder-kit/survey',
  type: 'object',
  // `schemaVersion` is intentionally NOT required here even though the
  // `Survey` TypeScript type always has it -- surveys exported before this
  // field existed are still valid input; see normalizeSurvey() below, which
  // backfills it before the survey enters either component's store.
  required: ['id', 'title', 'version', 'createdAt', 'updatedAt', 'pages', 'startPageId'],
  properties: {
    id: { type: 'string' },
    title: { type: 'string' },
    schemaVersion: { type: 'number' },
    version: { type: 'number' },
    createdAt: { type: 'string' },
    updatedAt: { type: 'string' },
    startPageId: { type: 'string' },
    pages: { type: 'array', items: surveyPageSchema },
  },
  definitions: {
    conditionGroup: conditionGroupSchema,
    conditionNode: {
      oneOf: [conditionLeafSchema, { $ref: '#/definitions/conditionGroup' }],
    },
  },
} as const;

const ajv = new Ajv({ allErrors: true, strict: false });
const validateFn = ajv.compile(surveySchema);

export interface SurveyValidationResult {
  valid: boolean;
  errors?: string[];
}

function formatErrors(errors: ErrorObject[] | null | undefined): string[] {
  if (!errors) return [];
  return errors.map((e) => `${e.instancePath || '(root)'} ${e.message ?? 'is invalid'}`);
}

export function validateSurvey(data: unknown): SurveyValidationResult {
  const valid = validateFn(data);
  return valid ? { valid: true } : { valid: false, errors: formatErrors(validateFn.errors) };
}

// disqualifyingOptions used to be `Record<string, string>` (a bare message)
// before it grew a title/body shape. Survey JSON saved locally during that
// window -- this app's own IndexedDB drafts included -- still has the old
// string form; without this, reading `.title` off a plain string crashes
// the Builder (`notice.title.trim()` on `undefined`) the moment that
// question's options list renders. Treats the old string as the new title,
// the closest equivalent to what it meant before.
function normalizeDisqualifyingOptions(
  options: Record<string, DisqualifyingNotice> | undefined,
): { options: Record<string, DisqualifyingNotice> | undefined; changed: boolean } {
  if (!options) return { options, changed: false };
  let changed = false;
  const next: Record<string, DisqualifyingNotice> = {};
  for (const [key, value] of Object.entries(options as Record<string, unknown>)) {
    if (typeof value === 'string') {
      changed = true;
      next[key] = { title: value };
    } else {
      next[key] = value as DisqualifyingNotice;
    }
  }
  return changed ? { options: next, changed: true } : { options, changed: false };
}

function normalizeLegacyDisqualifyingOptions(survey: Survey): Survey {
  let pagesChanged = false;
  const pages = survey.pages.map((page) => {
    let questionsChanged = false;
    const questions = page.questions.map((q) => {
      const { options, changed } = normalizeDisqualifyingOptions(q.disqualifyingOptions);
      if (!changed) return q;
      questionsChanged = true;
      return { ...q, disqualifyingOptions: options };
    });
    if (!questionsChanged) return page;
    pagesChanged = true;
    return { ...page, questions };
  });
  return pagesChanged ? { ...survey, pages } : survey;
}

// Backfills/repairs fields the `Survey` TypeScript type now expects but an
// already-saved (or hand-authored) survey might predate, so JSON from
// before a shape changed keeps working rather than crashing or being
// rejected outright.
export function normalizeSurvey(survey: Survey): Survey {
  let next = survey;
  if (next.schemaVersion === undefined) {
    next = { ...next, schemaVersion: CURRENT_SCHEMA_VERSION };
  }
  next = normalizeLegacyDisqualifyingOptions(next);
  return next;
}
