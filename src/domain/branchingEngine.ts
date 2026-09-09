import type { SurveyPage } from '../types/survey';
import { evaluateConditionGroup } from './conditionEvaluator';

// Decides which page comes next given the current page's branch rules and the
// answers accumulated so far. First matching rule wins; falls back to the
// page's defaultNextPageId when no rule matches (or none are configured).
export function resolveNextPage(
  page: SurveyPage,
  answers: Record<string, unknown>,
): string | 'end' {
  for (const rule of page.branch) {
    if (evaluateConditionGroup(rule.when, answers)) {
      return rule.goToPageId;
    }
  }
  return page.defaultNextPageId;
}
