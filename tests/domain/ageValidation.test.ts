import { describe, expect, it } from 'vitest';
import { calculateAgeYears, validateDateAge } from '../../src/domain/ageValidation';
import type { QuestionDef } from '../../src/types/survey';

const today = new Date('2026-09-08T00:00:00Z');

describe('calculateAgeYears', () => {
  it('counts full years elapsed, dropping one if the birthday has not happened yet this year', () => {
    expect(calculateAgeYears('2008-09-08', today)).toBe(18); // birthday is today
    expect(calculateAgeYears('2008-09-07', today)).toBe(18); // birthday was yesterday
    expect(calculateAgeYears('2008-09-09', today)).toBe(17); // birthday is tomorrow
    expect(calculateAgeYears('2008-01-01', today)).toBe(18);
  });

  it('returns null for an unparsable date', () => {
    expect(calculateAgeYears('not-a-date', today)).toBeNull();
  });
});

describe('validateDateAge', () => {
  const dob: QuestionDef = {
    id: 'dob',
    type: 'date',
    label: 'Date of birth',
    minYears: 18,
    maxYears: 100,
    yearsMessage: 'You must be between 18 and 100 years old.',
  };

  it('passes when age is within range', () => {
    expect(validateDateAge(dob, '2000-01-01', today)).toBeNull();
  });

  it('returns the custom message when too young', () => {
    expect(validateDateAge(dob, '2015-01-01', today)).toBe('You must be between 18 and 100 years old.');
  });

  it('returns the custom message when too old', () => {
    expect(validateDateAge(dob, '1900-01-01', today)).toBe('You must be between 18 and 100 years old.');
  });

  it('falls back to a default message when none is set', () => {
    const q: QuestionDef = { id: 'dob', type: 'date', label: 'DOB', minYears: 18 };
    expect(validateDateAge(q, '2020-01-01', today)).toBe('DOB does not meet the required age.');
  });

  it('is a no-op when no age constraint is set, the value is empty, or the type is not date', () => {
    expect(validateDateAge({ id: 'q', type: 'date', label: 'L' }, '2020-01-01', today)).toBeNull();
    expect(validateDateAge(dob, undefined, today)).toBeNull();
    expect(validateDateAge(dob, '', today)).toBeNull();
    expect(validateDateAge({ ...dob, type: 'shortText' }, '2020-01-01', today)).toBeNull();
  });
});
