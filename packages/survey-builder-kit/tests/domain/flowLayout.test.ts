import { describe, expect, it } from 'vitest';
import {
  computeFlowOverviewStats,
  estimateProgress,
  isPageUnconnected,
  pageFlowOrderDiffers,
  pageHasDisqualifyingOption,
  pageIconKind,
  pagesToFlow,
  START_NODE_ID,
} from '../../src/domain/flowLayout';
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

function survey(pages: SurveyPage[], startPageId = pages[0].id): Survey {
  return {
    id: 'survey_1',
    title: 'Demo',
    version: 1,
    createdAt: '',
    updatedAt: '',
    startPageId,
    pages,
  };
}

// Reconstructs the health-screening example: a straight chain into a branch
// point (heart attack Yes/No) that fans out to a blocking notice page and a
// normal continuation page.
function healthScreeningDemo(): Survey {
  const p1 = page({
    id: 'p1',
    title: 'Date of birth',
    questions: [{ id: 'dob', type: 'date', label: 'Date of birth' }],
    defaultNextPageId: 'p2',
  });
  const p2 = page({ id: 'p2', title: 'Page 2', questions: [{ id: 'q2', type: 'shortText', label: 'Q2' }], defaultNextPageId: 'p3' });
  const p3 = page({
    id: 'p3',
    title: 'Heart attack in the last 12 months?',
    questions: [{ id: 'heartAttack', type: 'boolean', label: 'Heart attack in the last 12 months' }],
    branch: [
      {
        id: 'rule1',
        when: { logic: 'AND', conditions: [{ fieldPath: '#/properties/heartAttack', operator: 'eq', value: true }] },
        goToPageId: 'p4',
      },
    ],
    defaultNextPageId: 'p5',
  });
  const p4 = page({
    id: 'p4',
    title: 'Page 4',
    questions: [{ id: 'notice', type: 'label', label: 'Medical Review Required' }],
    blocksSubmission: true,
  });
  const p5 = page({
    id: 'p5',
    title: 'Have you had a stroke in the last 12 months?',
    questions: [{ id: 'stroke', type: 'boolean', label: 'Stroke in the last 12 months' }],
  });
  return survey([p1, p2, p3, p4, p5]);
}

