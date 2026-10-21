import type { JsonSchema, UISchemaElement } from '@jsonforms/core';

export type ConditionOperator =
  | 'eq'
  | 'neq'
  | 'contains'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'isEmpty'
  | 'isNotEmpty';

export interface ConditionLeaf {
  fieldPath: string; // JSONForms scope, e.g. '#/properties/age'
  operator: ConditionOperator;
  value?: unknown;
}

export interface ConditionGroup {
  logic: 'AND' | 'OR';
  conditions: (ConditionLeaf | ConditionGroup)[];
}

export function isConditionGroup(
  node: ConditionLeaf | ConditionGroup,
): node is ConditionGroup {
  return (node as ConditionGroup).logic !== undefined;
}

export interface BranchRule {
  id: string;
  when: ConditionGroup;
  goToPageId: string | 'end';
}

export interface ScoringEntry {
  categoryId?: string;
  optionScores?: Record<string, number>;
  valueScore?: number;
  linearScore?: { min: number; max: number; minPoints: number; maxPoints: number };
}

export type ScoringMap = Record<string, ScoringEntry>;

export type QuestionType =
  | 'shortText'
  | 'longText'
  | 'singleChoice'
  | 'multipleChoice'
  | 'rating'
  | 'nps'
  | 'number'
  | 'boolean'
  | 'date'
  | 'label'
  // Cloudflare Turnstile challenge -- carries no author-set choices/min/max
  // like the other types; its only "answer" is the token Turnstile hands
  // back once the respondent passes the challenge. Always implicitly
  // required (there's no meaningful "optional CAPTCHA"), never scoreable
  // or branchable (the token is an opaque, single-use, ephemeral string --
  // see questionValidation.ts/schemaCompiler.ts/answerFormatting.ts for
  // where it's excluded from treatment the other types get). This library
  // only captures the token -- verifying it against Cloudflare's siteverify
  // endpoint needs the SECRET key, which must never reach the browser, so
  // that's entirely the host's own backend's job.
  | 'turnstile';

export interface QuestionDef {
  id: string; // property key, unique survey-wide
  // Always equal to `id` -- `id` IS a slug of `title` (see slugifyUnique/
  // finalizeQuestionId in the builder store), kept in sync with it
  // everywhere `id` is set. Exposed as its own field so a host reading the
  // published survey or a submitted response doesn't need to already know
  // that fact to find it -- see AnswerEntry.slug for the response-side
  // counterpart. Survey JSON saved before this field existed doesn't have
  // it; normalizeSurvey() backfills it from `id`.
  slug: string;
  // The author-facing name for this question -- same role `Survey.title`/
  // `SurveyPage.title` play at their levels, distinct from `label` (the
  // text shown to the RESPONDENT). Freely editable at any time, unlike
  // `slug`/`id`: only the slug derived from it, once, at creation, is
  // locked (finalizeQuestionId) -- editing `title` afterward never moves
  // it. Never rendered in <SurveyRunner> -- Builder-only. Survey JSON
  // saved before this field existed doesn't have it; normalizeSurvey()
  // backfills it from `label`.
  title: string;
  type: QuestionType;
  label: string;
  description?: string;
  required?: boolean;
  requiredMessage?: string; // custom error shown when a required field is left empty
  choices?: string[]; // for singleChoice / multipleChoice
  min?: number; // for rating / number
  max?: number; // for rating / number
  rangeMessage?: string; // custom error shown when min/max is violated (rating / nps / number)
  pattern?: string; // regex source, for shortText / longText
  patternMessage?: string; // custom error shown when pattern doesn't match
  minLength?: number; // for shortText / longText
  maxLength?: number; // for shortText / longText
  lengthMessage?: string; // custom error shown when minLength/maxLength is violated
  minYears?: number; // for date: minimum age in years, computed against today at answer time
  maxYears?: number; // for date: maximum age in years, computed against today at answer time
  yearsMessage?: string; // custom error shown when minYears/maxYears is violated
  visibilityRule?: ConditionGroup | null;
  // Per-option disqualification, for singleChoice/multipleChoice -- keyed by
  // the option's own string value (from `choices`); the value is the
  // inline notice shown if that option is selected, matching the same
  // title + body shape as the warning-banner treatment used elsewhere
  // (e.g. a blocksSubmission page's Label question). Distinct from a page's
  // `blocksSubmission`: that's a whole dedicated notice page reached via a
  // branching rule; this is one specific answer on an otherwise-normal
  // question that should block Continue/Submit WITHOUT navigating anywhere
  // -- the respondent stays on this question. Deliberately not a richer
  // per-option object shape on `choices` itself (which stays a plain
  // string[]) so this doesn't ripple into the schema compiler,
  // ConditionEditor, ScoringEditor, or every choice-rendering control that
  // already treats choices as strings. AJV never sees this -- it's
  // UI-schema metadata only, consulted by the Builder's options list, the
  // runner, and the flow map, never by schema validation.
  disqualifyingOptions?: Record<string, DisqualifyingNotice>;
  // Marks this one question as a "trigger" question -- see
  // SurveyRunnerProps.onAnswer's own comment for what that changes about
  // when/how it fires. Never compiled into the JSONForms schema/UI schema
  // (schemaCompiler doesn't read it), so it has no effect on and isn't
  // visible anywhere in <SurveyRunner>'s rendered form. Defaults to false
  // (omitted) for every question, including ones saved before this field
  // existed.
  hasTrigger?: boolean;
}

