// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { SurveyRunner, renderAssessment } from '../../src/SurveyRunner';
import { buildTwoPageSurvey } from './fixtures/testSurvey';

// Each test that needs a real portal target creates one as a plain DOM node
// outside React's own render tree (exactly like a host page would), and
// tears it down afterwards -- RTL's own `cleanup()` only unmounts what IT
// rendered, not nodes a test added to `document.body` by hand.
let extraNodes: Element[] = [];
function addTarget(id: string): HTMLElement {
  const el = document.createElement('div');
  el.id = id;
  document.body.appendChild(el);
  extraNodes.push(el);
  return el;
}

beforeEach(() => {
  extraNodes = [];
});

afterEach(() => {
  cleanup();
  for (const el of extraNodes) el.remove();
  vi.restoreAllMocks();
});

describe('default behavior (render*To props omitted)', () => {
  it('shows the quiz body built-in (renderAssessmentTo defaults to shown), but hides the progress bar, step counter, and Exit link entirely', () => {
    const { container } = render(<SurveyRunner survey={buildTwoPageSurvey()} exitPath="/" />);

    // The quiz body is the one piece that still defaults to "built-in and
    // visible" -- a survey must stay usable with zero render*To config.
    expect(screen.getByText('Question 1')).toBeInTheDocument();
    // The other three default to HIDDEN, not "built-in" -- omitting the
    // prop behaves exactly like passing `null`.
    expect(screen.queryByText('1 of 2')).not.toBeInTheDocument();
    expect(screen.queryByText('Exit')).not.toBeInTheDocument();
    expect(container.querySelector('.sbk-progress-bar')).not.toBeInTheDocument();
    // The header (Back button + survey title) was deleted outright -- it
    // never renders, regardless of any render*To prop.
    expect(screen.queryByText('Test survey')).not.toBeInTheDocument();
  });

  it('renderAssessment (the element-factory wrapper) behaves identically', () => {
    render(renderAssessment({ survey: buildTwoPageSurvey(), exitPath: '/' }));
    expect(screen.getByText('Question 1')).toBeInTheDocument();
    expect(screen.queryByText('1 of 2')).not.toBeInTheDocument();
    expect(screen.queryByText('Exit')).not.toBeInTheDocument();
  });
});

describe('portaling a piece into a selector target', () => {
  it('renders the step counter into the target element, not in the built-in header', async () => {
    const target = addTarget('steps-target');
    render(<SurveyRunner survey={buildTwoPageSurvey()} renderStepsTo="#steps-target" />);

    await waitFor(() => expect(within(target).getByText('1 of 2')).toBeInTheDocument());
  });

  it('renders the Exit link into an HTMLElement target passed directly (no selector)', async () => {
    const target = addTarget('exit-target');
    render(<SurveyRunner survey={buildTwoPageSurvey()} exitPath="/" renderExitTo={target} />);

    await waitFor(() => expect(within(target).getByText('Exit')).toBeInTheDocument());
  });

  it('renders the assessment body into the target element', async () => {
    const target = addTarget('assessment-target');
    render(<SurveyRunner survey={buildTwoPageSurvey()} renderAssessmentTo="#assessment-target" />);

    await waitFor(() => expect(within(target).getByText('Question 1')).toBeInTheDocument());
  });

  it('wraps the portaled piece in a stable class name, plus bgColor when set', async () => {
    const target = addTarget('steps-target-2');
    render(<SurveyRunner survey={buildTwoPageSurvey()} renderStepsTo="#steps-target-2" bgColor="acme-theme" />);

    await waitFor(() => expect(target.querySelector('.sbk-steps')).toBeTruthy());
    expect(target.querySelector('.sbk-steps.acme-theme')).toBeTruthy();
  });
});

describe('hiding a piece with null', () => {
  it('renders nothing for the step counter -- not built-in, not anywhere else', () => {
    render(<SurveyRunner survey={buildTwoPageSurvey()} renderStepsTo={null} />);
    expect(screen.queryByText('1 of 2')).not.toBeInTheDocument();
  });

  it('renders nothing for the Exit link even though exitPath is set', () => {
    render(<SurveyRunner survey={buildTwoPageSurvey()} exitPath="/" renderExitTo={null} />);
    expect(screen.queryByText('Exit')).not.toBeInTheDocument();
  });

  it('renders no header chrome at all when steps AND exit are both hidden -- the quiz body is unaffected', () => {
    const { container } = render(
      <SurveyRunner survey={buildTwoPageSurvey()} exitPath="/" renderStepsTo={null} renderExitTo={null} />,
    );
    expect(screen.queryByText('Test survey')).not.toBeInTheDocument();
    expect(screen.queryByText('1 of 2')).not.toBeInTheDocument();
    expect(screen.queryByText('Exit')).not.toBeInTheDocument();
    expect(container.querySelector('.MuiDivider-vertical')).not.toBeInTheDocument();
    expect(screen.getByText('Question 1')).toBeInTheDocument();
  });

  it('renderExitTo is irrelevant with no exitPath -- Exit stays hidden, and the selector is never even looked up', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(<SurveyRunner survey={buildTwoPageSurvey()} renderExitTo="#nonexistent-but-unused" />);

    expect(screen.queryByText('Exit')).not.toBeInTheDocument();
    expect(warnSpy).not.toHaveBeenCalled();
  });
});

describe('a selector that matches nothing', () => {
  it('warns naming the prop and selector, and renders nothing for that piece', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(<SurveyRunner survey={buildTwoPageSurvey()} renderStepsTo="#does-not-exist" />);

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('renderStepsTo'));
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('#does-not-exist'));
    expect(screen.queryByText('1 of 2')).not.toBeInTheDocument();
  });
});

describe('page advance updates a portaled piece', () => {
  it('updates the portaled step counter text after clicking Continue -- same runner state, not a separate root', async () => {
    const stepsTarget = addTarget('steps-advance');
    const progressTarget = addTarget('progress-advance');
    render(
      <SurveyRunner
        survey={buildTwoPageSurvey()}
        renderStepsTo="#steps-advance"
        renderProgressBarTo="#progress-advance"
      />,
    );

    await waitFor(() => expect(within(stepsTarget).getByText('1 of 2')).toBeInTheDocument());
    // The progress bar rendered into its own portal target too (same page).
    expect(progressTarget.querySelector('.sbk-progress-bar')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    // Advancing to page 2 updates the SAME portaled node -- proof this is a
    // live portal sharing the runner's state, not a one-time snapshot.
    await waitFor(() => expect(within(stepsTarget).getByText('2 of 2')).toBeInTheDocument());
    expect(progressTarget.querySelector('.sbk-progress-bar')).toBeTruthy();
  });
});
