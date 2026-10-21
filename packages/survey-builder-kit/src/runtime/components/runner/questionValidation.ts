import Ajv from 'ajv';
import type { DisqualifyingNotice, QuestionDef, SurveyPage } from '../../../types/survey';
import { describeValidationErrors } from '../../../domain/validationMessages';
import { validateDateAge } from '../../../domain/ageValidation';
import { singleQuestionSchema } from './singleQuestionSchema';

// Same AJV engine and compiled-schema shape the rest of the app already
// validates with (schemaCompiler.ts's output, describeValidationErrors'
// message mapping) -- this only narrows WHAT gets validated at once (one
// question, not a whole page's worth of not-yet-shown siblings), not HOW.
const ajv = new Ajv({ allErrors: true, strict: false });

// Validates a single question's current answer against the exact rules
// schemaCompiler.ts already compiled for it (required/min/max/pattern/etc,
// read back out of page.schema), plus the one check that can't be a static
// JSON Schema rule (date age, relative to "now" -- see ageValidation.ts).
// Returns friendly messages, empty when valid.
export function validateQuestion(page: SurveyPage, question: QuestionDef, answers: Record<string, unknown>): string[] {
  if (question.type === 'label') return [];

  const schema = singleQuestionSchema(page, question.id);
  const valid = ajv.validate(schema, { [question.id]: answers[question.id] });
  const schemaMessages = valid ? [] : describeValidationErrors(ajv.errors ?? [], [question]).map((m) => m.message);

  const ageMessage = validateDateAge(question, answers[question.id]);
  return ageMessage ? [...schemaMessages, ageMessage] : schemaMessages;
}

// Notices for whichever of this question's options are BOTH currently
// selected and flagged disqualifying (QuestionDef.disqualifyingOptions),
// in the OPTIONS' OWN LIST ORDER (not selection order) -- so if an author
// reorders choices, the banner's stacking order follows. Works for a single
// string value (singleChoice) or an array of them (multipleChoice). Not an
// AJV concern: a disqualifying option is still a perfectly valid answer as
// far as schema validation goes, this is a separate, app-level "can the
// respondent continue" check layered alongside it.
export function getDisqualifyingNotices(question: QuestionDef, value: unknown): DisqualifyingNotice[] {
  const disqualifying = question.disqualifyingOptions;
  if (!disqualifying || Object.keys(disqualifying).length === 0) return [];

  const selected = new Set(Array.isArray(value) ? value.map(String) : value !== undefined && value !== null ? [String(value)] : []);
  return (question.choices ?? [])
    .filter((choice) => selected.has(choice) && choice in disqualifying)
    .map((choice) => {
      const raw = disqualifying[choice];
      // Defensive: disqualifyingOptions used to be `Record<string, string>`
      // before it grew a title/body shape. normalizeSurvey() repairs this on
      // mount, but guard again here too -- rendering a blank banner (title
      // undefined) would otherwise fail silently instead of loudly.
      return typeof raw === 'string' ? { title: raw } : raw;
    });
}

// Whether Continue should even be clickable right now, BEFORE a submit
// attempt -- distinct from validateQuestion, which only runs on an actual
// advance attempt and produces the inline error message. QuestionDef has no
// numeric "minimum selections" field for multipleChoice, only the generic
// `required` flag, and AJV's `required` keyword only checks a property is
// present (an empty array already satisfies it) -- so a required multi-
// select needs this extra, explicit "at least one" floor, layered on top of
// AJV rather than inside it.
export function canAttemptAdvance(question: QuestionDef, value: unknown): boolean {
  if (getDisqualifyingNotices(question, value).length > 0) return false;
  if (question.type === 'multipleChoice' && question.required) {
    return Array.isArray(value) && value.length > 0;
  }
  // Unlike every other type, disabled outright (not just error-on-click)
  // until there's a token -- there's no meaningful "optional CAPTCHA", and
  // a disabled Continue is a clearer signal than letting the click through
  // to an inline validation error.
  if (question.type === 'turnstile') {
    return typeof value === 'string' && value.length > 0;
  }
  return true;
}