describe('pagesToFlow', () => {
  it('lays out a linear survey (no branching) left-to-right on one row', () => {
    const s = survey([
      page({ id: 'a', title: 'A', defaultNextPageId: 'b' }),
      page({ id: 'b', title: 'B', defaultNextPageId: 'c' }),
      page({ id: 'c', title: 'C' }),
    ]);
    const { nodes, edges } = pagesToFlow(s);
    const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
    expect(byId.a.position.x).toBeLessThan(byId.b.position.x);
    expect(byId.b.position.x).toBeLessThan(byId.c.position.x);
    expect(byId.a.position.y).toBe(byId.b.position.y);
    expect(byId.b.position.y).toBe(byId.c.position.y);
    expect(edges).toHaveLength(2);
    expect(byId.c.data.endsFlow).toBe(true);
  });

  it("fans a branch point's targets above/below its row and labels the boolean condition", () => {
    const { nodes, edges } = pagesToFlow(healthScreeningDemo());
    const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));

    // Straight chain up to the branch point stays on one row, moving right.
    expect(byId.p1.position.y).toBe(byId.p2.position.y);
    expect(byId.p2.position.y).toBe(byId.p3.position.y);
    expect(byId.p1.position.x).toBeLessThan(byId.p2.position.x);
    expect(byId.p2.position.x).toBeLessThan(byId.p3.position.x);

    // p4 (the "Yes" target) fans up, p5 (the default "No" path) fans down,
    // both further right than the branch point, and at the same column as
    // each other since they're both one hop from it.
    expect(byId.p4.position.x).toBe(byId.p5.position.x);
    expect(byId.p4.position.x).toBeGreaterThan(byId.p3.position.x);
    expect(byId.p4.position.y).toBeLessThan(byId.p3.position.y);
    expect(byId.p5.position.y).toBeGreaterThan(byId.p3.position.y);

    const p3ToP4 = edges.find((e) => e.source === 'p3' && e.target === 'p4')!;
    const p3ToP5 = edges.find((e) => e.source === 'p3' && e.target === 'p5')!;
    expect(p3ToP4.label).toBe('Yes');
    expect(p3ToP4.data.variant).toBe('positive');
    expect(p3ToP4.data.ruleId).toBe('rule1');
    expect(p3ToP5.label).toBe('No');
    expect(p3ToP5.data.variant).toBe('neutral');
    expect(p3ToP5.data.isDefault).toBe(true);
    expect(p3ToP5.data.ruleId).toBeUndefined();
  });

  it('never places two nodes overlapping, even with several sibling branches', () => {
    const s = survey([
      page({
        id: 'root',
        title: 'Root',
        questions: [{ id: 'q', type: 'number', label: 'Score' }],
        branch: [
          { id: 'r1', when: { logic: 'AND', conditions: [{ fieldPath: '#/properties/q', operator: 'gte', value: 90 }] }, goToPageId: 'a' },
          { id: 'r2', when: { logic: 'AND', conditions: [{ fieldPath: '#/properties/q', operator: 'gte', value: 70 }] }, goToPageId: 'b' },
          { id: 'r3', when: { logic: 'AND', conditions: [{ fieldPath: '#/properties/q', operator: 'gte', value: 50 }] }, goToPageId: 'c' },
        ],
        defaultNextPageId: 'd',
      }),
      page({ id: 'a', title: 'A' }),
      page({ id: 'b', title: 'B' }),
      page({ id: 'c', title: 'C' }),
      page({ id: 'd', title: 'D' }),
    ]);
    const { nodes } = pagesToFlow(s);
    const NODE_WIDTH = 190;
    const NODE_HEIGHT = 100;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i].position;
        const b = nodes[j].position;
        const overlapsX = Math.abs(a.x - b.x) < NODE_WIDTH;
        const overlapsY = Math.abs(a.y - b.y) < NODE_HEIGHT;
        expect(overlapsX && overlapsY, `${nodes[i].id} and ${nodes[j].id} overlap`).toBe(false);
      }
    }
  });

  it('overlays a saved position override on top of the auto-layout result', () => {
    const s = survey([
      page({ id: 'a', title: 'A', defaultNextPageId: 'b' }),
      page({ id: 'b', title: 'B' }),
    ]);
    const auto = pagesToFlow(s);
    const autoA = auto.nodes.find((n) => n.id === 'a')!.position;

    const withOverride = pagesToFlow(s, { a: { x: 999, y: 888 } });
    expect(withOverride.nodes.find((n) => n.id === 'a')!.position).toEqual({ x: 999, y: 888 });
    // The untouched page still gets its normal computed position.
    expect(withOverride.nodes.find((n) => n.id === 'b')!.position).toEqual(auto.nodes.find((n) => n.id === 'b')!.position);
    expect(autoA).not.toEqual({ x: 999, y: 888 });
  });

  it('flags p4 as conditional-only and blocking, p5 as a normal continuation that ends the flow', () => {
    const { nodes } = pagesToFlow(healthScreeningDemo());
    const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));

    expect(byId.p4.data.isConditionalOnly).toBe(true);
    expect(byId.p4.data.blocksSubmission).toBe(true);
    expect(byId.p4.data.endsFlow).toBe(false);

    expect(byId.p5.data.isConditionalOnly).toBe(false);
    expect(byId.p5.data.blocksSubmission).toBe(false);
    expect(byId.p5.data.endsFlow).toBe(true);

    expect(byId.p3.data.isBranchPoint).toBe(true);
    expect(byId.p1.data.isBranchPoint).toBe(false);
  });

  it('does not emit nodes/edges for the synthetic "end" target', () => {
    const s = survey([page({ id: 'a', title: 'A' })]);
    const { nodes, edges } = pagesToFlow(s);
    expect(nodes.map((n) => n.id)).toEqual(['a']);
    expect(edges).toHaveLength(0);
  });

  it('still places a page that is unreachable from the start page, rather than dropping it', () => {
    const s = survey([
      page({ id: 'a', title: 'A' }),
      page({ id: 'orphan', title: 'Orphan' }),
    ]);
    const { nodes } = pagesToFlow(s);
    expect(nodes.map((n) => n.id).sort()).toEqual(['a', 'orphan']);
    const orphan = nodes.find((n) => n.id === 'orphan')!;
    expect(orphan.position.x).toBeGreaterThan(0);
  });

  it('summarizes a non-boolean condition generically', () => {
    const s = survey([
      page({
        id: 'a',
        title: 'A',
        questions: [{ id: 'age', type: 'number', label: 'Age' }],
        branch: [
          {
            id: 'r1',
            when: { logic: 'AND', conditions: [{ fieldPath: '#/properties/age', operator: 'gte', value: 65 }] },
            goToPageId: 'b',
          },
        ],
      }),
      page({ id: 'b', title: 'B' }),
    ]);
    const { edges } = pagesToFlow(s);
    expect(edges[0].label).toBe('Age ≥ 65');
    expect(edges[0].data.variant).toBe('neutral');
  });

  it('a page\'s single plain default edge is unlabeled; adding a 2nd (conditioned) edge auto-relabels it "Otherwise"', () => {
    // a -> b starts as a's only, plain, condition-free edge.
    const plain = survey([
      page({ id: 'a', title: 'A', questions: [{ id: 'q', type: 'boolean', label: 'Q' }], defaultNextPageId: 'b' }),
      page({ id: 'b', title: 'B' }),
      page({ id: 'c', title: 'C' }),
    ]);
    const before = pagesToFlow(plain);
    expect(before.edges).toHaveLength(1);
    expect(before.edges[0]).toMatchObject({ source: 'a', target: 'b', label: '' });

    // Adding a 2nd, conditioned edge (a -> c) is the only change -- the
    // store never rewrites a's defaultNextPageId for this -- yet the
    // ORIGINAL edge (a -> b) automatically renders with the "Otherwise"
    // treatment purely because the derivation is a function of "does this
    // page have any branch rules", not something set on the edge itself.
    const withSecondEdge = survey([
      page({
        id: 'a',
        title: 'A',
        questions: [{ id: 'q', type: 'boolean', label: 'Q' }],
        defaultNextPageId: 'b',
        branch: [
          {
            id: 'r1',
            when: { logic: 'AND', conditions: [{ fieldPath: '#/properties/q', operator: 'eq', value: true }] },
            goToPageId: 'c',
          },
        ],
      }),
      page({ id: 'b', title: 'B' }),
      page({ id: 'c', title: 'C' }),
    ]);
    const after = pagesToFlow(withSecondEdge);
    const abEdge = after.edges.find((e) => e.source === 'a' && e.target === 'b')!;
    expect(abEdge.label).toBe('No'); // boolean branch point: the non-matching path reads as "No"
    expect(abEdge.data.isDefault).toBe(true);
    expect(abEdge.data.variant).toBe('neutral');
  });
});

