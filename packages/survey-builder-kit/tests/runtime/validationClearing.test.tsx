// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SurveyRunner } from '../../src/SurveyRunner';
import { buildValidationSurvey } from './fixtures/testSurvey';

afterEach(() => {
  cleanup();
});

describe('inline validation error clears on a valid value (QuestionStage, single question)', () => {
  it('shows the error on an empty required field after Continue, then clears it as the respondent types a valid value -- before the next Continue click', async () => {
    render(<SurveyRunner survey={buildValidationSurvey()} />);

    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/required/i);

    const input = screen.getByPlaceholderText('Type your answer here...');
    fireEvent.change(input, { target: { value: 'a valid answer' } });

    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    // Didn't advance just from typing -- still on the same page/question.
    expect(screen.getByText('Question 1')).toBeInTheDocument();
  });

  it('leaves the error in place while the value is still invalid (still empty)', async () => {
    render(<SurveyRunner survey={buildValidationSurvey()} />);

    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();

    // Fires an onChange that doesn't actually fix anything (still empty).
    const input = screen.getByPlaceholderText('Type your answer here...');
    fireEvent.change(input, { target: { value: '' } });

    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});

describe('inline validation errors clear independently (MultiQuestionStage, two questions)', () => {
  async function advanceToPage2() {
    render(<SurveyRunner survey={buildValidationSurvey()} />);
    const input = screen.getByPlaceholderText('Type your answer here...');
    fireEvent.change(input, { target: { value: 'ok' } });
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    await waitFor(() => expect(screen.getByText('Question 2')).toBeInTheDocument());
  }

  it('fixing only one of two invalid fields clears just that field\'s error, leaving the other', async () => {
    await advanceToPage2();

    // Page 2 is the final page -- its advance button reads "Submit", not "Continue".
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));
    const errorsBefore = await screen.findAllByRole('alert');
    expect(errorsBefore).toHaveLength(2);

    const [firstInput, secondInput] = screen.getAllByPlaceholderText('Type your answer here...');
    fireEvent.change(firstInput, { target: { value: 'filled in' } });

    await waitFor(() => expect(screen.getAllByRole('alert')).toHaveLength(1));
    // The still-empty second field's error is the one left standing.
    expect(secondInput).toHaveValue('');
  });
});
