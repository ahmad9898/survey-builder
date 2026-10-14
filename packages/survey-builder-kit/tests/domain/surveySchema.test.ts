import { describe, expect, it } from 'vitest';
import { validateSurvey, normalizeSurvey } from '../../src/domain/surveySchema';
import { newSurvey } from '../../src/builder/store/builderStore';

describe('validateSurvey', () => {
  it('accepts a freshly-created survey', () => {
    expect(validateSurvey(newSurvey())).toEqual({ valid: true });
  });

  it('accepts a survey missing schemaVersion (pre-existing exported JSON)', () => {
    const { schemaVersion: _schemaVersion, ...withoutSchemaVersion } = newSurvey();
    expect(validateSurvey(withoutSchemaVersion).valid).toBe(true);
  });

  it('rejects non-object input', () => {
    expect(validateSurvey(null).valid).toBe(false);
    expect(validateSurvey('not a survey').valid).toBe(false);
    expect(validateSurvey(42).valid).toBe(false);
  });

  it('rejects an object missing required top-level fields, with a readable error', () => {
    const result = validateSurvey({ title: 'Missing id and pages' });
    expect(result.valid).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors!.some((e) => e.includes('id'))).toBe(true);
  });

  it('rejects a page with a malformed question (bad type)', () => {
    const survey = newSurvey();
    survey.pages[0].questions.push({ id: 'q1', type: 'notARealType' as never, label: 'Bad' });
    expect(validateSurvey(survey).valid).toBe(false);
  });

  it('rejects a branch rule with a malformed condition group', () => {
    const survey = newSurvey();
    survey.pages[0].branch.push({
      id: 'r1',
      when: { logic: 'AND', conditions: [{ fieldPath: '#/x' } as never] },
      goToPageId: 'end',
    });
    expect(validateSurvey(survey).valid).toBe(false);
  });
});

describe('normalizeSurvey', () => {
  it('backfills schemaVersion when missing', () => {
    const { schemaVersion: _schemaVersion, ...withoutSchemaVersion } = newSurvey();
    const normalized = normalizeSurvey(withoutSchemaVersion as never);
    expect(normalized.schemaVersion).toBe(1);
  });

  it('leaves an already-versioned survey untouched', () => {
    const survey = newSurvey();
    expect(normalizeSurvey(survey)).toEqual(survey);
  });

  it('migrates a legacy string-shaped disqualifyingOptions value to {title} (regression: crashed the Builder on old saved data)', () => {
    const survey = newSurvey();
    survey.pages[0].questions.push({
      id: 'heartAttack',
      type: 'singleChoice',
      label: 'Heart attack?',
      choices: ['Yes', 'No'],
      // Cast past the current type -- this is exactly the shape that could
      // already be sitting in a user's saved survey JSON from before
      // disqualifyingOptions grew a title/body shape.
      disqualifyingOptions: { Yes: 'This disqualifies you.' } as never,
    });

    const normalized = normalizeSurvey(survey);

    expect(normalized.pages[0].questions[0].disqualifyingOptions).toEqual({
      Yes: { title: 'This disqualifies you.' },
    });
  });

  it('leaves an already-correct {title, body} disqualifyingOptions value untouched', () => {
    const survey = newSurvey();
    survey.pages[0].questions.push({
      id: 'heartAttack',
      type: 'singleChoice',
      label: 'Heart attack?',
      choices: ['Yes', 'No'],
      disqualifyingOptions: { Yes: { title: 'Disqualified', body: 'See a doctor.' } },
    });

    const normalized = normalizeSurvey(survey);

    expect(normalized.pages[0].questions[0].disqualifyingOptions).toEqual({
      Yes: { title: 'Disqualified', body: 'See a doctor.' },
    });
  });

  it('does not touch pages/questions that have no disqualifyingOptions at all', () => {
    const survey = newSurvey();
    const normalized = normalizeSurvey(survey);
    expect(normalized.pages).toBe(survey.pages); // same reference -- no unnecessary rebuild
  });
});
