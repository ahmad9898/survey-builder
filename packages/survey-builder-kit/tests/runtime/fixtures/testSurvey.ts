import { compilePage } from '../../../src/domain/schemaCompiler';
import { CURRENT_SCHEMA_VERSION } from '../../../src/types/survey';
import type { QuestionDef, Survey, SurveyPage } from '../../../src/types/survey';

function buildPage(id: string, title: string, questions: QuestionDef[], defaultNextPageId: string | 'end' = 'end'): SurveyPage {
  const { schema, uischema } = compilePage({ questions });
  return { id, title, questions, schema, uischema, branch: [], defaultNextPageId };
}

// A plain two-page, one-question-per-page survey -- enough to drive the
// runner through a real page advance (for asserting a portaled step
// counter/progress bar updates), without any of the branching/scoring/
// disqualification machinery those tests don't need.
export function buildTwoPageSurvey(): Survey {
  const page1 = buildPage(
    'page1',
    'Page 1',
    [{ id: 'q1', slug: 'q1', title: 'Question 1', type: 'shortText', label: 'Question 1' }],
    'page2',
  );
  const page2 = buildPage('page2', 'Page 2', [
    { id: 'q2', slug: 'q2', title: 'Question 2', type: 'shortText', label: 'Question 2' },
  ]);

  return {
    id: 'survey_test',
    title: 'Test survey',
    schemaVersion: CURRENT_SCHEMA_VERSION,
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    startPageId: page1.id,
    pages: [page1, page2],
  };
}
