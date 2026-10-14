import { beforeEach, describe, expect, it } from 'vitest';
import { newSurvey, createBuilderStore, type BuilderStoreApi } from '../../src/builder/store/builderStore';
import { createFlowLayoutStore } from '../../src/builder/store/flowLayoutStore';
import { createSnackbarStore, type SnackbarStoreApi } from '../../src/builder/store/snackbarStore';
import type { BranchRule } from '../../src/types/survey';

// A fresh store per test, built the same way BuilderStoreProvider does --
// there's no module-level singleton to reach for anymore (that's the whole
// point of the store-per-instance refactor), so tests construct their own
// instance via the same factory the app/library actually use.
let useBuilderStore: BuilderStoreApi;
let useSnackbarStore: SnackbarStoreApi;

function pageIds() {
  return useBuilderStore.getState().survey.pages.map((p) => p.id);
}

beforeEach(() => {
  useSnackbarStore = createSnackbarStore();
  useBuilderStore = createBuilderStore({ flowLayoutStore: createFlowLayoutStore(), snackbarStore: useSnackbarStore }, newSurvey());
});

describe('addPage', () => {
  it('adds a standalone page: no defaultNextPageId set on it or rewired on the previous last page', () => {
    useBuilderStore.getState().addPage();
    useBuilderStore.getState().addPage();
    const pages = useBuilderStore.getState().survey.pages;
    expect(pages).toHaveLength(3);
    // Nothing points at the newly-added pages, and nothing they point to
    // either -- they start fully disconnected from the flow.
    for (const p of pages) {
      expect(p.defaultNextPageId).toBe('end');
    }
  });
});

describe('duplicatePage', () => {
  it('copies questions with fresh ids, inserted right after the original, starting unconnected', () => {
    const [firstId] = pageIds();
    useBuilderStore.getState().addQuestion(firstId, 'shortText');
    const originalQuestionId = useBuilderStore.getState().survey.pages[0].questions[0].id;
    useBuilderStore.getState().setScoringForQuestion(originalQuestionId, { valueScore: 5 });

    useBuilderStore.getState().duplicatePage(firstId);

    const pages = useBuilderStore.getState().survey.pages;
    expect(pages).toHaveLength(2);
    const copy = pages[1];
    expect(copy.title).toBe('Page 1 (copy)');
    expect(copy.questions).toHaveLength(1);
    expect(copy.questions[0].id).not.toBe(originalQuestionId);
    // Scoring configured for the original question carries over to the
    // copy's new question id, not silently dropped.
    expect(useBuilderStore.getState().survey.scoringMap?.[`#/properties/${copy.questions[0].id}`]).toEqual({
      valueScore: 5,
    });
    // Like addPage, the copy starts fully disconnected -- wiring it in is
    // the caller's job (the dot menu's connect logic), not this action's.
    expect(copy.defaultNextPageId).toBe('end');
    expect(copy.branch).toEqual([]);
  });

  it('becomes the active page, like addPage', () => {
    const [firstId] = pageIds();
    useBuilderStore.getState().duplicatePage(firstId);
    const copyId = useBuilderStore.getState().survey.pages[1].id;
    expect(useBuilderStore.getState().selectedPageId).toBe(copyId);
  });

  it('is a no-op for an unknown page id', () => {
    const before = useBuilderStore.getState().survey;
    useBuilderStore.getState().duplicatePage('missing-page');
    expect(useBuilderStore.getState().survey).toBe(before);
  });
});

