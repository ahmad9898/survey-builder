// Deliberately NOT jsdom -- this file runs under the default `node`
// environment (see vite.config.ts), which has no `document`/`window` at
// all, same as a real server-rendering pass. If any render*To prop
// resolution touched `document` synchronously during render (instead of
// only inside a `useLayoutEffect`, which React never runs during SSR),
// `renderToString` below would throw `ReferenceError: document is not
// defined` -- this is the actual hazard the README's SSR note warns about.
import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { createElement } from 'react';
import { SurveyRunner, renderAssessment } from '../../src/SurveyRunner';
import { buildTwoPageSurvey } from './fixtures/testSurvey';

describe('server rendering with render*To props set', () => {
  it('does not touch `document` -- a selector string for every piece', () => {
    expect(() =>
      renderToString(
        createElement(SurveyRunner, {
          survey: buildTwoPageSurvey(),
          exitPath: '/',
          renderAssessmentTo: '#assessment',
          renderProgressBarTo: '#progress',
          renderStepsTo: '#steps',
          renderExitTo: '#exit',
        }),
      ),
    ).not.toThrow();
  });

  it('does not touch `document` when a piece is explicitly hidden (null)', () => {
    expect(() =>
      renderToString(
        createElement(SurveyRunner, {
          survey: buildTwoPageSurvey(),
          renderStepsTo: null,
          renderProgressBarTo: null,
        }),
      ),
    ).not.toThrow();
  });

  it('does not touch `document` with render*To props omitted (default, pre-existing behavior)', () => {
    expect(() => renderToString(createElement(SurveyRunner, { survey: buildTwoPageSurvey() }))).not.toThrow();
  });

  it('renderAssessment (the element-factory wrapper) is equally safe to server-render', () => {
    expect(() =>
      renderToString(renderAssessment({ survey: buildTwoPageSurvey(), renderProgressBarTo: '#progress' })),
    ).not.toThrow();
  });
});