describe('pagesToFlow startMarker', () => {
  it('points at survey.startPageId, positioned one step before that page', () => {
    const s = survey([
      page({ id: 'a', title: 'A', defaultNextPageId: 'b' }),
      page({ id: 'b', title: 'B' }),
    ]);
    const { nodes, startMarker } = pagesToFlow(s);
    expect(startMarker).not.toBeNull();
    expect(startMarker!.id).toBe(START_NODE_ID);
    expect(startMarker!.edge).toEqual({ id: `${START_NODE_ID}-edge`, source: START_NODE_ID, target: 'a' });
    const a = nodes.find((n) => n.id === 'a')!;
    expect(startMarker!.position.x).toBeLessThan(a.position.x);
  });

  it('follows startPageId, not array position, when the start page is not pages[0]', () => {
    // Cosmetic-only reorder: 'b' is now first in the list, but 'a' is still
    // the actual runtime start page -- the marker must track 'a'.
    const s = survey(
      [page({ id: 'b', title: 'B' }), page({ id: 'a', title: 'A', defaultNextPageId: 'b' })],
      'a',
    );
    const { startMarker } = pagesToFlow(s);
    expect(startMarker!.edge.target).toBe('a');
  });

  it('is null when startPageId does not resolve to any page', () => {
    const s = survey([page({ id: 'a', title: 'A' })], 'missing');
    const { startMarker } = pagesToFlow(s);
    expect(startMarker).toBeNull();
  });

  it('reserves its own space rather than overlapping the start page', () => {
    const s = survey([page({ id: 'a', title: 'A' })]);
    const { nodes, startMarker } = pagesToFlow(s);
    const a = nodes.find((n) => n.id === 'a')!;
    const dx = Math.abs(startMarker!.position.x - a.position.x);
    expect(dx).toBeGreaterThan(0);
  });
});

