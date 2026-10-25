import { describe, expect, it } from 'vitest';
import { collapseSingleEdge, pageHasNoFallbackRisk } from '../../src/domain/branchInvariant';
import type { SurveyPage } from '../../src/types/survey';

function page(overrides: Partial<SurveyPage> = {}): SurveyPage {
  return {
    id: 'p1',
    title: 'Page 1',
    questions: [],
    schema: { type: 'object', properties: {} },
    uischema: { type: 'VerticalLayout', elements: [] },
    branch: [],
    defaultNextPageId: 'end',
    ...overrides,
  };
}

describe('collapseSingleEdge', () => {
  it('promotes a lone branch rule to the default and discards its condition', () => {
    const p = page({
      branch: [
        {
          id: 'r1',
          when: { logic: 'AND', conditions: [{ fieldPath: '#/properties/x', operator: 'eq', value: 1 }] },
          goToPageId: 'p2',
        },
      ],
    });
    const result = collapseSingleEdge(p);
    expect(result.defaultNextPageId).toBe('p2');
    expect(result.branch).toEqual([]);
  });

  it('leaves a page with zero outgoing edges untouched', () => {
    const p = page();
    expect(collapseSingleEdge(p)).toEqual(p);
  });

  it('leaves a page with exactly one edge that is ALREADY the default untouched', () => {
    const p = page({ defaultNextPageId: 'p2' });
    expect(collapseSingleEdge(p)).toEqual(p);
  });

  it('leaves a page with 2+ branch rules and no default untouched (nothing to collapse to)', () => {
    const p = page({
      branch: [
        { id: 'r1', when: { logic: 'AND', conditions: [] }, goToPageId: 'p2' },
        { id: 'r2', when: { logic: 'AND', conditions: [] }, goToPageId: 'p3' },
      ],
    });
    expect(collapseSingleEdge(p)).toEqual(p);
  });

  it('leaves a page with a default PLUS one branch rule untouched (2 edges, not 1)', () => {
    const p = page({
      defaultNextPageId: 'p2',
      branch: [{ id: 'r1', when: { logic: 'AND', conditions: [] }, goToPageId: 'p3' }],
    });
    expect(collapseSingleEdge(p)).toEqual(p);
  });

  it("a lone rule's goToPageId of 'end' still collapses correctly (default becomes 'end')", () => {
    const p = page({ branch: [{ id: 'r1', when: { logic: 'AND', conditions: [] }, goToPageId: 'end' }] });
    const result = collapseSingleEdge(p);
    expect(result.defaultNextPageId).toBe('end');
    expect(result.branch).toEqual([]);
  });

  it("leaves a lone 'block' rule untouched even with no default -- collapsing would silently erase the block (its goToPageId is just a placeholder, not a real destination to promote)", () => {
    const p = page({
      branch: [{ id: 'r1', action: 'block', when: { logic: 'AND', conditions: [] }, goToPageId: 'end' }],
    });
    expect(collapseSingleEdge(p)).toEqual(p);
  });
});

describe('pageHasNoFallbackRisk', () => {
  it('flags a page with 2+ conditioned edges and no default', () => {
    const p = page({
      branch: [
        { id: 'r1', when: { logic: 'AND', conditions: [] }, goToPageId: 'p2' },
        { id: 'r2', when: { logic: 'AND', conditions: [] }, goToPageId: 'p3' },
      ],
    });
    expect(pageHasNoFallbackRisk(p)).toBe(true);
  });

  it('does not flag a page with 2+ conditioned edges that also has a default', () => {
    const p = page({
      defaultNextPageId: 'p4',
      branch: [
        { id: 'r1', when: { logic: 'AND', conditions: [] }, goToPageId: 'p2' },
        { id: 'r2', when: { logic: 'AND', conditions: [] }, goToPageId: 'p3' },
      ],
    });
    expect(pageHasNoFallbackRisk(p)).toBe(false);
  });

  it('does not flag a page with a single conditioned edge and no default (not "multiple")', () => {
    const p = page({ branch: [{ id: 'r1', when: { logic: 'AND', conditions: [] }, goToPageId: 'p2' }] });
    expect(pageHasNoFallbackRisk(p)).toBe(false);
  });

  it('does not flag a page with zero outgoing edges', () => {
    expect(pageHasNoFallbackRisk(page())).toBe(false);
  });
});
