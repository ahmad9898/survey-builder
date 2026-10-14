import dagre from 'dagre';
import type { ConditionGroup, ConditionLeaf, QuestionType, Survey, SurveyPage } from '../types/survey';
import { isConditionGroup } from '../types/survey';

export interface FlowPageNodeData {
  pageId: string;
  title: string;
  questionCount: number;
  iconKind: PageIconKind;
  // Reachable only via a branch rule, never via another page's default
  // next-page order (e.g. a referral/notice page shown on a positive finding).
  isConditionalOnly: boolean;
  // This page's own rules decide where the flow goes next.
  isBranchPoint: boolean;
  // No page or rule anywhere points at this one, and it isn't the start page
  // -- it was added (from the sidebar or the canvas) and never wired in, so
  // a respondent could never actually reach it.
  isUnconnected: boolean;
  // Its position in the pages list doesn't match where it actually falls in
  // the default respondent-facing order (see pageFlowOrderDiffers).
  flowOrderDiffers: boolean;
  blocksSubmission: boolean;
  endsFlow: boolean;
  // Index signature so this satisfies @xyflow/react's Node<T extends
  // Record<string, unknown>> constraint without that UI library leaking into
  // this otherwise framework-agnostic domain module.
  [key: string]: unknown;
}

export interface FlowPageNode {
  id: string;
  type: 'pageNode';
  position: { x: number; y: number };
  data: FlowPageNodeData;
}

export type FlowEdgeVariant = 'positive' | 'neutral' | 'disqualifying';

export interface FlowPageEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  data: {
    variant: FlowEdgeVariant;
    isDefault: boolean;
    // Only set for a branch-rule edge; a default (isDefault: true) edge has
    // no backing rule to edit -- its "destination" is the page's own
    // defaultNextPageId.
    ruleId?: string;
  };
}

export interface FlowStartMarker {
  id: string;
  position: FlowPosition;
  edge: { id: string; source: string; target: string };
}

// One edge per disqualifying option actually selected-as-disqualifying
// anywhere on the page (a page can hold more than one, across one
// multi-select question or several questions) -- labeled with the option's
// own text, e.g. "Yes".
export interface FlowDisqualifiedEdge {
  id: string;
  source: string;
  target: string;
  label: string;
}

// A single shared terminal every disqualifying option on every page points
// at -- there's one "Disqualified" outcome in the survey, not one per
// question. Distinct from a page's own blocksSubmission (a whole dedicated
// notice page reached via a branching rule): this is a specific ANSWER that
// ends things right there, without navigating anywhere.
export interface FlowDisqualifiedTerminal {
  id: string;
  position: FlowPosition;
  edges: FlowDisqualifiedEdge[];
}

export interface PageFlow {
  nodes: FlowPageNode[];
  edges: FlowPageEdge[];
  // null when there's no resolvable start page to point at (survey.pages is
  // empty, or startPageId doesn't match any page -- both defensive-only,
  // since the builder never lets an author reach either state).
  startMarker: FlowStartMarker | null;
  // null when no question anywhere in the survey has a disqualifying
  // option -- the terminal node only exists when it's actually needed.
  disqualifiedTerminal: FlowDisqualifiedTerminal | null;
}

export interface FlowPosition {
  x: number;
  y: number;
}

// Matches PageNode's fixed width and a generous estimate of its height (it
// grows a little with the "BRANCH POINT" / conditional tag and the
// blocks-submission / ends-flow footer), so dagre reserves enough room.
export const NODE_WIDTH = 190;
export const NODE_HEIGHT = 100;

// The synthetic "Start" pill that marks whichever page the player runtime
// actually opens on first (survey.startPageId -- see StartNode.tsx). It's a
// real node/edge fed into the same dagre pass as the page nodes (not just a
// style on the first page) so dagre reserves it its own space rather than
// overlapping whatever's nearby.
export const START_NODE_ID = '__start__';
export const START_NODE_WIDTH = 88;
export const START_NODE_HEIGHT = 34;

// The shared "Disqualified" pill every disqualifying-option edge points at
// (see DisqualifiedNode.tsx) -- fed into the same dagre pass for the same
// reason the Start pill is, so it gets its own reserved space.
export const DISQUALIFIED_NODE_ID = '__disqualified__';
export const DISQUALIFIED_NODE_WIDTH = 132;
export const DISQUALIFIED_NODE_HEIGHT = 34;

