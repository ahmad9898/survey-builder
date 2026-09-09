import { describe, expect, it } from 'vitest';
import { resolveNextPage } from '../../src/domain/branchingEngine';
import type { SurveyPage } from '../../src/types/survey';

function makePage(overrides: Partial<SurveyPage> = {}): SurveyPage {
  return {
    id: 'page_1',
    title: 'Page 1',
    questions: [],
    schema: { type: 'object', properties: {} },
    uischema: { type: 'VerticalLayout', elements: [] },
    branch: [],
    defaultNextPageId: 'page_2',
    ...overrides,
  };
}

describe('resolveNextPage', () => {
  it('falls back to defaultNextPageId when no rules configured', () => {
    const page = makePage();
    expect(resolveNextPage(page, {})).toBe('page_2');
  });

  it('falls back to defaultNextPageId when no rule matches', () => {
    const page = makePage({
      branch: [
        {
          id: 'r1',
          when: { logic: 'AND', conditions: [{ fieldPath: '#/properties/x', operator: 'eq', value: 1 }] },
          goToPageId: 'page_3',
        },
      ],
    });
    expect(resolveNextPage(page, { x: 2 })).toBe('page_2');
  });

  it('first matching rule wins, in array order', () => {
    const page = makePage({
      branch: [
        {
          id: 'r1',
          when: { logic: 'AND', conditions: [{ fieldPath: '#/properties/x', operator: 'gte', value: 0 }] },
          goToPageId: 'page_low',
        },
        {
          id: 'r2',
          when: { logic: 'AND', conditions: [{ fieldPath: '#/properties/x', operator: 'gte', value: 10 }] },
          goToPageId: 'page_high',
        },
      ],
    });
    // both rules match for x=15, but r1 is listed first and must win
    expect(resolveNextPage(page, { x: 15 })).toBe('page_low');
  });

  it('can resolve to "end"', () => {
    const page = makePage({
      branch: [
        {
          id: 'r1',
          when: { logic: 'AND', conditions: [{ fieldPath: '#/properties/done', operator: 'eq', value: true }] },
          goToPageId: 'end',
        },
      ],
    });
    expect(resolveNextPage(page, { done: true })).toBe('end');
  });

  it('resolves a rule referencing a field from an earlier page (flat answers object)', () => {
    const page = makePage({
      branch: [
        {
          id: 'r1',
          when: {
            logic: 'AND',
            conditions: [{ fieldPath: '#/properties/usesCompetitor', operator: 'eq', value: true }],
          },
          goToPageId: 'page_2b',
        },
      ],
    });
    // usesCompetitor was answered on a previous page but lives in the same flat answers object
    expect(resolveNextPage(page, { usesCompetitor: true, unrelatedField: 'x' })).toBe('page_2b');
  });
});
