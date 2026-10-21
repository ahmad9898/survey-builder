import type { Survey } from '../types/survey';
import type { FieldOption } from './components/ConditionEditor';

// Fields a page's branch rules (or a question's visibility rule) may
// reference: every question on this page and earlier pages, since a decision
// is only made once this page's answers (and everything before it) are known.
export function availableFieldsForPage(survey: Survey, pageId: string): FieldOption[] {
  const pageIndex = survey.pages.findIndex((p) => p.id === pageId);
  if (pageIndex === -1) return [];
  const fields: FieldOption[] = [];
  for (let i = 0; i <= pageIndex; i++) {
    for (const q of survey.pages[i].questions) {
      if (q.type === 'label' || q.type === 'turnstile') continue;
      fields.push({
        scope: `#/properties/${q.id}`,
        label: q.label,
        questionType: q.type,
        choices: q.choices,
      });
    }
  }
  return fields;
}
