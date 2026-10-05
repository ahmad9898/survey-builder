import type { Survey } from '../types/survey';

export function countRulesTargeting(survey: Survey, pageId: string): number {
  return survey.pages.reduce((sum, p) => sum + p.branch.filter((r) => r.goToPageId === pageId).length, 0);
}

// Shared by the sidebar and the flow map so a page delete asks the same
// question and accounts for the same cascade (branch rules that target it)
// regardless of which surface it's triggered from.
export function confirmDeletePage(survey: Survey, pageId: string, title: string): boolean {
  const ruleCount = countRulesTargeting(survey, pageId);
  const cascadeNote =
    ruleCount > 0
      ? ` This page is the target of ${ruleCount} branch rule${ruleCount === 1 ? '' : 's'}; deleting it will also remove ${ruleCount === 1 ? 'that rule' : 'those rules'}.`
      : '';
  return window.confirm(
    `Delete "${title}"?${cascadeNote} This can't be undone by itself (use Undo right after if you change your mind).`,
  );
}
