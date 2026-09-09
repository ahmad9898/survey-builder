import { describe, expect, it } from 'vitest';
import type { ErrorObject } from 'ajv';
import { describeValidationErrors } from '../../src/domain/validationMessages';
import type { QuestionDef } from '../../src/types/survey';

function requiredError(missingProperty: string): ErrorObject {
  return {
    keyword: 'required',
    instancePath: '',
    schemaPath: '#/required',
    params: { missingProperty },
    message: 'must have required property',
  } as ErrorObject;
}

function fieldError(keyword: string, instancePath: string, params: object = {}): ErrorObject {
  return {
    keyword,
    instancePath,
    schemaPath: `#/${keyword}`,
    params,
    message: keyword,
  } as ErrorObject;
}

describe('describeValidationErrors', () => {
  it('uses a question custom message when set', () => {
    const questions: QuestionDef[] = [
      { id: 'q1', type: 'shortText', label: 'Name', required: true, requiredMessage: 'Please tell us your name.' },
    ];
    const result = describeValidationErrors([requiredError('q1')], questions);
    expect(result).toEqual([{ questionId: 'q1', message: 'Please tell us your name.' }]);
  });

  it('falls back to a default message when no custom message is set', () => {
    const questions: QuestionDef[] = [{ id: 'q1', type: 'shortText', label: 'Name', required: true }];
    const result = describeValidationErrors([requiredError('q1')], questions);
    expect(result).toEqual([{ questionId: 'q1', message: 'Name is required.' }]);
  });

  it('resolves pattern, length, and range errors to their custom messages', () => {
    const questions: QuestionDef[] = [
      { id: 'zip', type: 'shortText', label: 'ZIP', pattern: '^[0-9]{5}$', patternMessage: 'Enter a 5-digit ZIP code.' },
      { id: 'bio', type: 'longText', label: 'Bio', minLength: 10, lengthMessage: 'Tell us a bit more.' },
      { id: 'age', type: 'number', label: 'Age', min: 18, max: 99, rangeMessage: 'You must be an adult.' },
    ];
    const errors = [
      fieldError('pattern', '/zip'),
      fieldError('minLength', '/bio', { limit: 10 }),
      fieldError('minimum', '/age', { limit: 18 }),
    ];
    expect(describeValidationErrors(errors, questions)).toEqual([
      { questionId: 'zip', message: 'Enter a 5-digit ZIP code.' },
      { questionId: 'bio', message: 'Tell us a bit more.' },
      { questionId: 'age', message: 'You must be an adult.' },
    ]);
  });

  it('dedupes repeated messages for the same question', () => {
    const questions: QuestionDef[] = [{ id: 'q1', type: 'shortText', label: 'Name', pattern: '^a', patternMessage: 'Must start with a.' }];
    const errors = [fieldError('pattern', '/q1'), fieldError('pattern', '/q1')];
    expect(describeValidationErrors(errors, questions)).toHaveLength(1);
  });

  it('ignores errors for unknown or label questions', () => {
    const questions: QuestionDef[] = [{ id: 'label1', type: 'label', label: 'Heading' }];
    expect(describeValidationErrors([fieldError('pattern', '/missing')], questions)).toEqual([]);
  });
});