// Every option, across every question on this page, that's flagged
// disqualifying -- in each question's own `choices` order, across questions
// in the page's own order.
function pageDisqualifyingLabels(page: SurveyPage): string[] {
  const labels: string[] = [];
  for (const q of page.questions) {
    if (!q.disqualifyingOptions) continue;
    for (const choice of q.choices ?? []) {
      if (choice in q.disqualifyingOptions) labels.push(choice);
    }
  }
  return labels;
}

interface FieldInfo {
  label: string;
  type: QuestionType;
}

function buildFieldIndex(survey: Survey): Map<string, FieldInfo> {
  const index = new Map<string, FieldInfo>();
  for (const page of survey.pages) {
    for (const q of page.questions) {
      index.set(`#/properties/${q.id}`, { label: q.label, type: q.type });
    }
  }
  return index;
}

function firstLeaf(group: ConditionGroup): ConditionLeaf | undefined {
  return group.conditions.find((c): c is ConditionLeaf => !isConditionGroup(c));
}

// Best-effort plain-language summary for a rule's condition, used as the edge
// label. Recognizes the common "boolean question == Yes/No" shape (labeling
// it "Yes"/"No" and flagging it as the positive branch) and falls back to a
// generic summary for anything else.
function summarizeRuleCondition(
  group: ConditionGroup,
  fields: Map<string, FieldInfo>,
): { label: string; isPositiveBoolean: boolean } {
  const leaf = firstLeaf(group);
  if (!leaf) return { label: 'Matches', isPositiveBoolean: false };

  const field = fields.get(leaf.fieldPath);
  if (field?.type === 'boolean' && leaf.operator === 'eq') {
    return { label: leaf.value === true ? 'Yes' : 'No', isPositiveBoolean: leaf.value === true };
  }

  const opLabel: Record<string, string> = {
    eq: '=',
    neq: '≠',
    contains: 'contains',
    gt: '>',
    gte: '≥',
    lt: '<',
    lte: '≤',
    isEmpty: 'is empty',
    isNotEmpty: 'is not empty',
  };
  const needsValue = leaf.operator !== 'isEmpty' && leaf.operator !== 'isNotEmpty';
  const valueText = needsValue ? ` ${String(leaf.value ?? '')}` : '';
  const label = `${field?.label ?? 'Answer'} ${opLabel[leaf.operator] ?? leaf.operator}${valueText}`;
  return { label, isPositiveBoolean: false };
}

interface Edge {
  targetId: string;
  isDefault: boolean;
  label: string;
  variant: FlowEdgeVariant;
  ruleId?: string;
}

function outgoingEdges(page: SurveyPage, fields: Map<string, FieldInfo>): Edge[] {
  const edges: Edge[] = [];
  let inferredNoLabel = false;

  for (const rule of page.branch) {
    if (rule.goToPageId === 'end') continue;
    const { label, isPositiveBoolean } = summarizeRuleCondition(rule.when, fields);
    edges.push({
      targetId: rule.goToPageId,
      isDefault: false,
      label,
      variant: isPositiveBoolean ? 'positive' : 'neutral',
      ruleId: rule.id,
    });
    if (isPositiveBoolean) inferredNoLabel = true;
  }

  if (page.defaultNextPageId !== 'end') {
    // Only a page with actual branch rules needs its default path labeled as
    // an alternative to something — a plain sequential page has nothing to
    // contrast against, so its one edge stays unlabeled.
    const label = page.branch.length === 0 ? '' : inferredNoLabel ? 'No' : 'Otherwise';
    edges.push({
      targetId: page.defaultNextPageId,
      isDefault: true,
      label,
      variant: 'neutral',
    });
  }

  return edges;
}

// Rough text-width estimate (no DOM available in this pure module) so dagre
// reserves enough space around a labeled edge -- this is the actual fix for
// labels overlapping: dagre treats each edge's label as occupying real space
// when computing rank/node spacing, rather than labels being an afterthought
// painted at whatever midpoint two edges happen to share.
function estimateLabelSize(label: string): { width: number; height: number } {
  if (!label) return { width: 0, height: 0 };
  return { width: label.length * 6.5 + 16, height: 20 };
}

