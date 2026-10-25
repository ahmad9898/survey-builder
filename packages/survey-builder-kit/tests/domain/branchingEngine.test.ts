import { describe, expect, it } from 'vitest';
import { resolveNextPage, isPageBlockedByRule } from '../../src/domain/branchingEngine';
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

  it('reordering the rules array changes which overlapping rule wins (order is real, not cosmetic)', () => {
    const rules: SurveyPage['branch'] = [
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
    ];
    const original = makePage({ branch: rules });
    const reordered = makePage({ branch: [rules[1], rules[0]] });
    // Both rules match x=15; whichever is listed first wins, in either order.
    expect(resolveNextPage(original, { x: 15 })).toBe('page_low');
    expect(resolveNextPage(reordered, { x: 15 })).toBe('page_high');
  });

  it("the default (Otherwise) edge is evaluated last regardless of the branch array's order", () => {
    const page = makePage({
      defaultNextPageId: 'page_fallback',
      branch: [
        {
          id: 'r1',
          when: { logic: 'AND', conditions: [{ fieldPath: '#/properties/x', operator: 'eq', value: 1 }] },
          goToPageId: 'page_match',
        },
      ],
    });
    expect(resolveNextPage(page, { x: 999 })).toBe('page_fallback');
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

  it("skips a matching 'block' rule entirely -- falls through to the next rule", () => {
    const page = makePage({
      branch: [
        {
          id: 'r1',
          action: 'block',
          when: { logic: 'AND', conditions: [{ fieldPath: '#/properties/x', operator: 'eq', value: 1 }] },
          goToPageId: 'end',
        },
        {
          id: 'r2',
          when: { logic: 'AND', conditions: [{ fieldPath: '#/properties/x', operator: 'eq', value: 1 }] },
          goToPageId: 'page_3',
        },
      ],
    });
    expect(resolveNextPage(page, { x: 1 })).toBe('page_3');
  });

  it("skips a matching 'block' rule and falls through to defaultNextPageId when nothing else matches", () => {
    const page = makePage({
      branch: [
        {
          id: 'r1',
          action: 'block',
          when: { logic: 'AND', conditions: [{ fieldPath: '#/properties/x', operator: 'eq', value: 1 }] },
          goToPageId: 'end',
        },
      ],
    });
    expect(resolveNextPage(page, { x: 1 })).toBe('page_2');
  });
});

describe('isPageBlockedByRule', () => {
  it('is false with no branch rules', () => {
    expect(isPageBlockedByRule(makePage(), {})).toBe(false);
  });

  it("is true when a 'block' rule's condition matches", () => {
    const page = makePage({
      branch: [
        {
          id: 'r1',
          action: 'block',
          when: { logic: 'AND', conditions: [{ fieldPath: '#/properties/x', operator: 'eq', value: 1 }] },
          goToPageId: 'end',
        },
      ],
    });
    expect(isPageBlockedByRule(page, { x: 1 })).toBe(true);
  });

  it("is false when the 'block' rule's condition does not match", () => {
    const page = makePage({
      branch: [
        {
          id: 'r1',
          action: 'block',
          when: { logic: 'AND', conditions: [{ fieldPath: '#/properties/x', operator: 'eq', value: 1 }] },
          goToPageId: 'end',
        },
      ],
    });
    expect(isPageBlockedByRule(page, { x: 2 })).toBe(false);
  });

  it("is false for a matching rule whose action is 'goToPage' (or unset)", () => {
    const page = makePage({
      branch: [
        {
          id: 'r1',
          when: { logic: 'AND', conditions: [{ fieldPath: '#/properties/x', operator: 'eq', value: 1 }] },
          goToPageId: 'page_3',
        },
      ],
    });
    expect(isPageBlockedByRule(page, { x: 1 })).toBe(false);
  });

  it('is true even when an earlier goToPage rule matches first (not "first match wins" -- every block rule is checked)', () => {
    const page = makePage({
      branch: [
        {
          id: 'r1',
          when: { logic: 'AND', conditions: [{ fieldPath: '#/properties/x', operator: 'eq', value: 1 }] },
          goToPageId: 'page_3',
        },
        {
          id: 'r2',
          action: 'block',
          when: { logic: 'AND', conditions: [{ fieldPath: '#/properties/x', operator: 'eq', value: 1 }] },
          goToPageId: 'end',
        },
      ],
    });
    expect(isPageBlockedByRule(page, { x: 1 })).toBe(true);
  });
});
