import type { QuestionType } from './survey';

export interface ScoreByCategory {
  categoryId: string;
  label: string;
  points: number;
}

export interface ScoreResult {
  total: number;
  byCategory: ScoreByCategory[];
  passed?: boolean;
}

// One choice/multi-select option as it stood at submit time -- the FULL
// list from the question's `choices`, not just whichever were picked, so a
// later reader (e.g. the Answers Viewer) can show what the respondent
// *didn't* choose too, not just what they did.
export interface AnswerOption {
  value: string;
  label: string;
  selected: boolean;
  disqualifying?: boolean;
}

// A self-describing snapshot of one answered (or deliberately skipped, or
// acknowledged) question, carrying enough of the survey definition that a
// reader doesn't need the exact survey version it came from to make sense
// of it. Built once, at submit time, by `buildResponsePayload` -- see that
// function's own comment for why this is a presentation/export-time shape,
// not something the live runner/JSONForms/branching/scoring code reads.
export interface AnswerEntry {
  questionId: string;
  /** Same value as `questionId` (= the question's `id`, which is itself a slug of its title) -- a named alias so a reader doesn't need to already know `questionId` IS the slug. */
  slug: string;
  pageId: string;
  pageTitle: string;
  type: QuestionType;
  /** The question's label, snapshotted at submit time (surveys can be edited later). */
  label: string;
  /** The raw value, same as what's stored in the live answers map today. Absent (and so omitted from JSON) for a skipped optional question. */
  value?: unknown;
  /** Human-readable rendering: resolved option label(s), "Yes"/"No", a formatted date, "Acknowledged" for a label question, etc. */
  displayValue: string;
  /** True if this question was optional and left blank. Not set for a `type: "label"` entry (not applicable). */
  skipped?: boolean;
  /** Choice/multi-select only -- every option, selected or not. */
  options?: AnswerOption[];
  /** True if the selected option(s) include one flagged disqualifying on this question. */
  disqualifying?: boolean;
  /** Snapshot of the disqualifying option's notice (title, and body if any), if `disqualifying` is true. */
  disqualifyMessage?: string;
  /** Snapshot of the question's own `hasTrigger` flag at submit/answer time. Omitted (not `false`) when the question isn't a trigger question. */
  hasTrigger?: boolean;
}

// Bumped whenever the shape of `SurveyResponse.answers` itself (or its
// entries' shape) changes in a way a reader needs to branch on -- distinct
// from `surveyVersion` (which tracks edits to the SURVEY DEFINITION the
// response was taken against, not the response document's own shape).
// History: 1 = a response predating this field, plain `Record<string,
// unknown>` answers (no question context at all). 2 = `Record<string,
// AnswerEntry>`, keyed by questionId. 3 (current) = `AnswerEntry[]` -- each
// entry already carries its own `questionId`/`slug`, so the object-keying
// was redundant; an array also reads/iterates more naturally for a
// standalone viewer, and keeps entries in the order they were built
// (visitedPageIds order) without relying on object-key order. A response
// saved under an earlier version doesn't match this one -- see the
// Answers Viewer's legacy/degraded handling.
export const CURRENT_ANSWERS_FORMAT_VERSION = 3;

export interface SurveyResponse {
  id: string;
  surveyId: string;
  /** The survey's name (Survey.title), snapshotted at submit time -- so a reader (e.g. the Answers Viewer) can show which survey this is without needing the survey definition itself. Surveys can be renamed later; this is what it was called when the response was taken. */
  title: string;
  /** The survey's free-text category (Survey.type), snapshotted the same way. Absent if the survey didn't have one set. */
  type?: string;
  surveyVersion: number;
  answersFormatVersion: typeof CURRENT_ANSWERS_FORMAT_VERSION;
  answers: AnswerEntry[];
  visitedPageIds: string[];
  score?: ScoreResult;
  startedAt: string;
  completedAt?: string;
}
