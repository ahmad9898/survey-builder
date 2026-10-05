import { describe, expect, it } from 'vitest';
import { validateBranchTarget, wouldCreateCycle } from '../../src/domain/graphValidation';
import type { Survey, SurveyPage } from '../../src/types/survey';

function page(overrides: Partial<SurveyPage> & Pick<SurveyPage, 'id' | 'title'>): SurveyPage {
  return {
    questions: [],
    schema: { type: 'object', properties: {} },
    uischema: { type: 'VerticalLayout', elements: [] },
    branch: [],
    defaultNextPageId: 'end',
    ...overrides,
  };
}

function survey(pages: SurveyPage[]): Survey {
  return {
    id: 's1',
    title: 'Demo',
    version: 1,
    createdAt: '',
    updatedAt: '',
    startPageId: pages[0].id,
    pages,
  };
}

describe('wouldCreateCycle', () => {
  it('flags a page linking to itself', () => {
    const s = survey([page({ id: 'a', title: 'A' })]);
    expect(wouldCreateCycle(s, 'a', 'a')).toBe(true);
  });

  it('flags a new edge that would close a loop through existing edges', () => {
    const s = survey([
      page({ id: 'a', title: 'A', defaultNextPageId: 'b' }),
      page({ id: 'b', title: 'B', defaultNextPageId: 'c' }),
      page({ id: 'c', title: 'C' }),
    ]);
    // c -> a would close a -> b -> c -> a.
    expect(wouldCreateCycle(s, 'c', 'a')).toBe(true);
  });

  it('allows a forward edge that does not loop back', () => {
    const s = survey([
      page({ id: 'a', title: 'A', defaultNextPageId: 'b' }),
      page({ id: 'b', title: 'B' }),
      page({ id: 'c', title: 'C' }),
    ]);
    expect(wouldCreateCycle(s, 'a', 'c')).toBe(false);
  });

  it('allows two independent branches converging on the same downstream page (not a cycle)', () => {
    const s = survey([
      page({ id: 'a', title: 'A' }),
      page({ id: 'b', title: 'B' }),
      page({ id: 'c', title: 'C' }),
    ]);
    // a -> c and b -> c both existing/being added is a merge, not a loop.
    expect(wouldCreateCycle(s, 'a', 'c')).toBe(false);
    expect(wouldCreateCycle(s, 'b', 'c')).toBe(false);
  });
});

describe('validateBranchTarget', () => {
  const s = survey([
    page({ id: 'a', title: 'A', defaultNextPageId: 'b' }),
    page({ id: 'b', title: 'B' }),
  ]);

  it('rejects a self-reference with a reason', () => {
    const result = validateBranchTarget(s, 'a', 'a');
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/itself/i);
  });

  it('rejects a target page that does not exist', () => {
    const result = validateBranchTarget(s, 'a', 'missing');
    expect(result.valid).toBe(false);
  });

  it('rejects a cycle with a reason', () => {
    const result = validateBranchTarget(s, 'b', 'a');
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/loop/i);
  });

  it('accepts a valid forward link', () => {
    const s2 = survey([
      page({ id: 'a', title: 'A' }),
      page({ id: 'b', title: 'B' }),
    ]);
    expect(validateBranchTarget(s2, 'a', 'b')).toEqual({ valid: true });
  });
});
