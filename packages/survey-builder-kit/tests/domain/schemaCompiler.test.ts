import Ajv from 'ajv';
import { describe, expect, it } from 'vitest';
import { compilePage } from '../../src/domain/schemaCompiler';
import type { QuestionDef } from '../../src/types/survey';

function compileOne(question: QuestionDef) {
  const { schema } = compilePage({ questions: [question] });
  return (schema.properties as Record<string, any>)[question.id];
}

describe('compilePage', () => {
  it('compiles shortText / longText to string schemas', () => {
    expect(compileOne({ id: 'q1', type: 'shortText', label: 'L' })).toEqual({ type: 'string' });
    expect(compileOne({ id: 'q2', type: 'longText', label: 'L', required: true })).toEqual({
      type: 'string',
      minLength: 1,
    });
  });

  it('compiles pattern and minLength/maxLength onto text schemas', () => {
    expect(
      compileOne({ id: 'q1b', type: 'shortText', label: 'L', pattern: '^[0-9]{5}$' }),
    ).toEqual({ type: 'string', pattern: '^[0-9]{5}$' });
    expect(
      compileOne({ id: 'q1c', type: 'shortText', label: 'L', minLength: 3, maxLength: 10 }),
    ).toEqual({ type: 'string', minLength: 3, maxLength: 10 });
  });

  it('takes the larger of required and a custom minLength', () => {
    expect(
      compileOne({ id: 'q1d', type: 'shortText', label: 'L', required: true, minLength: 5 }),
    ).toEqual({ type: 'string', minLength: 5 });
    expect(
      compileOne({ id: 'q1e', type: 'shortText', label: 'L', required: true, minLength: 0 }),
    ).toEqual({ type: 'string', minLength: 1 });
  });

  it('compiles singleChoice to a string enum', () => {
    expect(
      compileOne({ id: 'q3', type: 'singleChoice', label: 'L', choices: ['A', 'B'] }),
    ).toEqual({ type: 'string', enum: ['A', 'B'] });
  });

  it('compiles multipleChoice to a unique-items array of enum strings', () => {
    expect(
      compileOne({ id: 'q4', type: 'multipleChoice', label: 'L', choices: ['A', 'B'] }),
    ).toEqual({
      type: 'array',
      items: { type: 'string', enum: ['A', 'B'] },
      uniqueItems: true,
    });
  });

  it('compiles rating with default 1-5 range and respects overrides', () => {
    expect(compileOne({ id: 'q5', type: 'rating', label: 'L' })).toEqual({
      type: 'integer',
      minimum: 1,
      maximum: 5,
    });
    expect(compileOne({ id: 'q6', type: 'rating', label: 'L', min: 0, max: 10 })).toEqual({
      type: 'integer',
      minimum: 0,
      maximum: 10,
    });
  });

  it('compiles nps with default 0-10 range', () => {
    expect(compileOne({ id: 'q7', type: 'nps', label: 'L' })).toEqual({
      type: 'integer',
      minimum: 0,
      maximum: 10,
    });
  });

  it('compiles number with optional min/max', () => {
    expect(compileOne({ id: 'q8', type: 'number', label: 'L' })).toEqual({ type: 'number' });
    expect(compileOne({ id: 'q9', type: 'number', label: 'L', min: 0, max: 100 })).toEqual({
      type: 'number',
      minimum: 0,
      maximum: 100,
    });
  });

  it('compiles boolean and date', () => {
    expect(compileOne({ id: 'q10', type: 'boolean', label: 'L' })).toEqual({ type: 'boolean' });
    expect(compileOne({ id: 'q11', type: 'date', label: 'L' })).toEqual({
      type: 'string',
      format: 'date',
    });
  });

  it('compiles label to a text-only UI element with no schema property', () => {
    const { schema, uischema } = compilePage({
      questions: [{ id: 'label1', type: 'label', label: 'Section heading' }],
    });
    expect(schema.properties).toEqual({});
    expect((uischema as any).elements[0]).toEqual({
      type: 'Label',
      text: 'Section heading',
    });
  });

  it('populates required array from each question required flag', () => {
    const { schema } = compilePage({
      questions: [
        { id: 'req1', type: 'shortText', label: 'A', required: true },
        { id: 'opt1', type: 'shortText', label: 'B' },
        { id: 'req2', type: 'number', label: 'C', required: true },
      ],
    });
    expect(schema.required).toEqual(['req1', 'req2']);
  });

  it('omits required array entirely when no question is required', () => {
    const { schema } = compilePage({
      questions: [{ id: 'opt1', type: 'shortText', label: 'A' }],
    });
    expect(schema.required).toBeUndefined();
  });

  it('attaches a compiled rule to the UI element when visibilityRule is set', () => {
    const { uischema } = compilePage({
      questions: [
        {
          id: 'q1',
          type: 'shortText',
          label: 'A',
          visibilityRule: {
            logic: 'AND',
            conditions: [{ fieldPath: '#/properties/other', operator: 'isNotEmpty' }],
          },
        },
      ],
    });
    const element = (uischema as any).elements[0];
    expect(element.rule).toBeDefined();
    expect(element.rule.effect).toBe('SHOW');
  });

  it('produces no rule when visibilityRule is absent', () => {
    const { uischema } = compilePage({
      questions: [{ id: 'q1', type: 'shortText', label: 'A' }],
    });
    const element = (uischema as any).elements[0];
    expect(element.rule).toBeUndefined();
  });

  it('merges description and multi onto the SAME options object (regression: these used to clobber each other)', () => {
    const { uischema } = compilePage({
      questions: [{ id: 'q1', type: 'longText', label: 'A', description: 'Helper text' }],
    });
    const element = (uischema as any).elements[0];
    expect(element.options).toEqual({ description: 'Helper text', multi: true });
  });

  it('merges description and the rating/nps renderer hint onto the same options object', () => {
    const { uischema } = compilePage({
      questions: [{ id: 'q1', type: 'rating', label: 'A', description: 'Helper text' }],
    });
    const element = (uischema as any).elements[0];
    expect(element.options).toEqual({ description: 'Helper text', renderer: 'rating' });
  });

  describe('disqualifyingOptions', () => {
    it('threads disqualifyingOptions into the UI schema as metadata, not the JSON schema', () => {
      const question: QuestionDef = {
        id: 'heartAttack',
        type: 'singleChoice',
        label: 'Heart attack in the last 6 months?',
        choices: ['Yes', 'No'],
        disqualifyingOptions: { Yes: { title: 'Assessment unavailable', body: 'This disqualifies you from the online assessment.' } },
      };
      const { schema, uischema } = compilePage({ questions: [question] });

      // AJV's view of this question is completely unaffected -- "Yes" is
      // still just a normal valid enum value.
      expect(schema.properties).toEqual({ heartAttack: { type: 'string', enum: ['Yes', 'No'] } });

      const element = (uischema as any).elements[0];
      expect(element.options.disqualifyingOptions).toEqual({
        Yes: { title: 'Assessment unavailable', body: 'This disqualifies you from the online assessment.' },
      });
    });

    it('omits the options key entirely when there is nothing disqualifying (no stray empty object)', () => {
      const { uischema } = compilePage({
        questions: [{ id: 'q1', type: 'singleChoice', label: 'A', choices: ['X', 'Y'] }],
      });
      const element = (uischema as any).elements[0];
      expect(element.options).toBeUndefined();
    });

    it('omits the options key when disqualifyingOptions is present but empty', () => {
      const { uischema } = compilePage({
        questions: [{ id: 'q1', type: 'singleChoice', label: 'A', choices: ['X'], disqualifyingOptions: {} }],
      });
      const element = (uischema as any).elements[0];
      expect(element.options).toBeUndefined();
    });

    it('a disqualifying option is still a normal valid enum value as far as AJV is concerned', () => {
      const question: QuestionDef = {
        id: 'heartAttack',
        type: 'singleChoice',
        label: 'Heart attack?',
        required: true,
        choices: ['Yes', 'No'],
        disqualifyingOptions: { Yes: { title: 'Disqualified', body: 'Disqualifying message.' } },
      };
      const { schema } = compilePage({ questions: [question] });
      const ajv = new Ajv();
      const validate = ajv.compile(schema);

      expect(validate({ heartAttack: 'Yes' })).toBe(true);
      expect(validate({ heartAttack: 'No' })).toBe(true);
      expect(validate({})).toBe(false); // still enforces `required`, unaffected
      expect(validate({ heartAttack: 'Maybe' })).toBe(false); // still enforces `enum`, unaffected
    });

    it('works the same way for multipleChoice (array of enum)', () => {
      const question: QuestionDef = {
        id: 'symptoms',
        type: 'multipleChoice',
        label: 'Symptoms',
        choices: ['Headache', 'Chest pain', 'None'],
        disqualifyingOptions: { 'Chest pain': { title: 'Seek care', body: 'Seek immediate medical attention.' } },
      };
      const { schema, uischema } = compilePage({ questions: [question] });

      expect(schema.properties).toEqual({
        symptoms: { type: 'array', items: { type: 'string', enum: ['Headache', 'Chest pain', 'None'] }, uniqueItems: true },
      });
      const element = (uischema as any).elements[0];
      expect(element.options.disqualifyingOptions).toEqual({
        'Chest pain': { title: 'Seek care', body: 'Seek immediate medical attention.' },
      });

      const ajv = new Ajv();
      const validate = ajv.compile(schema);
      expect(validate({ symptoms: ['Headache', 'Chest pain'] })).toBe(true);
    });
  });
});