// Auto-layout via dagre: left-to-right ranked layout, positions returned
// keyed by page id (dagre's node position is its *center*; callers wanting
// React Flow's top-left convention should subtract half the node size).
function computeDagreLayout(survey: Survey, fields: Map<string, FieldInfo>): Map<string, FlowPosition> {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: 'LR', nodesep: 70, ranksep: 110, marginx: 20, marginy: 20 });
  g.setDefaultEdgeLabel(() => ({}));

  for (const page of survey.pages) {
    g.setNode(page.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }
  const startPage = survey.pages.find((p) => p.id === survey.startPageId);
  if (startPage) {
    // Feeds the Start pill into the same layout pass as everything else so
    // dagre reserves it real rank space one step before the start page,
    // rather than it being painted wherever happens to be free.
    g.setNode(START_NODE_ID, { width: START_NODE_WIDTH, height: START_NODE_HEIGHT });
    g.setEdge(START_NODE_ID, startPage.id, { width: 0, height: 0 });
  }
  const hasAnyDisqualifying = survey.pages.some((p) => pageDisqualifyingLabels(p).length > 0);
  if (hasAnyDisqualifying) {
    g.setNode(DISQUALIFIED_NODE_ID, { width: DISQUALIFIED_NODE_WIDTH, height: DISQUALIFIED_NODE_HEIGHT });
    for (const page of survey.pages) {
      for (const label of pageDisqualifyingLabels(page)) {
        const { width, height } = estimateLabelSize(label);
        g.setEdge(page.id, DISQUALIFIED_NODE_ID, { width, height });
      }
    }
  }
  for (const page of survey.pages) {
    for (const edge of outgoingEdges(page, fields)) {
      const { width, height } = estimateLabelSize(edge.label);
      g.setEdge(page.id, edge.targetId, { width, height });
    }
  }

  dagre.layout(g);

  const positions = new Map<string, FlowPosition>();
  for (const page of survey.pages) {
    const node = g.node(page.id);
    if (node) positions.set(page.id, { x: node.x, y: node.y });
  }
  if (startPage) {
    const node = g.node(START_NODE_ID);
    if (node) positions.set(START_NODE_ID, { x: node.x, y: node.y });
  }
  if (hasAnyDisqualifying) {
    const node = g.node(DISQUALIFIED_NODE_ID);
    if (node) positions.set(DISQUALIFIED_NODE_ID, { x: node.x, y: node.y });
  }
  return positions;
}

// Shared with the sidebar/canvas "Conditional" chip so both surfaces agree on
// what "only reachable via a branch rule" means.
export function isPageConditionalOnly(survey: Survey, pageId: string): boolean {
  if (pageId === survey.startPageId) return false;
  return !survey.pages.some((p) => p.defaultNextPageId === pageId);
}

// True when nothing in the survey points at this page at all -- not the
// default chain, not any branch rule -- and it isn't the start page. Unlike
// isPageConditionalOnly (which only cares about the default chain), this
// also treats a page that's merely a branch target as "connected".
export function isPageUnconnected(survey: Survey, pageId: string): boolean {
  if (pageId === survey.startPageId) return false;
  const hasDefaultInbound = survey.pages.some((p) => p.defaultNextPageId === pageId);
  const hasRuleInbound = survey.pages.some((p) => p.branch.some((r) => r.goToPageId === pageId));
  return !hasDefaultInbound && !hasRuleInbound;
}

export interface FlowOverviewStats {
  pageCount: number;
  branchPointCount: number;
  pathsToEndingCount: number;
}

// Summary stats for the flow map's default "overview" panel: how many pages,
// how many of them make a branching decision, and how many distinct edges
// (default or rule) actually terminate the survey.
export function computeFlowOverviewStats(survey: Survey): FlowOverviewStats {
  let pathsToEndingCount = 0;
  let branchPointCount = 0;
  for (const page of survey.pages) {
    if (page.branch.length > 0) branchPointCount++;
    if (page.defaultNextPageId === 'end') pathsToEndingCount++;
    pathsToEndingCount += page.branch.filter((r) => r.goToPageId === 'end').length;
  }
  return { pageCount: survey.pages.length, branchPointCount, pathsToEndingCount };
}

// The order a respondent taking the plain default path (no branches) would
// actually see pages in: start page, then wherever its defaultNextPageId
// leads, and so on. Stops at 'end', an unknown id, or a revisit (a defensive
// cycle guard -- normal use shouldn't produce one).
function defaultChainOrder(survey: Survey): string[] {
  const order: string[] = [];
  const visited = new Set<string>();
  let current: string | 'end' = survey.startPageId;
  while (current !== 'end' && !visited.has(current)) {
    const page = survey.pages.find((p) => p.id === current);
    if (!page) break;
    visited.add(current);
    order.push(current);
    current = page.defaultNextPageId;
  }
  return order;
}