describe('isPageUnconnected', () => {
  it('flags a page nothing points at (added but never wired in)', () => {
    const s = survey([page({ id: 'a', title: 'A' }), page({ id: 'orphan', title: 'Orphan' })]);
    expect(isPageUnconnected(s, 'orphan')).toBe(true);
  });

  it('does not flag the start page even with no inbound edges', () => {
    const s = survey([page({ id: 'a', title: 'A' })]);
    expect(isPageUnconnected(s, 'a')).toBe(false);
  });

  it('does not flag a page reachable only via a branch rule (that is "conditional", not "unconnected")', () => {
    const s = survey([
      page({
        id: 'a',
        title: 'A',
        questions: [{ id: 'q', type: 'boolean', label: 'Q' }],
        branch: [{ id: 'r1', when: { logic: 'AND', conditions: [{ fieldPath: '#/properties/q', operator: 'eq', value: true }] }, goToPageId: 'b' }],
      }),
      page({ id: 'b', title: 'B' }),
    ]);
    expect(isPageUnconnected(s, 'b')).toBe(false);
  });

  it('does not flag a page reachable via the default chain', () => {
    const s = survey([page({ id: 'a', title: 'A', defaultNextPageId: 'b' }), page({ id: 'b', title: 'B' })]);
    expect(isPageUnconnected(s, 'b')).toBe(false);
  });

  it('reflects pagesToFlow node data too', () => {
    const s = survey([page({ id: 'a', title: 'A' }), page({ id: 'orphan', title: 'Orphan' })]);
    const { nodes } = pagesToFlow(s);
    expect(nodes.find((n) => n.id === 'orphan')!.data.isUnconnected).toBe(true);
    expect(nodes.find((n) => n.id === 'a')!.data.isUnconnected).toBe(false);
  });
});

describe('pageFlowOrderDiffers', () => {
  it('is false for every page when the list order already matches the default flow', () => {
    const s = survey([
      page({ id: 'a', title: 'A', defaultNextPageId: 'b' }),
      page({ id: 'b', title: 'B', defaultNextPageId: 'c' }),
      page({ id: 'c', title: 'C' }),
    ]);
    expect(pageFlowOrderDiffers(s, 'a')).toBe(false);
    expect(pageFlowOrderDiffers(s, 'b')).toBe(false);
    expect(pageFlowOrderDiffers(s, 'c')).toBe(false);
  });

  it('flags a page dragged out of order in the list, even though defaultNextPageId is untouched', () => {
    // Flow order is still a -> b -> c (defaultNextPageId chain), but the
    // list/array was reordered to [b, a, c] by a cosmetic-only drag.
    const s = survey(
      [
        page({ id: 'b', title: 'B', defaultNextPageId: 'c' }),
        page({ id: 'a', title: 'A', defaultNextPageId: 'b' }),
        page({ id: 'c', title: 'C' }),
      ],
      'a',
    );
    expect(pageFlowOrderDiffers(s, 'a')).toBe(true);
    expect(pageFlowOrderDiffers(s, 'b')).toBe(true);
    // c's relative position after b is unaffected by a/b swapping, so it's
    // still in the right place in the subsequence.
    expect(pageFlowOrderDiffers(s, 'c')).toBe(false);
  });

  it('does not flag a branch-only page, which has no single "flow position" to compare against', () => {
    const s = survey([
      page({
        id: 'a',
        title: 'A',
        questions: [{ id: 'q', type: 'boolean', label: 'Q' }],
        branch: [{ id: 'r1', when: { logic: 'AND', conditions: [{ fieldPath: '#/properties/q', operator: 'eq', value: true }] }, goToPageId: 'c' }],
        defaultNextPageId: 'b',
      }),
      page({ id: 'c', title: 'C' }),
      page({ id: 'b', title: 'B' }),
    ]);
    expect(pageFlowOrderDiffers(s, 'c')).toBe(false);
  });

  it('does not flag a fully unconnected page', () => {
    const s = survey([page({ id: 'a', title: 'A' }), page({ id: 'orphan', title: 'Orphan' })]);
    expect(pageFlowOrderDiffers(s, 'orphan')).toBe(false);
  });
});