describe('branch rule actions', () => {
  function twoPages() {
    useBuilderStore.getState().addPage();
    const [firstId, secondId] = pageIds();
    return { firstId, secondId };
  }

  it('addBranchRule appends a rule to the target page without touching others', () => {
    const { firstId, secondId } = twoPages();
    const rule: BranchRule = { id: 'r1', when: { logic: 'AND', conditions: [] }, goToPageId: secondId };

    useBuilderStore.getState().addBranchRule(firstId, rule);

    const page = useBuilderStore.getState().survey.pages.find((p) => p.id === firstId)!;
    expect(page.branch).toEqual([rule]);
  });

  it('updateBranchRule patches only the matching rule by id', () => {
    const { firstId, secondId } = twoPages();
    const ruleA: BranchRule = { id: 'a', when: { logic: 'AND', conditions: [] }, goToPageId: secondId };
    const ruleB: BranchRule = { id: 'b', when: { logic: 'AND', conditions: [] }, goToPageId: 'end' };
    useBuilderStore.getState().addBranchRule(firstId, ruleA);
    useBuilderStore.getState().addBranchRule(firstId, ruleB);

    useBuilderStore.getState().updateBranchRule(firstId, 'b', { goToPageId: secondId });

    const page = useBuilderStore.getState().survey.pages.find((p) => p.id === firstId)!;
    expect(page.branch.find((r) => r.id === 'a')?.goToPageId).toBe(secondId);
    expect(page.branch.find((r) => r.id === 'b')?.goToPageId).toBe(secondId);
  });

  it('removeBranchRule removes only the matching rule, leaving others intact (3+ rules, so no collapse)', () => {
    const { firstId, secondId } = twoPages();
    useBuilderStore.getState().addPage();
    const thirdId = pageIds()[2];
    const ruleA: BranchRule = { id: 'a', when: { logic: 'AND', conditions: [] }, goToPageId: secondId };
    const ruleB: BranchRule = { id: 'b', when: { logic: 'AND', conditions: [] }, goToPageId: 'end' };
    const ruleC: BranchRule = { id: 'c', when: { logic: 'AND', conditions: [] }, goToPageId: thirdId };
    useBuilderStore.getState().addBranchRule(firstId, ruleA);
    useBuilderStore.getState().addBranchRule(firstId, ruleB);
    useBuilderStore.getState().addBranchRule(firstId, ruleC);

    useBuilderStore.getState().removeBranchRule(firstId, 'a');

    const page = useBuilderStore.getState().survey.pages.find((p) => p.id === firstId)!;
    // 2 rules remain -- below the "collapse to plain default" threshold, so
    // both stay exactly as they were (see the dedicated collapse tests).
    expect(page.branch.map((r) => r.id)).toEqual(['b', 'c']);
  });

  it('a no-op patch/removal for an unknown page id does not throw or mutate anything', () => {
    const before = useBuilderStore.getState().survey;
    useBuilderStore.getState().updateBranchRule('missing-page', 'r1', { goToPageId: 'end' });
    useBuilderStore.getState().removeBranchRule('missing-page', 'r1');
    expect(useBuilderStore.getState().survey).toBe(before);
  });

  it('records branch rule changes in undo history', () => {
    const { firstId, secondId } = twoPages();
    const rule: BranchRule = { id: 'r1', when: { logic: 'AND', conditions: [] }, goToPageId: secondId };
    useBuilderStore.getState().addBranchRule(firstId, rule);
    expect(useBuilderStore.getState().survey.pages.find((p) => p.id === firstId)!.branch).toHaveLength(1);

    useBuilderStore.getState().undo();
    expect(useBuilderStore.getState().survey.pages.find((p) => p.id === firstId)!.branch).toHaveLength(0);

    useBuilderStore.getState().redo();
    expect(useBuilderStore.getState().survey.pages.find((p) => p.id === firstId)!.branch).toHaveLength(1);
  });
});

