import { describe, expect, it } from 'vitest';
import Ajv from 'ajv';
import { RuleEffect } from '@jsonforms/core';
import { compileVisibilityRule } from '../../src/domain/conditionCompiler';
import type { ConditionGroup } from '../../src/types/survey';

const ajv = new Ajv();

describe('compileVisibilityRule', () => {
  it('returns undefined for null/empty groups', () => {
    expect(compileVisibilityRule(null)).toBeUndefined();
    expect(compileVisibilityRule({ logic: 'AND', conditions: [] })).toBeUndefined();
  });

  it('compiles a single eq condition into a SHOW rule with a valid JSON schema', () => {
    const group: ConditionGroup = {
      logic: 'AND',
      conditions: [{ fieldPath: '#/properties/usesCompetitor', operator: 'eq', value: true }],
    };
    const rule = compileVisibilityRule(group);
    expect(rule?.effect).toBe(RuleEffect.SHOW);
    const condition = rule!.condition as any;
    expect(condition.type).toBe('AND');
    const leaf = condition.conditions[0];
    expect(leaf.scope).toBe('#/properties/usesCompetitor');
    expect(() => ajv.compile(leaf.schema)).not.toThrow();
    expect(ajv.validate(leaf.schema, true)).toBe(true);
    expect(ajv.validate(leaf.schema, false)).toBe(false);
  });

  it('isEmpty schema validates empty string and passes for unrelated types', () => {
    const group: ConditionGroup = {
      logic: 'AND',
      conditions: [{ fieldPath: '#/properties/x', operator: 'isEmpty' }],
    };
    const rule = compileVisibilityRule(group);
    const leaf = (rule!.condition as any).conditions[0];
    expect(ajv.validate(leaf.schema, '')).toBe(true);
    expect(ajv.validate(leaf.schema, 'not empty')).toBe(false);
  });

  it('isNotEmpty schema validates non-empty string and rejects empty string', () => {
    const group: ConditionGroup = {
      logic: 'AND',
      conditions: [{ fieldPath: '#/properties/x', operator: 'isNotEmpty' }],
    };
    const rule = compileVisibilityRule(group);
    const leaf = (rule!.condition as any).conditions[0];
    expect(ajv.validate(leaf.schema, 'hello')).toBe(true);
    expect(ajv.validate(leaf.schema, '')).toBe(false);
  });

  it('compiles nested AND/OR groups preserving structure', () => {
    const group: ConditionGroup = {
      logic: 'OR',
      conditions: [
        {
          logic: 'AND',
          conditions: [
            { fieldPath: '#/properties/a', operator: 'eq', value: 1 },
            { fieldPath: '#/properties/b', operator: 'gt', value: 5 },
          ],
        },
        { fieldPath: '#/properties/c', operator: 'isNotEmpty' },
      ],
    };
    const rule = compileVisibilityRule(group);
    const condition = rule!.condition as any;
    expect(condition.type).toBe('OR');
    expect(condition.conditions).toHaveLength(2);
    expect(condition.conditions[0].type).toBe('AND');
    expect(condition.conditions[0].conditions).toHaveLength(2);
  });

  it('numeric operators produce valid ajv schemas', () => {
    for (const operator of ['gt', 'gte', 'lt', 'lte'] as const) {
      const group: ConditionGroup = {
        logic: 'AND',
        conditions: [{ fieldPath: '#/properties/n', operator, value: 5 }],
      };
      const rule = compileVisibilityRule(group);
      const leaf = (rule!.condition as any).conditions[0];
      expect(() => ajv.compile(leaf.schema)).not.toThrow();
    }
  });
});
