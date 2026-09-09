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
  | 'label';

export interface QuestionDef {
  id: string; // property key, unique survey-wide
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
}

export interface SurveyPage {
  id: string;
  title: string;
  questions: QuestionDef[]; // builder-level model this page compiles from
  schema: JsonSchema; // compiled JSON Schema (kept in sync by schemaCompiler)
  uischema: UISchemaElement; // compiled UI Schema (kept in sync by schemaCompiler)
  branch: BranchRule[];
  defaultNextPageId: string | 'end';
}

export interface Survey {
  id: string;
  title: string;
  description?: string;
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