describe('computeFlowOverviewStats', () => {
  it('counts pages, branch points, and every distinct path to an ending', () => {
    const s = survey([
      page({
        id: 'a',
        title: 'A',
        questions: [{ id: 'q', type: 'boolean', label: 'Q' }],
        branch: [
          { id: 'r1', when: { logic: 'AND', conditions: [{ fieldPath: '#/properties/q', operator: 'eq', value: true }] }, goToPageId: 'end' },
        ],
        defaultNextPageId: 'b',
      }),
      page({ id: 'b', title: 'B' }), // ends at 'end' via its own default
    ]);
    const stats = computeFlowOverviewStats(s);
    expect(stats.pageCount).toBe(2);
    expect(stats.branchPointCount).toBe(1);
    expect(stats.pathsToEndingCount).toBe(2); // a's rule to 'end', plus b's default to 'end'
  });

  it('is all zeros for an empty-ish single page that never ends explicitly reached', () => {
    const s = survey([page({ id: 'a', title: 'A' })]);
    const stats = computeFlowOverviewStats(s);
    expect(stats).toEqual({ pageCount: 1, branchPointCount: 0, pathsToEndingCount: 1 });
  });
});

describe('estimateProgress', () => {
  // A branch point whose two outcomes have DIFFERENT remaining lengths --
  // 'short' ends immediately, the default path runs through two more pages
  // -- so answering it actually moves the estimate, not just locks in a
  // branch that happened to be the same length either way.
  function asymmetricBranchSurvey(): Survey {
    return survey([
      page({ id: 'p1', title: 'P1', questions: [{ id: 'q1', type: 'shortText', label: 'Q1' }], defaultNextPageId: 'p2' }),
      page({
        id: 'p2',
        title: 'Branch point',
        questions: [{ id: 'q2', type: 'boolean', label: 'Q2' }],
        branch: [
          {
            id: 'r1',
            when: { logic: 'AND', conditions: [{ fieldPath: '#/properties/q2', operator: 'eq', value: true }] },
            goToPageId: 'short',
          },
        ],
        defaultNextPageId: 'longA',
      }),
      page({ id: 'short', title: 'Short', questions: [{ id: 'qs', type: 'shortText', label: 'QS' }] }),
      page({ id: 'longA', title: 'Long A', questions: [{ id: 'qa', type: 'shortText', label: 'QA' }], defaultNextPageId: 'longB' }),
      page({ id: 'longB', title: 'Long B', questions: [{ id: 'qb', type: 'shortText', label: 'QB' }], defaultNextPageId: 'longC' }),
      page({ id: 'longC', title: 'Long C', questions: [{ id: 'qc', type: 'shortText', label: 'QC' }] }),
    ]);
  }

  it('estimates the shortest possible total before any branch has fired', () => {
    const s = asymmetricBranchSurvey();
    // p1 + p2 + shortest of (short: 1 page) vs (longA+longB+longC: 3 pages) = 3 pages.
    expect(estimateProgress(s, ['p1'])).toEqual({ currentStep: 1, totalSteps: 3 });
    expect(estimateProgress(s, ['p1', 'p2'])).toEqual({ currentStep: 2, totalSteps: 3 });
  });

  it('grows the estimate once the longer branch actually fires', () => {
    const s = asymmetricBranchSurvey();
    // Answering q2 "No" takes the default path into longA -- now on a
    // concretely longer remaining path than the optimistic pre-answer guess.
    expect(estimateProgress(s, ['p1', 'p2', 'longA'])).toEqual({ currentStep: 3, totalSteps: 5 });
  });

  it('keeps the estimate stable when the shorter branch fires (it matched the optimistic guess)', () => {
    const s = asymmetricBranchSurvey();
    expect(estimateProgress(s, ['p1', 'p2', 'short'])).toEqual({ currentStep: 3, totalSteps: 3 });
  });

  it('counts a page as ONE step regardless of how many questions it holds', () => {
    // The runner shows a multi-question page as a single screen (see
    // RunnerShell/MultiQuestionStage), so a 5-question page must not inflate
    // the total the way counting by question would.
    const s = survey([
      page({
        id: 'multi',
        title: 'Multi',
        questions: [
          { id: 'a', type: 'shortText', label: 'A' },
          { id: 'b', type: 'shortText', label: 'B' },
          { id: 'c', type: 'shortText', label: 'C' },
          { id: 'd', type: 'shortText', label: 'D' },
          { id: 'e', type: 'shortText', label: 'E' },
        ],
        defaultNextPageId: 'next',
      }),
      page({ id: 'next', title: 'Next' }),
    ]);
    expect(estimateProgress(s, ['multi'])).toEqual({ currentStep: 1, totalSteps: 2 });
    expect(estimateProgress(s, ['multi', 'next'])).toEqual({ currentStep: 2, totalSteps: 2 });
  });

  it('matches the health-screening demo: the heart-attack branch point sits mid-survey', () => {
    const s = healthScreeningDemo();
    // p1+p2+p3+min(p4, p5) = 4 pages, regardless of which fires here (both
    // outcomes happen to be the same length in this particular demo).
    expect(estimateProgress(s, ['p1', 'p2', 'p3'])).toEqual({ currentStep: 3, totalSteps: 4 });
    expect(estimateProgress(s, ['p1', 'p2', 'p3', 'p4'])).toEqual({ currentStep: 4, totalSteps: 4 });
  });

  it('falls back to a 1-of-1 estimate if the current page id is not found (defensive)', () => {
    const s = survey([page({ id: 'a', title: 'A' })]);
    expect(estimateProgress(s, ['missing'])).toEqual({ currentStep: 1, totalSteps: 1 });
  });
});