describe('single-fallback-edge invariant', () => {
  function threePages() {
    useBuilderStore.getState().addPage();
    useBuilderStore.getState().addPage();
    const [firstId, secondId, thirdId] = pageIds();
    return { firstId, secondId, thirdId };
  }

  it('adding a 2nd edge (a branch rule alongside an existing plain default) leaves both as-is', () => {
    const { firstId, secondId, thirdId } = threePages();
    useBuilderStore.getState().setDefaultNextPage(firstId, secondId);

    useBuilderStore.getState().addBranchRule(firstId, {
      id: 'r1',
      when: { logic: 'AND', conditions: [{ fieldPath: '#/properties/x', operator: 'eq', value: 1 }] },
      goToPageId: thirdId,
    });

    const page = useBuilderStore.getState().survey.pages.find((p) => p.id === firstId)!;
    expect(page.defaultNextPageId).toBe(secondId);
    expect(page.branch.map((r) => r.id)).toEqual(['r1']);
  });

  it('adding a 3rd edge just adds another rule; the existing fallback is untouched', () => {
    const { firstId, secondId, thirdId } = threePages();
    useBuilderStore.getState().addPage();
    const fourthId = pageIds()[3];
    useBuilderStore.getState().setDefaultNextPage(firstId, secondId);
    useBuilderStore.getState().addBranchRule(firstId, { id: 'r1', when: { logic: 'AND', conditions: [] }, goToPageId: thirdId });

    useBuilderStore.getState().addBranchRule(firstId, { id: 'r2', when: { logic: 'AND', conditions: [] }, goToPageId: fourthId });

    const page = useBuilderStore.getState().survey.pages.find((p) => p.id === firstId)!;
    expect(page.defaultNextPageId).toBe(secondId);
    expect(page.branch.map((r) => r.id)).toEqual(['r1', 'r2']);
  });

  it('removeBranchRule collapses the sole remaining branch rule into the plain default', () => {
    const { firstId, secondId, thirdId } = threePages();
    useBuilderStore.getState().addBranchRule(firstId, { id: 'r1', when: { logic: 'AND', conditions: [] }, goToPageId: secondId });
    useBuilderStore.getState().addBranchRule(firstId, { id: 'r2', when: { logic: 'AND', conditions: [] }, goToPageId: thirdId });

    useBuilderStore.getState().removeBranchRule(firstId, 'r1');

    const page = useBuilderStore.getState().survey.pages.find((p) => p.id === firstId)!;
    expect(page.branch).toEqual([]);
    expect(page.defaultNextPageId).toBe(thirdId);
  });

  it('clearing the default via setDefaultNextPage(\'end\') collapses a sole remaining branch rule', () => {
    const { firstId, secondId, thirdId } = threePages();
    useBuilderStore.getState().setDefaultNextPage(firstId, secondId);
    useBuilderStore.getState().addBranchRule(firstId, { id: 'r1', when: { logic: 'AND', conditions: [] }, goToPageId: thirdId });

    // Now 2 edges (default=secondId, branch=[r1]). Clearing the default
    // leaves r1 as the page's only outgoing edge -- it must collapse into
    // being the new plain default, not sit there as a lone conditioned rule.
    useBuilderStore.getState().setDefaultNextPage(firstId, 'end');

    const page = useBuilderStore.getState().survey.pages.find((p) => p.id === firstId)!;
    expect(page.branch).toEqual([]);
    expect(page.defaultNextPageId).toBe(thirdId);
  });

  it('a page\'s very first edge, added via "+ Add rule" on an empty page, stays a real editable rule (not silently absorbed)', () => {
    const { firstId, secondId } = threePages();
    useBuilderStore.getState().addBranchRule(firstId, { id: 'r1', when: { logic: 'AND', conditions: [] }, goToPageId: secondId });

    const page = useBuilderStore.getState().survey.pages.find((p) => p.id === firstId)!;
    expect(page.branch.map((r) => r.id)).toEqual(['r1']);
    expect(page.defaultNextPageId).toBe('end');
  });

  it('warns via the snackbar when a page ends up with 2+ conditioned edges and no fallback', () => {
    const { firstId, secondId, thirdId } = threePages();
    useBuilderStore.getState().addBranchRule(firstId, { id: 'r1', when: { logic: 'AND', conditions: [] }, goToPageId: secondId });

    useBuilderStore.getState().addBranchRule(firstId, { id: 'r2', when: { logic: 'AND', conditions: [] }, goToPageId: thirdId });

    expect(useSnackbarStore.getState().severity).toBe('warning');
    expect(useSnackbarStore.getState().message).toMatch(/no fallback/);
  });

  it('does not warn when a 2nd conditioned edge is added alongside an existing plain default', () => {
    const { firstId, secondId, thirdId } = threePages();
    useBuilderStore.getState().setDefaultNextPage(firstId, secondId);

    useBuilderStore.getState().addBranchRule(firstId, { id: 'r1', when: { logic: 'AND', conditions: [] }, goToPageId: thirdId });

    expect(useSnackbarStore.getState().message).toBeNull();
  });

  it('does not warn for a single conditioned edge with no fallback (only "2+" is a risk)', () => {
    const { firstId, secondId } = threePages();
    useBuilderStore.getState().addBranchRule(firstId, { id: 'r1', when: { logic: 'AND', conditions: [] }, goToPageId: secondId });

    expect(useSnackbarStore.getState().message).toBeNull();
  });
});

describe('reorderBranchRule', () => {
  it('changes evaluation order (array order) for the target page only', () => {
    useBuilderStore.getState().addPage();
    useBuilderStore.getState().addPage();
    const [firstId, secondId, thirdId] = pageIds();
    useBuilderStore.getState().addBranchRule(firstId, { id: 'r1', when: { logic: 'AND', conditions: [] }, goToPageId: secondId });
    useBuilderStore.getState().addBranchRule(firstId, { id: 'r2', when: { logic: 'AND', conditions: [] }, goToPageId: thirdId });

    useBuilderStore.getState().reorderBranchRule(firstId, 0, 1);

    const page = useBuilderStore.getState().survey.pages.find((p) => p.id === firstId)!;
    expect(page.branch.map((r) => r.id)).toEqual(['r2', 'r1']);
  });
});

