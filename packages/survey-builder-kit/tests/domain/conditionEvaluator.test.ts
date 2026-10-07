import { describe, expect, it } from 'vitest';
import { evaluateConditionGroup } from '../../src/domain/conditionEvaluator';
import type { ConditionGroup } from '../../src/types/survey';

describe('evaluateConditionGroup', () => {
  it('eq matches exact value', () => {
    const group: ConditionGroup = {
      logic: 'AND',
      conditions: [{ fieldPath: '#/properties/age', operator: 'eq', value: 30 }],
    };
    expect(evaluateConditionGroup(group, { age: 30 })).toBe(true);
    expect(evaluateConditionGroup(group, { age: 31 })).toBe(false);
  });

  it('neq', () => {
    const group: ConditionGroup = {
      logic: 'AND',
      conditions: [{ fieldPath: '#/properties/status', operator: 'neq', value: 'active' }],
    };
    expect(evaluateConditionGroup(group, { status: 'inactive' })).toBe(true);
    expect(evaluateConditionGroup(group, { status: 'active' })).toBe(false);
  });

  it('contains for arrays and strings', () => {
    const arrGroup: ConditionGroup = {
      logic: 'AND',
      conditions: [{ fieldPath: '#/properties/tags', operator: 'contains', value: 'vip' }],
    };
    expect(evaluateConditionGroup(arrGroup, { tags: ['vip', 'new'] })).toBe(true);
    expect(evaluateConditionGroup(arrGroup, { tags: ['new'] })).toBe(false);

    const strGroup: ConditionGroup = {
      logic: 'AND',
      conditions: [{ fieldPath: '#/properties/name', operator: 'contains', value: 'oh' }],
    };
    expect(evaluateConditionGroup(strGroup, { name: 'John' })).toBe(true);
    expect(evaluateConditionGroup(strGroup, { name: 'Amy' })).toBe(false);
  });

  it('numeric comparisons: gt, gte, lt, lte', () => {
    const answers = { score: 5 };
    expect(
      evaluateConditionGroup(
        { logic: 'AND', conditions: [{ fieldPath: '#/properties/score', operator: 'gt', value: 4 }] },
        answers,
      ),
    ).toBe(true);
    expect(
      evaluateConditionGroup(
        { logic: 'AND', conditions: [{ fieldPath: '#/properties/score', operator: 'gte', value: 5 }] },
        answers,
      ),
    ).toBe(true);
    expect(
      evaluateConditionGroup(
        { logic: 'AND', conditions: [{ fieldPath: '#/properties/score', operator: 'lt', value: 5 }] },
        answers,
      ),
    ).toBe(false);
    expect(
      evaluateConditionGroup(
        { logic: 'AND', conditions: [{ fieldPath: '#/properties/score', operator: 'lte', value: 5 }] },
        answers,
      ),
    ).toBe(true);
  });

  it('isEmpty / isNotEmpty handle undefined, empty string, empty array', () => {
    const isEmptyGroup: ConditionGroup = {
      logic: 'AND',
      conditions: [{ fieldPath: '#/properties/x', operator: 'isEmpty' }],
    };
    expect(evaluateConditionGroup(isEmptyGroup, {})).toBe(true);
    expect(evaluateConditionGroup(isEmptyGroup, { x: '' })).toBe(true);
    expect(evaluateConditionGroup(isEmptyGroup, { x: [] })).toBe(true);
    expect(evaluateConditionGroup(isEmptyGroup, { x: 'a' })).toBe(false);

    const isNotEmptyGroup: ConditionGroup = {
      logic: 'AND',
      conditions: [{ fieldPath: '#/properties/x', operator: 'isNotEmpty' }],
    };
    expect(evaluateConditionGroup(isNotEmptyGroup, { x: 'a' })).toBe(true);
    expect(evaluateConditionGroup(isNotEmptyGroup, { x: '' })).toBe(false);
  });

  it('nested AND-inside-OR and OR-inside-AND groups', () => {
    const orOfAnds: ConditionGroup = {
      logic: 'OR',
      conditions: [
        {
          logic: 'AND',
          conditions: [
            { fieldPath: '#/properties/a', operator: 'eq', value: 1 },
            { fieldPath: '#/properties/b', operator: 'eq', value: 2 },
          ],
        },
        { fieldPath: '#/properties/c', operator: 'eq', value: 3 },
      ],
    };
    expect(evaluateConditionGroup(orOfAnds, { a: 1, b: 2, c: 0 })).toBe(true);
    expect(evaluateConditionGroup(orOfAnds, { a: 1, b: 0, c: 3 })).toBe(true);
    expect(evaluateConditionGroup(orOfAnds, { a: 1, b: 0, c: 0 })).toBe(false);

    const andOfOrs: ConditionGroup = {
      logic: 'AND',
      conditions: [
        {
          logic: 'OR',
          conditions: [
            { fieldPath: '#/properties/a', operator: 'eq', value: 1 },
            { fieldPath: '#/properties/a', operator: 'eq', value: 2 },
          ],
        },
        { fieldPath: '#/properties/b', operator: 'eq', value: true },
      ],
    };
    expect(evaluateConditionGroup(andOfOrs, { a: 2, b: true })).toBe(true);
    expect(evaluateConditionGroup(andOfOrs, { a: 3, b: true })).toBe(false);
  });

  it('empty conditions array is vacuously true', () => {
    expect(evaluateConditionGroup({ logic: 'AND', conditions: [] }, {})).toBe(true);
  });
});