// True when this page's position in survey.pages (what the sidebar list and
// the "Pages" panel show) doesn't match where it actually falls in the
// default respondent-facing flow -- e.g. it was dragged above a page that
// still comes before it once the survey is actually taken. Reordering is
// deliberately cosmetic-only (it never rewrites defaultNextPageId, to avoid
// silently orphaning a page from the flow), so this exists to make that
// honest rather than misleading. Only meaningful for pages actually on the
// default chain; a branch-only or unconnected page has no "flow position" to
// compare against and is never flagged here.
export function pageFlowOrderDiffers(survey: Survey, pageId: string): boolean {
  const chainOrder = defaultChainOrder(survey);
  const chainIndex = chainOrder.indexOf(pageId);
  if (chainIndex === -1) return false;
  const arraySubsequence = survey.pages.map((p) => p.id).filter((id) => chainOrder.includes(id));
  return arraySubsequence.indexOf(pageId) !== chainIndex;
}

export type PageIconKind = 'warning' | 'branch' | 'empty' | QuestionType;

// True when any question on this page has at least one option flagged
// disqualifying (see QuestionDef.disqualifyingOptions) -- a second, more
// granular way a page can carry a disqualification risk, distinct from
// page.blocksSubmission (a whole dedicated notice page reached via a
// branching rule).
export function pageHasDisqualifyingOption(page: SurveyPage): boolean {
  return page.questions.some((q) => q.disqualifyingOptions && Object.keys(q.disqualifyingOptions).length > 0);
}

// What icon a page should show in the sidebar and the flow map node, driven
// by the page's actual content rather than hardcoded per view: a blocking
// notice (whole-page or per-option) takes priority, then whether the page
// itself branches, then falling back to its first question's type.
export function pageIconKind(page: SurveyPage): PageIconKind {
  if (page.blocksSubmission || pageHasDisqualifyingOption(page)) return 'warning';
  if (page.branch.length > 0) return 'branch';
  const first = page.questions[0];
  return first ? first.type : 'empty';
}

// `overrides` are manually-dragged positions (React Flow top-left
// convention) keyed by page id, layered on top of the dagre auto-layout so a
// page the author has never touched still gets a sane computed position, and
// re-running layout (e.g. after adding a page) doesn't disturb pages they've
// already arranged.
export function pagesToFlow(survey: Survey, overrides: Record<string, FlowPosition> = {}): PageFlow {
  const fields = buildFieldIndex(survey);
  const autoPositions = computeDagreLayout(survey, fields);

  const nodes: FlowPageNode[] = survey.pages.map((page) => {
    const override = overrides[page.id];
    const auto = autoPositions.get(page.id) ?? { x: NODE_WIDTH / 2, y: NODE_HEIGHT / 2 };
    const position = override ?? { x: auto.x - NODE_WIDTH / 2, y: auto.y - NODE_HEIGHT / 2 };
    return {
      id: page.id,
      type: 'pageNode',
      position,
      data: {
        pageId: page.id,
        title: page.title,
        questionCount: page.questions.length,
        iconKind: pageIconKind(page),
        isConditionalOnly: isPageConditionalOnly(survey, page.id),
        isBranchPoint: page.branch.length > 0,
        isUnconnected: isPageUnconnected(survey, page.id),
        flowOrderDiffers: pageFlowOrderDiffers(survey, page.id),
        blocksSubmission: !!page.blocksSubmission,
        endsFlow: page.defaultNextPageId === 'end' && !page.blocksSubmission,
      },
    };
  });

  const edges: FlowPageEdge[] = survey.pages.flatMap((page) =>
    outgoingEdges(page, fields).map((edge, i) => ({
      id: `${page.id}-${edge.isDefault ? 'default' : `rule-${i}`}-${edge.targetId}`,
      source: page.id,
      target: edge.targetId,
      label: edge.label,
      data: { variant: edge.variant, isDefault: edge.isDefault, ruleId: edge.ruleId },
    })),
  );

  const startPage = survey.pages.find((p) => p.id === survey.startPageId);
  const startAuto = startPage ? autoPositions.get(START_NODE_ID) : undefined;
  const startMarker: FlowStartMarker | null =
    startPage && startAuto
      ? {
          id: START_NODE_ID,
          position: { x: startAuto.x - START_NODE_WIDTH / 2, y: startAuto.y - START_NODE_HEIGHT / 2 },
          edge: { id: `${START_NODE_ID}-edge`, source: START_NODE_ID, target: startPage.id },
        }
      : null;

  const disqualifiedAuto = autoPositions.get(DISQUALIFIED_NODE_ID);
  const disqualifiedEdges: FlowDisqualifiedEdge[] = survey.pages.flatMap((page) =>
    pageDisqualifyingLabels(page).map((label, i) => ({
      id: `${page.id}-disqualify-${i}-${label}`,
      source: page.id,
      target: DISQUALIFIED_NODE_ID,
      label,
    })),
  );
  const disqualifiedTerminal: FlowDisqualifiedTerminal | null =
    disqualifiedAuto && disqualifiedEdges.length > 0
      ? {
          id: DISQUALIFIED_NODE_ID,
          position: {
            x: disqualifiedAuto.x - DISQUALIFIED_NODE_WIDTH / 2,
            y: disqualifiedAuto.y - DISQUALIFIED_NODE_HEIGHT / 2,
          },
          edges: disqualifiedEdges,
        }
      : null;

  return { nodes, edges, startMarker, disqualifiedTerminal };
}

