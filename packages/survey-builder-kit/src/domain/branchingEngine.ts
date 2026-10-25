import type { SurveyPage } from '../types/survey';
import { evaluateConditionGroup } from './conditionEvaluator';

// Decides which page comes next given the current page's branch rules and the
// answers accumulated so far. First matching rule wins; falls back to the
// page's defaultNextPageId when no rule matches (or none are configured).
// 'block' rules are skipped entirely here -- they don't resolve to a
// destination at all (see BranchRule.action's own comment); the matching
// check continues to the next rule as if a block rule weren't there. Those
// rules are instead read by isPageBlockedByRule below, which RunnerShell
// uses to disable Continue/Submit BEFORE this function's result would ever
// be acted on.
export function resolveNextPage(
  page: SurveyPage,
  answers: Record<string, unknown>,
): string | 'end' {
  for (const rule of page.branch) {
    if (rule.action === 'block') continue;
    if (evaluateConditionGroup(rule.when, answers)) {
      return rule.goToPageId;
    }
  }
  return page.defaultNextPageId;
}

// Whether any 'block'-action rule on this page currently matches. Unlike
// resolveNextPage, this is NOT "first match wins" -- every block rule is
// checked regardless of array order or whether an earlier goToPage rule also
// matches, since blocking is a gate on leaving this page at all, not a
// competing route to pick between.
export function isPageBlockedByRule(page: SurveyPage, answers: Record<string, unknown>): boolean {
  return page.branch.some((rule) => rule.action === 'block' && evaluateConditionGroup(rule.when, answers));
}