describe('reorderPage', () => {
  it('changes only the pages array order, leaving defaultNextPageId untouched', () => {
    useBuilderStore.getState().addPage();
    useBuilderStore.getState().addPage();
    const before = useBuilderStore.getState().survey.pages.map((p) => ({ id: p.id, next: p.defaultNextPageId }));

    useBuilderStore.getState().reorderPage(2, 0);

    const after = useBuilderStore.getState().survey.pages;
    expect(after.map((p) => p.id)).toEqual([before[2].id, before[0].id, before[1].id]);
    // Deliberately unchanged: reordering is a list/visual operation only, so
    // it can never silently orphan a page from the default navigation chain.
    for (const p of after) {
      expect(p.defaultNextPageId).toBe(before.find((b) => b.id === p.id)!.next);
    }
  });
});

describe('reorderPage and startPageId', () => {
  it('reordering never changes startPageId -- it stays list/visual-only, like defaultNextPageId', () => {
    useBuilderStore.getState().addPage();
    useBuilderStore.getState().addPage();
    const originalStart = useBuilderStore.getState().survey.startPageId;

    // Move the current start page out of the first array slot.
    useBuilderStore.getState().reorderPage(0, 2);

    expect(useBuilderStore.getState().survey.pages[0].id).not.toBe(originalStart);
    expect(useBuilderStore.getState().survey.startPageId).toBe(originalStart);
  });
});

describe('setStartPage', () => {
  it('is the only way startPageId changes outside of deleting the start page', () => {
    useBuilderStore.getState().addPage();
    const [, secondId] = pageIds();

    useBuilderStore.getState().setStartPage(secondId);

    expect(useBuilderStore.getState().survey.startPageId).toBe(secondId);
  });

  it('records the change in undo history', () => {
    useBuilderStore.getState().addPage();
    const [firstId, secondId] = pageIds();

    useBuilderStore.getState().setStartPage(secondId);
    expect(useBuilderStore.getState().survey.startPageId).toBe(secondId);

    useBuilderStore.getState().undo();
    expect(useBuilderStore.getState().survey.startPageId).toBe(firstId);
  });
});

describe('setPageBlocksSubmission', () => {
  it('sets the flag on only the target page', () => {
    useBuilderStore.getState().addPage();
    const [firstId, secondId] = pageIds();

    useBuilderStore.getState().setPageBlocksSubmission(secondId, true);

    const pages = useBuilderStore.getState().survey.pages;
    expect(pages.find((p) => p.id === firstId)!.blocksSubmission).toBeFalsy();
    expect(pages.find((p) => p.id === secondId)!.blocksSubmission).toBe(true);
  });

  it('actually routes the page to End of survey, not just labels it', () => {
    useBuilderStore.getState().addPage();
    const [firstId, secondId] = pageIds();
    useBuilderStore.getState().setDefaultNextPage(firstId, secondId);
    expect(useBuilderStore.getState().survey.pages.find((p) => p.id === firstId)!.defaultNextPageId).toBe(secondId);

    useBuilderStore.getState().setPageBlocksSubmission(firstId, true);

    expect(useBuilderStore.getState().survey.pages.find((p) => p.id === firstId)!.defaultNextPageId).toBe('end');
  });

  it('leaves an existing branch rule in place -- only the default edge changes', () => {
    useBuilderStore.getState().addPage();
    const [firstId, secondId] = pageIds();
    const rule: BranchRule = {
      id: 'r1',
      when: { logic: 'AND', conditions: [{ fieldPath: '#/properties/x', operator: 'eq', value: true }] },
      goToPageId: secondId,
    };
    useBuilderStore.getState().addBranchRule(firstId, rule);

    useBuilderStore.getState().setPageBlocksSubmission(firstId, true);

    const page = useBuilderStore.getState().survey.pages.find((p) => p.id === firstId)!;
    expect(page.branch).toEqual([rule]);
    expect(page.defaultNextPageId).toBe('end');
  });

  it('does not change defaultNextPageId when turning the flag back off', () => {
    useBuilderStore.getState().addPage();
    const [firstId] = pageIds();
    useBuilderStore.getState().setPageBlocksSubmission(firstId, true);
    expect(useBuilderStore.getState().survey.pages.find((p) => p.id === firstId)!.defaultNextPageId).toBe('end');

    useBuilderStore.getState().setPageBlocksSubmission(firstId, false);

    const page = useBuilderStore.getState().survey.pages.find((p) => p.id === firstId)!;
    expect(page.blocksSubmission).toBe(false);
    expect(page.defaultNextPageId).toBe('end'); // not auto-restored; a manual "Otherwise, go to" choice if the author wants it to lead elsewhere again
  });
});
