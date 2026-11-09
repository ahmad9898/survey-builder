// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SurveyRunner } from '../../src/SurveyRunner';
import { buildTwoPageSurvey } from './fixtures/testSurvey';

afterEach(() => {
  cleanup();
});

// `beforeunload` has no useful jsdom-navigable simulation -- what's testable
// (and what actually matters) is whether the browser's native prompt WOULD
// fire, which boils down to whether the listener called
// `event.preventDefault()`. Firing the real event at `window` and reading
// `defaultPrevented` back off the same event object exercises the exact
// listener the component registers, not a mock of it. (`Event.returnValue`
// is a legacy getter/setter pair, not a plain field -- per spec, setting it
// is equivalent to calling `preventDefault()`, and reading it back always
// returns the boolean `!defaultPrevented`, never the string you assigned.)
function dispatchBeforeUnload(): Event {
  const event = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(event);
  return event;
}

describe('beforeunload warning', () => {
  it('does not warn on a pristine, unanswered survey', () => {
    render(<SurveyRunner survey={buildTwoPageSurvey()} />);
    const event = dispatchBeforeUnload();
    expect(event.defaultPrevented).toBe(false);
  });

  it('warns once the respondent has answered something', async () => {
    render(<SurveyRunner survey={buildTwoPageSurvey()} />);

    const input = screen.getByPlaceholderText('Type your answer here...');
    fireEvent.change(input, { target: { value: 'in progress' } });

    await waitFor(() => {
      const event = dispatchBeforeUnload();
      expect(event.defaultPrevented).toBe(true);
      expect((event as BeforeUnloadEvent).returnValue).toBe(false);
    });
  });

  it('stops warning once the survey is finished (submitted)', async () => {
    render(<SurveyRunner survey={buildTwoPageSurvey()} />);

    const input = screen.getByPlaceholderText('Type your answer here...');
    fireEvent.change(input, { target: { value: 'answer 1' } });
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    await waitFor(() => expect(screen.getByText('Question 2')).toBeInTheDocument());
    const secondInput = screen.getByPlaceholderText('Type your answer here...');
    fireEvent.change(secondInput, { target: { value: 'answer 2' } });
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));

    // The last question's own "Submit" click lands on the review screen
    // first -- its own Submit button is what actually finishes the run.
    // ("Review your answers" also appears in the aria-live region, so this
    // targets the review screen's own subtitle instead, which is unique.)
    await waitFor(() => expect(screen.getByText(/Everything looks good/i)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));

    await waitFor(() => expect(screen.getByText(/Thanks for completing/i)).toBeInTheDocument());
    const event = dispatchBeforeUnload();
    expect(event.defaultPrevented).toBe(false);
  });

  it('stops warning once unmounted (no leaked listener)', async () => {
    const { unmount } = render(<SurveyRunner survey={buildTwoPageSurvey()} />);

    const input = screen.getByPlaceholderText('Type your answer here...');
    fireEvent.change(input, { target: { value: 'in progress' } });
    await waitFor(() => expect(dispatchBeforeUnload().defaultPrevented).toBe(true));

    unmount();
    expect(dispatchBeforeUnload().defaultPrevented).toBe(false);
  });
});
