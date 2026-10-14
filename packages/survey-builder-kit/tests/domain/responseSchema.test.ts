import { describe, expect, it } from 'vitest';
import { validateSurveyResponse } from '../../src/domain/responseSchema';
import { CURRENT_ANSWERS_FORMAT_VERSION, type SurveyResponse } from '../../src/types/response';

function makeResponse(overrides: Partial<SurveyResponse> = {}): SurveyResponse {
  return {
    id: 'response_1',
    surveyId: 'survey_1',
    title: 'Fixture Survey',
    type: 'intake',
    surveyVersion: 1,
    answersFormatVersion: CURRENT_ANSWERS_FORMAT_VERSION,
    answers: [
      {
        questionId: 'q1',
        slug: 'q1',
        pageId: 'page_1',
        pageTitle: 'Page 1',
        type: 'shortText',
        label: 'Name?',
        value: 'Ahmad',
        displayValue: 'Ahmad',
      },
    ],
    visitedPageIds: ['page_1'],
    startedAt: '2026-01-01T00:00:00.000Z',
    completedAt: '2026-01-01T00:01:00.000Z',
    ...overrides,
  };
}

describe('validateSurveyResponse', () => {
  it('accepts a well-formed current-shape response', () => {
    expect(validateSurveyResponse(makeResponse())).toEqual({ valid: true });
  });

  it('rejects non-object input', () => {
    expect(validateSurveyResponse(null).valid).toBe(false);
    expect(validateSurveyResponse('not a response').valid).toBe(false);
  });

  it('rejects a legacy response with no answersFormatVersion and flat answers', () => {
    const legacy = {
      id: 'response_1',
      surveyId: 'survey_1',
      surveyVersion: 1,
      answers: { q1: 'Ahmad' },
      visitedPageIds: ['page_1'],
      startedAt: '2026-01-01T00:00:00.000Z',
    };
    expect(validateSurveyResponse(legacy).valid).toBe(false);
  });

  it('rejects an answer entry missing required fields, with a readable error', () => {
    const malformed = makeResponse({ answers: [{ questionId: 'q1' } as never] });
    const result = validateSurveyResponse(malformed);
    expect(result.valid).toBe(false);
    expect(result.errors).toBeDefined();
  });

  it('rejects a v2 response (answers as an object, not an array)', () => {
    const v2Shaped = makeResponse({ answers: { q1: { questionId: 'q1', slug: 'q1' } } as never });
    expect(validateSurveyResponse(v2Shaped).valid).toBe(false);
  });
});