describe('pageHasDisqualifyingOption / pageIconKind', () => {
  it('is false for a page with no disqualifying options', () => {
    const p = page({
      id: 'a',
      title: 'A',
      questions: [{ id: 'q', type: 'singleChoice', label: 'Q', choices: ['Yes', 'No'] }],
    });
    expect(pageHasDisqualifyingOption(p)).toBe(false);
    expect(pageIconKind(p)).toBe('singleChoice');
  });

  it('is true when a question has a disqualifying option, and pageIconKind reports "warning" the same way blocksSubmission does', () => {
    const p = page({
      id: 'a',
      title: 'A',
      questions: [
        {
          id: 'q',
          type: 'singleChoice',
          label: 'Heart attack?',
          choices: ['Yes', 'No'],
          disqualifyingOptions: { Yes: { title: 'Disqualified', body: 'This disqualifies you.' } },
        },
      ],
    });
    expect(pageHasDisqualifyingOption(p)).toBe(true);
    expect(pageIconKind(p)).toBe('warning');
  });

  it('is false when disqualifyingOptions is present but empty', () => {
    const p = page({
      id: 'a',
      title: 'A',
      questions: [{ id: 'q', type: 'singleChoice', label: 'Q', choices: ['Yes'], disqualifyingOptions: {} }],
    });
    expect(pageHasDisqualifyingOption(p)).toBe(false);
  });

  it('a disqualifying option still yields "warning" even on a page that also branches (blocking takes priority)', () => {
    const p = page({
      id: 'a',
      title: 'A',
      questions: [
        {
          id: 'q',
          type: 'singleChoice',
          label: 'Q',
          choices: ['Yes', 'No'],
          disqualifyingOptions: { Yes: { title: 'Disqualified', body: 'Message.' } },
        },
      ],
      branch: [
        { id: 'r1', when: { logic: 'AND', conditions: [{ fieldPath: '#/properties/q', operator: 'eq', value: 'No' }] }, goToPageId: 'end' },
      ],
    });
    expect(pageIconKind(p)).toBe('warning');
  });
});

