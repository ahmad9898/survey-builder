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

// Answers/response JSON shape -- what onChange/onSubmit hand back from
// <SurveyRunner>, and (if a host wants it) the scoring result shape.
export type { ScoreResult, ScoreByCategory, SurveyResponse } from './types/response';

// Pure helper so a host can compute the same score <SurveyRunner> shows
// internally (e.g. to persist alongside answers in its own response store) --
// it's just (survey's scoring config, answers) -> ScoreResult, no component
// state involved.
export { computeScore } from './domain/scoringEngine';
