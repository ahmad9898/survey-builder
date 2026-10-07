import type { ConditionGroup, ConditionLeaf } from '../types/survey';
import { isConditionGroup } from '../types/survey';

function getValueAtScope(answers: Record<string, unknown>, fieldPath: string): unknown {
  // fieldPath is a JSONForms scope like '#/properties/age'; the property key is the
  // final path segment. Answers are stored flat, keyed by property key.
  const key = fieldPath.split('/').pop();
  return key ? answers[key] : undefined;
}

function evaluateLeaf(leaf: ConditionLeaf, answers: Record<string, unknown>): boolean {
  const actual = getValueAtScope(answers, leaf.fieldPath);

  switch (leaf.operator) {
    case 'eq':
      return actual === leaf.value;
    case 'neq':
      return actual !== leaf.value;
    case 'contains':
      if (Array.isArray(actual)) return actual.includes(leaf.value);
      if (typeof actual === 'string' && typeof leaf.value === 'string')
        return actual.includes(leaf.value);
      return false;
    case 'gt':
      return typeof actual === 'number' && typeof leaf.value === 'number' && actual > leaf.value;
    case 'gte':
      return typeof actual === 'number' && typeof leaf.value === 'number' && actual >= leaf.value;
    case 'lt':
      return typeof actual === 'number' && typeof leaf.value === 'number' && actual < leaf.value;
    case 'lte':
      return typeof actual === 'number' && typeof leaf.value === 'number' && actual <= leaf.value;
    case 'isEmpty':
      return (
        actual === undefined ||
        actual === null ||
        actual === '' ||
        (Array.isArray(actual) && actual.length === 0)
      );
    case 'isNotEmpty':
      return !(
        actual === undefined ||
        actual === null ||
        actual === '' ||
        (Array.isArray(actual) && actual.length === 0)
      );
    default:
      return false;
  }
}

export function evaluateConditionGroup(
  group: ConditionGroup,
  answers: Record<string, unknown>,
): boolean {
  if (group.conditions.length === 0) return true;
  const results = group.conditions.map((node) =>
    isConditionGroup(node) ? evaluateConditionGroup(node, answers) : evaluateLeaf(node, answers),
  );
  return group.logic === 'AND' ? results.every(Boolean) : results.some(Boolean);
}
