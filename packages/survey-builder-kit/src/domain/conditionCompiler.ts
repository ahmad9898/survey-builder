import { RuleEffect } from '@jsonforms/core';
import type { AndCondition, Condition, JsonSchema, OrCondition, Rule } from '@jsonforms/core';
import type { ConditionGroup, ConditionLeaf } from '../types/survey';
import { isConditionGroup } from '../types/survey';

// Compiles one ConditionLeaf into a JSONForms SchemaBasedCondition. Deliberately
// omits an explicit `type` keyword on most branches: per JSON Schema semantics,
// keywords like minLength/maxLength/minimum only constrain instances of the
// matching type, so on an unrelated/undefined value they pass trivially. We rely
// on `failWhenUndefined` to turn that trivial pass into the fail we actually want
// whenever "not yet answered" should not satisfy the condition (every operator
// except isEmpty, where "not yet answered" should count as empty).
function compileLeaf(leaf: ConditionLeaf): Condition {
  const base = { scope: leaf.fieldPath };

  switch (leaf.operator) {
    case 'eq':
      return { ...base, schema: { const: leaf.value }, failWhenUndefined: true };
    case 'neq':
      return { ...base, schema: { not: { const: leaf.value } }, failWhenUndefined: true };
    case 'contains':
      // Primarily intended for multi-select (array) fields.
      return {
        ...base,
        schema: { contains: { const: leaf.value } } as JsonSchema,
        failWhenUndefined: true,
      };
    case 'gt':
      return { ...base, schema: { exclusiveMinimum: leaf.value as number }, failWhenUndefined: true };
    case 'gte':
      return { ...base, schema: { minimum: leaf.value as number }, failWhenUndefined: true };
    case 'lt':
      return { ...base, schema: { exclusiveMaximum: leaf.value as number }, failWhenUndefined: true };
    case 'lte':
      return { ...base, schema: { maximum: leaf.value as number }, failWhenUndefined: true };
    case 'isEmpty':
      return { ...base, schema: { maxLength: 0 } };
    case 'isNotEmpty':
      return { ...base, schema: { minLength: 1 }, failWhenUndefined: true };
    default:
      return { ...base, schema: {} };
  }
}

function compileGroup(group: ConditionGroup): AndCondition | OrCondition {
  return {
    type: group.logic,
    conditions: group.conditions.map((node) =>
      isConditionGroup(node) ? compileGroup(node) : compileLeaf(node),
    ),
  } as AndCondition | OrCondition;
}

// Compiles a builder-level ConditionGroup into a native JSONForms `rule` (SHOW
// when the group evaluates true), attachable directly to a UI Schema Control.
export function compileVisibilityRule(group: ConditionGroup | null | undefined): Rule | undefined {
  if (!group || group.conditions.length === 0) return undefined;
  return {
    effect: RuleEffect.SHOW,
    condition: compileGroup(group),
  };
}