describe('pagesToFlow disqualifiedTerminal', () => {
  it('is null when no question anywhere has a disqualifying option', () => {
    const s = survey([page({ id: 'a', title: 'A', questions: [{ id: 'q', type: 'singleChoice', label: 'Q', choices: ['X', 'Y'] }] })]);
    expect(pagesToFlow(s).disqualifiedTerminal).toBeNull();
  });

  it('emits one dashed-style edge per disqualifying option, labeled with the option text', () => {
    const s = survey([
      page({
        id: 'a',
        title: 'Heart Attack',
        questions: [
          {
            id: 'q',
            type: 'singleChoice',
            label: 'Heart attack?',
            choices: ['Yes', 'No'],
            disqualifyingOptions: { Yes: { title: 'Disqualified', body: 'Disqualified.' } },
          },
        ],
      }),
    ]);
    const { disqualifiedTerminal } = pagesToFlow(s);
    expect(disqualifiedTerminal).not.toBeNull();
    expect(disqualifiedTerminal!.edges).toHaveLength(1);
    expect(disqualifiedTerminal!.edges[0]).toMatchObject({ source: 'a', target: disqualifiedTerminal!.id, label: 'Yes' });
  });

  it('emits one edge per disqualifying option across multiple questions/pages, all pointing at the SAME shared terminal', () => {
    const s = survey([
      page({
        id: 'a',
        title: 'A',
        questions: [
          {
            id: 'q1',
            type: 'multipleChoice',
            label: 'Symptoms',
            choices: ['Headache', 'Chest pain', 'Fatigue'],
            disqualifyingOptions: { 'Chest pain': { title: 'T1', body: 'Msg1' }, Fatigue: { title: 'T2', body: 'Msg2' } },
          },
        ],
        defaultNextPageId: 'b',
      }),
      page({
        id: 'b',
        title: 'B',
        questions: [
          { id: 'q2', type: 'singleChoice', label: 'Other', choices: ['Yes', 'No'], disqualifyingOptions: { Yes: { title: 'T3', body: 'Msg3' } } },
        ],
      }),
    ]);
    const { disqualifiedTerminal } = pagesToFlow(s);
    expect(disqualifiedTerminal!.edges).toHaveLength(3);
    const targets = new Set(disqualifiedTerminal!.edges.map((e) => e.target));
    expect(targets.size).toBe(1); // every edge points at the same shared node
    expect(disqualifiedTerminal!.edges.map((e) => e.label).sort()).toEqual(['Chest pain', 'Fatigue', 'Yes']);
  });

  it('does not emit an edge for an option with an empty disqualifyingOptions map', () => {
    const s = survey([
      page({ id: 'a', title: 'A', questions: [{ id: 'q', type: 'singleChoice', label: 'Q', choices: ['X'], disqualifyingOptions: {} }] }),
    ]);
    expect(pagesToFlow(s).disqualifiedTerminal).toBeNull();
  });

  it('reserves its own position, not overlapping the page that points at it', () => {
    const s = survey([
      page({
        id: 'a',
        title: 'A',
        questions: [{ id: 'q', type: 'singleChoice', label: 'Q', choices: ['Yes'], disqualifyingOptions: { Yes: { title: 'Disqualified', body: 'Msg' } } }],
      }),
    ]);
    const { nodes, disqualifiedTerminal } = pagesToFlow(s);
    const a = nodes.find((n) => n.id === 'a')!;
    const dx = Math.abs(disqualifiedTerminal!.position.x - a.position.x);
    expect(dx).toBeGreaterThan(0);
  });
});
