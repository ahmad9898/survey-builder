import { describe, expect, it } from 'vitest';
import {
  canAttemptAdvance,
  getDisqualifyingNotices,
  validateQuestion,
} from '../../src/runtime/components/runner/questionValidation';
import { compilePage } from '../../src/domain/schemaCompiler';
import type { QuestionDef, SurveyPage } from '../../src/types/survey';

function makePage(question: QuestionDef): SurveyPage {
  const { schema, uischema } = compilePage({ questions: [question] });
  return {
    id: 'page_1',
    title: 'Page 1',
    questions: [question],
    schema,
    uischema,
    branch: [],
    defaultNextPageId: 'end',
  };
}

const heartAttack: QuestionDef = {
  id: 'heartAttack',
  type: 'singleChoice',
  label: 'Have you had a heart attack or stent in the last 6 months?',
  choices: ['Yes', 'No'],
  disqualifyingOptions: {
    Yes: { title: 'Assessment unavailable', body: 'This disqualifies you from the online assessment.' },
  },
};

const symptoms: QuestionDef = {
  id: 'symptoms',
  type: 'multipleChoice',
  label: 'Symptoms',
  choices: ['Headache', 'Chest pain', 'Fatigue', 'None'],
  disqualifyingOptions: {
    'Chest pain': { title: 'Seek care', body: 'Seek immediate medical attention.' },
    Fatigue: { title: 'See a doctor', body: 'Please consult a doctor before continuing.' },
  },
};

describe('getDisqualifyingNotices', () => {
  it('is empty when the question has no disqualifyingOptions at all', () => {
    const q: QuestionDef = { id: 'q', type: 'singleChoice', label: 'Q', choices: ['A', 'B'] };
    expect(getDisqualifyingNotices(q, 'A')).toEqual([]);
  });

  it('is empty when the selected value is not one of the disqualifying options', () => {
    expect(getDisqualifyingNotices(heartAttack, 'No')).toEqual([]);
  });

  it('is empty when nothing is selected yet', () => {
    expect(getDisqualifyingNotices(heartAttack, undefined)).toEqual([]);
  });

  it('returns the title+body notice for a disqualifying singleChoice selection', () => {
    expect(getDisqualifyingNotices(heartAttack, 'Yes')).toEqual([
      { title: 'Assessment unavailable', body: 'This disqualifies you from the online assessment.' },
    ]);
  });

  it('stacks multiple selected disqualifying notices in the CHOICES list order, not selection order', () => {
    // Selected in reverse of the choices array's order (Fatigue before Chest pain).
    expect(getDisqualifyingNotices(symptoms, ['Fatigue', 'Chest pain'])).toEqual([
      { title: 'Seek care', body: 'Seek immediate medical attention.' },
      { title: 'See a doctor', body: 'Please consult a doctor before continuing.' },
    ]);
  });

  it('includes only the disqualifying ones among a mixed multi-select', () => {
    expect(getDisqualifyingNotices(symptoms, ['Headache', 'Chest pain', 'None'])).toEqual([
      { title: 'Seek care', body: 'Seek immediate medical attention.' },
    ]);
  });

  it('is empty once the last disqualifying option is deselected', () => {
    expect(getDisqualifyingNotices(symptoms, ['Headache', 'None'])).toEqual([]);
  });

  it('is empty when disqualifyingOptions is present but empty', () => {
    const q: QuestionDef = { id: 'q', type: 'singleChoice', label: 'Q', choices: ['A'], disqualifyingOptions: {} };
    expect(getDisqualifyingNotices(q, 'A')).toEqual([]);
  });
});

describe('canAttemptAdvance with disqualifying options', () => {
  it('blocks advance while a disqualifying option is selected', () => {
    expect(canAttemptAdvance(heartAttack, 'Yes')).toBe(false);
  });

  it('allows advance for a non-disqualifying selection', () => {
    expect(canAttemptAdvance(heartAttack, 'No')).toBe(true);
  });

  it('re-enables immediately once a different, non-disqualifying option replaces the blocked one', () => {
    expect(canAttemptAdvance(heartAttack, 'Yes')).toBe(false);
    expect(canAttemptAdvance(heartAttack, 'No')).toBe(true);
  });

  it('blocks a required multi-select that still has a disqualifying option selected, even alongside valid ones', () => {
    const required: QuestionDef = { ...symptoms, required: true };
    expect(canAttemptAdvance(required, ['Headache', 'Chest pain'])).toBe(false);
  });

  it('the required-multi-select "at least one" floor still applies once no disqualifying option is selected', () => {
    const required: QuestionDef = { ...symptoms, required: true };
    expect(canAttemptAdvance(required, [])).toBe(false);
    expect(canAttemptAdvance(required, ['Headache'])).toBe(true);
  });
});

describe('canAttemptAdvance never gates on allowOtherOption', () => {
  // Continue stays clickable while Other's text box is empty -- this gets
  // the same "friendly inline error on attempted advance" treatment as any
  // other required field, via validateQuestion below, not a silently
  // disabled button (unlike required-multiselect/turnstile, which DO still
  // disable it, unchanged).
  it('allows advance regardless of whether Other text has been typed', () => {
    const colorSingle: QuestionDef = {
      id: 'color',
      type: 'singleChoice',
      label: 'Favorite color?',
      choices: ['Red', 'Blue'],
      allowOtherOption: true,
    };
    expect(canAttemptAdvance(colorSingle, '__other__')).toBe(true);
  });
});

describe('validateQuestion with allowOtherOption', () => {
  const colorSingle: QuestionDef = {
    id: 'color',
    type: 'singleChoice',
    label: 'Favorite color?',
    choices: ['Red', 'Blue'],
    allowOtherOption: true,
  };

  const fruitsMulti: QuestionDef = {
    id: 'fruits',
    type: 'multipleChoice',
    label: 'Favorite fruits?',
    choices: ['Apple', 'Banana'],
    allowOtherOption: true,
  };

  it('is valid for a plain choice selection, no Other involved', () => {
    const page = makePage(colorSingle);
    expect(validateQuestion(page, colorSingle, { color: 'Red' })).toEqual([]);
  });

  it('reports a friendly error when Other is selected but its text is empty or blank', () => {
    const page = makePage(colorSingle);
    expect(validateQuestion(page, colorSingle, { color: '__other__' })).toEqual(['Please specify an answer.']);
    expect(validateQuestion(page, colorSingle, { color: '__other__', color__other: '   ' })).toEqual([
      'Please specify an answer.',
    ]);
  });

  it('is valid once non-blank text is typed', () => {
    const page = makePage(colorSingle);
    expect(
      validateQuestion(page, colorSingle, { color: '__other__', color__other: 'Chartreuse' }),
    ).toEqual([]);
  });

  it('applies the same check to a multipleChoice selection that includes Other', () => {
    const page = makePage(fruitsMulti);
    expect(validateQuestion(page, fruitsMulti, { fruits: ['Apple', '__other__'] })).toEqual([
      'Please specify an answer.',
    ]);
    expect(
      validateQuestion(page, fruitsMulti, { fruits: ['Apple', '__other__'], fruits__other: 'Dragonfruit' }),
    ).toEqual([]);
  });

  it('never applies the Other check to a question without allowOtherOption', () => {
    const plain: QuestionDef = { id: 'q', type: 'singleChoice', label: 'Q', choices: ['A', 'B'] };
    const page = makePage(plain);
    expect(validateQuestion(page, plain, { q: 'A' })).toEqual([]);
  });
});