export interface ProgressEstimate {
  // 1-based: "3" in "3 of 5".
  currentStep: number;
  // Best-effort total, re-derived after every answer -- see
  // shortestRemainingQuestions below for what "best-effort" means here.
  totalSteps: number;
}

// Every possible page this one's branch rules or default could send a
// respondent to -- NOT the one they'll actually take (that depends on
// answers not yet given). Used only to find the shortest possible remaining
// path for the progress estimate, never for real navigation (that's
// resolveNextPage in branchingEngine.ts, which this deliberately doesn't
// touch).
function possibleNextPageTargets(page: SurveyPage): (string | 'end')[] {
  const targets = new Set<string | 'end'>();
  for (const rule of page.branch) targets.add(rule.goToPageId);
  targets.add(page.defaultNextPageId);
  return Array.from(targets);
}

// Fewest PAGES a respondent could still face after (not including)
// `fromPageId`, counting every page on the shortest of its possible
// branches. This is an optimistic estimate -- the real remaining count can
// only be known once enough questions are answered to resolve which branch
// is actually taken -- which is exactly why the progress rail needs to
// re-derive it after every answer rather than computing it once.
//
// `visiting` guards against a cycle in the branch graph (defensive only,
// same as defaultChainOrder's guard -- the builder doesn't let an author
// create one, but this shouldn't hang if it ever happens).
function shortestRemainingPages(survey: Survey, fromPageId: string, visiting: Set<string> = new Set()): number {
  if (visiting.has(fromPageId)) return Infinity;
  const page = survey.pages.find((p) => p.id === fromPageId);
  if (!page) return Infinity;

  const nextVisiting = new Set(visiting);
  nextVisiting.add(fromPageId);

  let best = Infinity;
  for (const target of possibleNextPageTargets(page)) {
    if (target === 'end') {
      best = Math.min(best, 0);
      continue;
    }
    if (!survey.pages.some((p) => p.id === target)) continue;
    const rest = shortestRemainingPages(survey, target, nextVisiting);
    if (rest === Infinity) continue;
    best = Math.min(best, 1 + rest);
  }
  // No viable path found (every branch cycles, or points at a missing page)
  // -- defensively treat as "nothing more to add" rather than propagating
  // Infinity into the displayed total.
  return best === Infinity ? 0 : best;
}

// Powers the runner's progress rail ("3 of 5"). Pages can be skipped by
// branching, so this is never currentPageIndex/pages.length -- it's built
// from the same page/branch graph pagesToFlow draws. Counted in PAGES, not
// questions: the runner shows one PAGE per screen (a page with more than one
// question renders them all together, not split into separate steps -- see
// RunnerShell/MultiQuestionStage), so a step is a page regardless of how
// many questions it holds.
//
// `visitedPageStack` is the player store's own stack, unchanged.
export function estimateProgress(survey: Survey, visitedPageStack: string[]): ProgressEstimate {
  const currentPageId = visitedPageStack[visitedPageStack.length - 1];
  if (!survey.pages.some((p) => p.id === currentPageId)) return { currentStep: 1, totalSteps: 1 };

  const currentStep = visitedPageStack.length;
  const remainingAfterCurrentPage = shortestRemainingPages(survey, currentPageId);

  return {
    currentStep,
    totalSteps: currentStep + remainingAfterCurrentPage,
  };
}
