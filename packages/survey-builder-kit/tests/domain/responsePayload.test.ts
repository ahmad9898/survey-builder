import { describe, expect, it } from 'vitest';
import { buildResponsePayload } from '../../src/domain/responsePayload';
import type { Survey, SurveyPage } from '../../src/types/survey';
import type { AnswerEntry } from '../../src/types/response';

function findEntry(entries: AnswerEntry[], questionId: string): AnswerEntry | undefined {
  return entries.find((e) => e.questionId === questionId);
}

function makePage(overrides: Partial<SurveyPage> = {}): SurveyPage {
  return {
    id: 'page_1',
    title: 'Page 1',
    questions: [],
    schema: { type: 'object', properties: {} },
    uischema: { type: 'VerticalLayout', elements: [] },
    branch: [],
    defaultNextPageId: 'end',
    ...overrides,
  };
}

function makeSurvey(pages: SurveyPage[]): Survey {
  return {
    id: 'survey_fixture',
    title: 'Fixture survey',
    schemaVersion: 1,
    version: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    startPageId: pages[0].id,
    pages,
  };
}

// Covers: a plain text question, a singleChoice question with a disqualifying
// option, an unanswered optional question (skipped), a question hidden by a
// visibilityRule against the final answers, and a label-only (blocksSubmission
// notice) page -- the full set the restructure prompt asked for.
const nameQuestionPage = makePage({
  id: 'page_name',
  title: 'About you',
  questions: [
    { id: 'name', slug: 'name', title: 'Name', type: 'shortText', label: 'What is your name?', required: true },
    { id: 'nickname', slug: 'nickname', title: 'Nickname', type: 'shortText', label: 'Nickname (optional)' },
  ],
});

const heartAttackPage = makePage({
  id: 'page_heart_attack',
  title: 'Heart Attack',
  questions: [
    {
      id: 'q_heart_attack',
      slug: 'q_heart_attack',
      title: 'Heart Attack',
      type: 'singleChoice',
      label: 'Have you had a heart attack or stent in the last 6 months?',
      required: true,
      choices: ['Yes', 'No'],
      disqualifyingOptions: {
        Yes: { title: 'Medical Review Required', body: 'Please consult your doctor in person.' },
      },
    },
    {
      id: 'followUp',
      slug: 'followUp',
      title: 'Follow up',
      type: 'shortText',
      label: 'Shown only if disqualified',
      visibilityRule: {
        logic: 'AND',
        conditions: [{ fieldPath: '#/properties/q_heart_attack', operator: 'eq', value: 'Yes' }],
      },
    },
  ],
});

const noticePage = makePage({
  id: 'page_notice',
  title: 'Medical Review Required',
  blocksSubmission: true,
  questions: [
    {
      id: 'notice_label',
      slug: 'notice_label',
      title: 'Medical review notice',
      type: 'label',
      label: 'Any disqualifying answer ends the assessment.',
    },
  ],
});

describe('buildResponsePayload', () => {
  it('builds a plain text entry, marking an unanswered optional question skipped', () => {
    const survey = makeSurvey([nameQuestionPage]);
    const result = buildResponsePayload(survey, { name: 'Ahmad' }, { visitedPageIds: ['page_name'] });

    expect(findEntry(result, 'name')).toEqual({
      questionId: 'name',
      slug: 'name',
      pageId: 'page_name',
      pageTitle: 'About you',
      type: 'shortText',
      label: 'What is your name?',
      value: 'Ahmad',
      displayValue: 'Ahmad',
    });
    expect(findEntry(result, 'nickname')).toEqual({
      questionId: 'nickname',
      slug: 'nickname',
      pageId: 'page_name',
      pageTitle: 'About you',
      type: 'shortText',
      label: 'Nickname (optional)',
      displayValue: '(skipped)',
      skipped: true,
    });
  });

  it('includes the full option list (not just what was picked) and flags a disqualifying selection', () => {
    const survey = makeSurvey([heartAttackPage]);
    const result = buildResponsePayload(survey, { q_heart_attack: 'Yes' }, { visitedPageIds: ['page_heart_attack'] });

    expect(findEntry(result, 'q_heart_attack')).toEqual({
      questionId: 'q_heart_attack',
      slug: 'q_heart_attack',
      pageId: 'page_heart_attack',
      pageTitle: 'Heart Attack',
      type: 'singleChoice',
      label: 'Have you had a heart attack or stent in the last 6 months?',
      value: 'Yes',
      displayValue: 'Yes',
      options: [
        { value: 'Yes', label: 'Yes', selected: true, disqualifying: true },
        { value: 'No', label: 'No', selected: false },
      ],
      disqualifying: true,
      disqualifyMessage: 'Medical Review Required: Please consult your doctor in person.',
    });
  });

  it('omits a question hidden by its own visibilityRule for the final answers', () => {
    const survey = makeSurvey([heartAttackPage]);
    // Answered "No" -- followUp's visibilityRule (q_heart_attack === 'Yes') is false.
    const result = buildResponsePayload(survey, { q_heart_attack: 'No' }, { visitedPageIds: ['page_heart_attack'] });

    expect(findEntry(result, 'followUp')).toBeUndefined();
    expect(findEntry(result, 'q_heart_attack')?.disqualifying).toBeUndefined();
  });

  it('gives a label-only (blocksSubmission notice) question an "Acknowledged" entry with no value', () => {
    const survey = makeSurvey([noticePage]);
    const result = buildResponsePayload(survey, {}, { visitedPageIds: ['page_notice'] });

    expect(findEntry(result, 'notice_label')).toEqual({
      questionId: 'notice_label',
      slug: 'notice_label',
      pageId: 'page_notice',
      pageTitle: 'Medical Review Required',
      type: 'label',
      label: 'Any disqualifying answer ends the assessment.',
      value: null,
      displayValue: 'Acknowledged',
    });
  });

  it('only includes pages actually in visitedPageIds, in that order', () => {
    const survey = makeSurvey([nameQuestionPage, heartAttackPage, noticePage]);
    const result = buildResponsePayload(survey, { name: 'Ahmad' }, { visitedPageIds: ['page_name'] });

    expect(result.map((e) => e.questionId)).toEqual(['name', 'nickname']);
  });

  it('returns entries in visitedPageIds order even when that differs from survey.pages order', () => {
    const survey = makeSurvey([nameQuestionPage, heartAttackPage, noticePage]);
    // Visited the notice page BEFORE the name page -- the reverse of
    // survey.pages' own order -- to prove the array reflects the actual
    // path taken, not document order.
    const result = buildResponsePayload(
      survey,
      { name: 'Ahmad', q_heart_attack: 'No' },
      { visitedPageIds: ['page_notice', 'page_name'] },
    );

    expect(result.map((e) => e.questionId)).toEqual(['notice_label', 'name', 'nickname']);
  });
});
