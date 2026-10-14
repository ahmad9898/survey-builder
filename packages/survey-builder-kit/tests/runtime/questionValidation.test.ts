import { describe, expect, it } from 'vitest';
import { canAttemptAdvance, getDisqualifyingNotices } from '../../src/runtime/components/runner/questionValidation';
import type { QuestionDef } from '../../src/types/survey';

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
