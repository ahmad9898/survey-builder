import type { SurveyPage } from '../types/survey';

// After removing an edge (or clearing the default), a page can be left with
// exactly one outgoing edge that's still a conditioned branch rule -- but a
// LONE outgoing edge is always simple/condition-free, the same as it is
// today for a page that's never had a second connection. Promotes that rule
// to be the page's default and discards its now-pointless condition.
//
// Deliberately NOT applied when an edge is being ADDED (see addBranchRule):
// an author who just clicked "+ Add rule" on a page with no other edges is
// actively creating a conditioned rule and needs to see it in order to
// configure it, not have it silently absorbed into "Otherwise" the instant
// it's created.
export function collapseSingleEdge(page: SurveyPage): SurveyPage {
  const hasDefault = page.defaultNextPageId !== 'end';
  if (hasDefault || page.branch.length !== 1) return page;
  const [onlyRule] = page.branch;
  // A 'block' rule's goToPageId is just a harmless 'end' placeholder, never
  // an actual destination (see BranchRule.action's own comment) -- collapsing
  // it here would promote that placeholder to the page's real default,
  // silently erasing the block (the page would then let EVERYONE through
  // unconditionally instead of gating on the rule's condition).
  if (onlyRule.action === 'block') return page;
  return { ...page, defaultNextPageId: onlyRule.goToPageId, branch: [] };
}

// A page with 2+ conditioned edges and no unconditioned fallback is a
// dead-end risk: a respondent whose answer matches none of the conditions
// has nowhere to go. This is surfaced as a warning, not blocked -- an author
// mid-edit, or one who genuinely intends the survey to just end there for
// unmatched respondents, is still free to leave a page in this state.
export function pageHasNoFallbackRisk(page: SurveyPage): boolean {
  return page.defaultNextPageId === 'end' && page.branch.length >= 2;
}
