import type { Survey } from '../types/survey';

/**
 * Every "mandatory, blocks Publish" field the Builder currently marks with
 * a required indicator and inline error -- survey Name/Type (see
 * PageSidebar's own nameMissing/typeMissing), a turnstile question's site
 * key, and a disqualifying option's notice title (see QuestionCard) --
 * gathered in one place so Publish can refuse to fire with a clear reason
 * instead of silently handing the host incomplete data. Returns an empty
 * array when nothing's missing. Adding a new mandatory field anywhere in
 * the Builder means adding its check here too, or Publish won't know to
 * block on it.
 */
export function findMissingMandatoryFields(survey: Survey): string[] {
  const issues: string[] = [];

  if (survey.title.trim().length === 0) {
    issues.push('Survey name is required.');
  }
  if (!(survey.type ?? '').trim()) {
    issues.push('Survey type is required.');
  }

  for (const page of survey.pages) {
    for (const question of page.questions) {
      const questionLabel = question.label || question.title || question.id;

      if (question.type === 'turnstile' && !question.turnstileSiteKey?.trim()) {
        issues.push(`"${questionLabel}" (${page.title}): Turnstile SiteKey is required.`);
      }

      if (question.disqualifyingOptions) {
        for (const [choice, rawNotice] of Object.entries(question.disqualifyingOptions)) {
          // Same defensive shape-handling as QuestionCard's own ChoiceListEditor --
          // disqualifyingOptions used to be Record<string, string> before it grew a
          // title/body shape; normalizeSurvey() repairs this on load, but this
          // runs on whatever's in the live store right now, not necessarily
          // normalized yet.
          const title = typeof rawNotice === 'string' ? rawNotice : rawNotice?.title;
          if (!title?.trim()) {
            issues.push(`"${questionLabel}" (${page.title}): disqualification notice for "${choice}" is required.`);
          }
        }
      }
    }
  }

  return issues;
}
