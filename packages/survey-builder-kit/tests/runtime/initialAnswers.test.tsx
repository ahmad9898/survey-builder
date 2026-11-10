// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SurveyRunner } from '../../src/SurveyRunner';
import { buildTwoPageSurvey } from './fixtures/testSurvey';

afterEach(() => {
  cleanup();
});

describe('initialAnswers does not skip a page it fully covers', () => {
  it('shows the first page, pre-filled, instead of auto-advancing past it', () => {
    render(<SurveyRunner survey={buildTwoPageSurvey()} initialAnswers={{ q1: 'already answered' }} />);

    // Still on page 1 -- not skipped straight to page 2 just because its
    // one question already has a value from initialAnswers.
    expect(screen.getByText('Question 1')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Type your answer here...')).toHaveValue('already answered');
  });

  it('leaves the pre-filled value editable, not read-only', () => {
    render(<SurveyRunner survey={buildTwoPageSurvey()} initialAnswers={{ q1: 'already answered' }} />);
    expect(screen.getByPlaceholderText('Type your answer here...')).not.toBeDisabled();
  });

  it('still advances normally via Continue once the respondent is ready', () => {
    render(<SurveyRunner survey={buildTwoPageSurvey()} initialAnswers={{ q1: 'already answered' }} />);
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(screen.getByText('Question 2')).toBeInTheDocument();
  });
});
