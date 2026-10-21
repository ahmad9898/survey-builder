import type { QuestionDef, Survey } from '../types/survey';
import type { AnswerEntry, AnswerOption } from '../types/response';
import { evaluateConditionGroup } from './conditionEvaluator';
import { formatAnswerDisplay } from './answerFormatting';
import { getDisqualifyingNotices } from '../runtime/components/runner/questionValidation';

function isVisible(question: QuestionDef, answers: Record<string, unknown>): boolean {
  return !question.visibilityRule || evaluateConditionGroup(question.visibilityRule, answers);
}

// Every option on a choice/multi-select question, selected or not -- so a
// later reader can show what the respondent *didn't* pick too. `choices` is
// a flat string[] (the string IS both the stored value and its label; see
// QuestionDef's own comment on why it isn't a richer {value,label} shape),
// so `label` here is just the same string back.
function buildOptions(question: QuestionDef, value: unknown): AnswerOption[] | undefined {
  if (!question.choices) return undefined;
  const selected = new Set(
    Array.isArray(value) ? value.map(String) : value !== undefined && value !== null ? [String(value)] : [],
  );
  return question.choices.map((choice) => ({
    value: choice,
    label: choice,
    selected: selected.has(choice),
    ...(question.disqualifyingOptions && choice in question.disqualifyingOptions ? { disqualifying: true as const } : {}),
  }));
}

// `getDisqualifyingNotices` already resolves "which of this question's
// CURRENTLY selected options are flagged disqualifying" -- reused as-is
// (same source of truth the runner's own Continue-button gating uses)
// rather than re-deriving it here.
function buildDisqualifyFields(question: QuestionDef, value: unknown): Pick<AnswerEntry, 'disqualifying' | 'disqualifyMessage'> {
  const notices = getDisqualifyingNotices(question, value);
  if (notices.length === 0) return {};
  const disqualifyMessage = notices.map((n) => (n.body ? `${n.title}: ${n.body}` : n.title)).join('; ');
  return { disqualifying: true, disqualifyMessage };
}

/**
 * Builds the rich, self-describing `answers` array stored in a
 * SurveyResponse -- a presentation/export-time SNAPSHOT of what the
 * respondent actually saw and chose, not the live runtime shape. The
 * player store, JSONForms binding, AJV validation, and the branching/
 * scoring engines all keep reading/writing the plain `questionId -> raw
 * value` map exactly as they do today; this function is called once, at
 * submit time, to translate that into something a reader doesn't need the
 * exact survey version to understand. Each entry carries its own
 * `questionId`/`slug`, so the array's order is just "the order the
 * respondent encountered these" (see below) -- not a lookup key.
 *
 * Walks `meta.visitedPageIds` (the actual path taken -- not `survey.pages`
 * in survey order) so a page the branching skipped contributes no entries,
 * and re-applies each question's own `visibilityRule` against the final
 * answers so a question hidden on its page for this particular answer set
 * doesn't get a spurious entry either -- both exactly mirroring what the
 * respondent actually saw, and both reflected in the resulting array's
 * order for free.
 */
export function buildResponsePayload(
  survey: Survey,
  rawAnswers: Record<string, unknown>,
  meta: { visitedPageIds: string[] },
): AnswerEntry[] {
  const entries: AnswerEntry[] = [];

  for (const pageId of meta.visitedPageIds) {
    const page = survey.pages.find((p) => p.id === pageId);
    if (!page) continue;

    for (const question of page.questions) {
      if (!isVisible(question, rawAnswers)) continue;

      if (question.type === 'label') {
        // Display-only -- carries no answer data (schemaCompiler never
        // gives it a schema property), but still gets an entry so a reader
        // sees the full flow the respondent went through, not just the
        // questions that collected data.
        entries.push({
          questionId: question.id,
          slug: question.slug,
          pageId: page.id,
          pageTitle: page.title,
          type: question.type,
          label: question.label,
          value: null,
          displayValue: 'Acknowledged',
          ...(question.hasTrigger ? { hasTrigger: true } : {}),
        });
        continue;
      }

      const value = rawAnswers[question.id];
      // turnstile is unconditionally required (see schemaCompiler.ts's own
      // comment) even though `question.required` itself is never actually
      // set true for it -- so it's never legitimately "skipped" either.
      const skipped =
        !(question.required || question.type === 'turnstile') &&
        (value === undefined || value === null || value === '');
      const options = buildOptions(question, value);

      entries.push({
        questionId: question.id,
        slug: question.slug,
        pageId: page.id,
        pageTitle: page.title,
        type: question.type,
        label: question.label,
        ...(value !== undefined ? { value } : {}),
        displayValue: formatAnswerDisplay(question, value),
        ...(skipped ? { skipped: true } : {}),
        ...(options ? { options } : {}),
        ...buildDisqualifyFields(question, value),
        ...(question.hasTrigger ? { hasTrigger: true } : {}),
      });
    }
  }

  return entries;
}
