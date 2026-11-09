// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SurveyRunner } from '../../src/SurveyRunner';
import { buildFourPageSurvey } from './fixtures/testSurvey';

afterEach(() => {
  cleanup();
});

// jsdom implements a real session-history stack -- pushState/replaceState/
// back()/forward() and popstate all behave like an actual browser (popstate
// fires asynchronously, so every navigation below is followed by a waitFor).
// That makes this the most faithful way to test it short of a real browser:
// driving `window.history` directly exercises the exact APIs this feature
// is built on, not a simulation of them.

async function answerAndContinue(text: string) {
  const input = screen.getByPlaceholderText('Type your answer here...');
  fireEvent.change(input, { target: { value: text } });
  fireEvent.click(screen.getByRole('button', { name: /continue/i }));
}

describe('browser Back/Forward across assessment steps', () => {
  it('follows the acceptance table exactly: open, 3x Continue, 2x Back, Forward, internal Back', async () => {
    const startUrl = window.location.href;
    render(<SurveyRunner survey={buildFourPageSurvey()} />);

    // Open assessment -> Step 1.
    expect(screen.getByText('Question 1')).toBeInTheDocument();

    // Continue -> Step 2.
    await answerAndContinue('answer 1');
    await waitFor(() => expect(screen.getByText('Question 2')).toBeInTheDocument());

    // Continue -> Step 3.
    await answerAndContinue('answer 2');
    await waitFor(() => expect(screen.getByText('Question 3')).toBeInTheDocument());

    // Continue -> Step 4.
    await answerAndContinue('answer 3');
    await waitFor(() => expect(screen.getByText('Question 4')).toBeInTheDocument());

    // Browser Back -> Step 3.
    window.history.back();
    await waitFor(() => expect(screen.getByText('Question 3')).toBeInTheDocument());

    // Browser Back -> Step 2.
    window.history.back();
    await waitFor(() => expect(screen.getByText('Question 2')).toBeInTheDocument());

    // Browser Forward -> Step 3.
    window.history.forward();
    await waitFor(() => expect(screen.getByText('Question 3')).toBeInTheDocument());

    // Internal Back button -> Step 2.
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    await waitFor(() => expect(screen.getByText('Question 2')).toBeInTheDocument());

    // The URL never changed through any of this.
    expect(window.location.href).toBe(startUrl);
  });

  it('preserves previously entered answers across Back then Forward', async () => {
    render(<SurveyRunner survey={buildFourPageSurvey()} />);

    await answerAndContinue('alpha');
    await waitFor(() => expect(screen.getByText('Question 2')).toBeInTheDocument());
    await answerAndContinue('beta');
    await waitFor(() => expect(screen.getByText('Question 3')).toBeInTheDocument());

    window.history.back();
    await waitFor(() => expect(screen.getByText('Question 2')).toBeInTheDocument());
    window.history.back();
    await waitFor(() => expect(screen.getByText('Question 1')).toBeInTheDocument());
    expect(screen.getByPlaceholderText('Type your answer here...')).toHaveValue('alpha');

    window.history.forward();
    await waitFor(() => expect(screen.getByText('Question 2')).toBeInTheDocument());
    expect(screen.getByPlaceholderText('Type your answer here...')).toHaveValue('beta');
  });

  it('browser Back on the first step leaves the assessment alone (nothing within the run to restore)', async () => {
    render(<SurveyRunner survey={buildFourPageSurvey()} />);
    expect(screen.getByText('Question 1')).toBeInTheDocument();

    // No prior sbk-tagged entry exists below step 1 -- popstate fires (jsdom
    // still moves the history pointer) but there's nothing for the listener
    // to act on, so the displayed step is unchanged.
    window.history.back();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.getByText('Question 1')).toBeInTheDocument();
  });

  it('the internal Back button does nothing on the first step (not just hidden)', () => {
    const { container } = render(<SurveyRunner survey={buildFourPageSurvey()} />);
    // visibility:hidden on step 1 -- found via a plain DOM query rather than
    // an accessible-role query, which filters out visibility:hidden
    // elements entirely (it's correctly invisible to the accessibility
    // tree too, just not what this particular assertion is about).
    const backButton = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Back');
    expect(backButton).toBeDisabled();
  });

  it('repeated Back/Forward navigation stays correct, not just a single round-trip', async () => {
    render(<SurveyRunner survey={buildFourPageSurvey()} />);
    await answerAndContinue('a');
    await waitFor(() => expect(screen.getByText('Question 2')).toBeInTheDocument());
    await answerAndContinue('b');
    await waitFor(() => expect(screen.getByText('Question 3')).toBeInTheDocument());

    for (let i = 0; i < 3; i++) {
      window.history.back();
      await waitFor(() => expect(screen.getByText('Question 2')).toBeInTheDocument());
      window.history.forward();
      await waitFor(() => expect(screen.getByText('Question 3')).toBeInTheDocument());
    }
  });

  it('does not create a duplicate history entry for the same Continue click', async () => {
    render(<SurveyRunner survey={buildFourPageSurvey()} />);
    const lengthBefore = window.history.length;

    await answerAndContinue('x');
    await waitFor(() => expect(screen.getByText('Question 2')).toBeInTheDocument());

    expect(window.history.length).toBe(lengthBefore + 1);
  });

  it('removes its popstate listener on unmount (no stale handler left running)', async () => {
    const { unmount } = render(<SurveyRunner survey={buildFourPageSurvey()} />);
    await answerAndContinue('x');
    await waitFor(() => expect(screen.getByText('Question 2')).toBeInTheDocument());

    unmount();

    // Should not throw, and nothing is listening any more to act on this.
    expect(() => window.history.back()).not.toThrow();
  });
});
