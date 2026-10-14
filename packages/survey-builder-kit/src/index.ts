// The two public components -- see each file's own doc comment for details.
export { SurveyBuilder, type SurveyBuilderProps, newSurvey } from './SurveyBuilder';
export { SurveyRunner, type SurveyRunnerProps } from './SurveyRunner';

// Survey JSON shape -- what a host passes into <SurveyBuilder survey={...}>/
// <SurveyRunner survey={...}> and gets back out of onChange/onSave.
export type {
  Survey,
  SurveyPage,
  QuestionDef,
  QuestionType,
  BranchRule,
  ConditionGroup,
  ConditionLeaf,
  ConditionOperator,
  ScoringEntry,
  ScoringMap,
  DisqualifyingNotice,
} from './types/survey';
export { isConditionGroup, CURRENT_SCHEMA_VERSION } from './types/survey';

// Answers/response JSON shape -- what onSubmit hands back from
// <SurveyRunner> (onChange still hands back the plain live-answers map),
// and (if a host wants it) the scoring result shape. `answers` is keyed by
// questionId, but each VALUE is a self-describing AnswerEntry (question
// type/label/choices snapshotted at submit time), not a raw scalar -- see
// AnswerEntry's own comment for why, and CURRENT_ANSWERS_FORMAT_VERSION /
// validateSurveyResponse for telling a response in this shape apart from
// one saved before it existed.
export type { ScoreResult, ScoreByCategory, SurveyResponse, AnswerEntry, AnswerOption } from './types/response';
export { CURRENT_ANSWERS_FORMAT_VERSION } from './types/response';

// Pure helper so a host can compute the same score <SurveyRunner> shows
// internally (e.g. to persist alongside answers in its own response store) --
// it's just (survey's scoring config, answers) -> ScoreResult, no component
// state involved.
export { computeScore } from './domain/scoringEngine';

// Validates a SurveyResponse JSON document against the current (v2)
// self-describing `answers` shape -- e.g. for a standalone tool that reads
// an exported response file on its own, with no survey definition loaded,
// and needs to tell a current-shape file apart from a legacy one before
// rendering it (see the response schema module's own comment).
export { validateSurveyResponse } from './domain/responseSchema';

// Same per-type icon the Builder's own question list/add-menu uses, exposed
// so a host building its own response-reading UI (e.g. an answers viewer)
// can label each question with a consistent, familiar icon rather than
// inventing a second mapping that can drift from the Builder's.
export { QUESTION_TYPE_ICONS } from './builder/questionTypeIcons';