export interface DisqualifyingNotice {
  title: string;
  body?: string;
}

export interface SurveyPage {
  id: string;
  title: string;
  questions: QuestionDef[]; // builder-level model this page compiles from
  schema: JsonSchema; // compiled JSON Schema (kept in sync by schemaCompiler)
  uischema: UISchemaElement; // compiled UI Schema (kept in sync by schemaCompiler)
  branch: BranchRule[];
  defaultNextPageId: string | 'end';
  // Marks a terminal/notice page (e.g. a disqualification or referral
  // notice) as halting the flow rather than a normal completed submission.
  // Setting this via the builder (setPageBlocksSubmission) also points the
  // page's own defaultNextPageId at 'end', so checking it actually stops
  // the flow here, not just labels it -- a branch rule routing some OTHER
  // answer elsewhere is untouched. Hand-authored survey JSON could still set
  // this true with a defaultNextPageId other than 'end' (nothing enforces
  // the pairing at the type level), so runtime navigation still only ever
  // stops at an actual 'end', never on this flag alone.
  blocksSubmission?: boolean;
}

// Bumped when the Survey JSON shape changes in a way that would need a
// migration -- distinct from `version`, which tracks edits to a single
// survey's own content, not the shape of the document itself.
export const CURRENT_SCHEMA_VERSION = 1;

export interface Survey {
  id: string;
  title: string;
  // Free-text category/classification for the survey as a whole (e.g.
  // "intake", "screening") -- unrelated to QuestionDef.type (a different
  // object; same English word, different concept). Letters, digits,
  // underscores, and hyphens only -- no spaces or other punctuation; the
  // Builder strips disallowed characters as they're typed rather than
  // erroring, so this is never actually invalid, just possibly absent.
  // The Builder UI treats this (and `title`) as mandatory -- shown with a
  // required marker and an inline error while empty -- but it stays
  // optional here and isn't AJV-required: a survey saved before this field
  // existed has no sensible default to invent for free text, so it must
  // still be able to load (just prompting the author to fill it in), not
  // fail validation outright.
  type?: string;
  description?: string;
  schemaVersion: number;
  version: number;
  createdAt: string;
  updatedAt: string;
  pages: SurveyPage[];
  startPageId: string;
  scoring?: {
    enabled: boolean;
    categories?: { id: string; label: string }[];
    passThreshold?: number;
  };
  scoringMap?: ScoringMap;
}
