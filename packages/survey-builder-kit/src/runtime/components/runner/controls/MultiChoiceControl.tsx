import { Box, TextField } from '@mui/material';
import { OptionCard } from './OptionCard';
import { OTHER_OPTION_VALUE } from '../../../../types/survey';
import type { QuestionControlProps } from './types';

// Same option-card language as single choice, except the selected indicator
// is a square (not a circle/radio dot) so the shape itself says
// "multi-select", and clicking a selected card deselects it.
export function MultiChoiceControl({ question, value, onChange, otherValue, onOtherChange }: QuestionControlProps) {
  const choices = question.choices ?? [];
  const selected = Array.isArray(value) ? (value as string[]) : [];
  const otherSelected = !!question.allowOtherOption && selected.includes(OTHER_OPTION_VALUE);

  const toggle = (choice: string) => {
    onChange(selected.includes(choice) ? selected.filter((c) => c !== choice) : [...selected, choice]);
  };

  return (
    <Box role="group" aria-label={question.label}>
      {choices.map((choice) => (
        <OptionCard
          key={choice}
          label={choice}
          selected={selected.includes(choice)}
          indicatorShape="square"
          onClick={() => toggle(choice)}
        />
      ))}
      {question.allowOtherOption && (
        <>
          <OptionCard
            label={question.otherOptionLabel || 'Other'}
            selected={otherSelected}
            indicatorShape="square"
            onClick={() => toggle(OTHER_OPTION_VALUE)}
          />
          {otherSelected && (
            <TextField
              fullWidth
              autoFocus
              multiline
              minRows={2}
              size="small"
              placeholder="Please specify"
              value={typeof otherValue === 'string' ? otherValue : ''}
              onChange={(e) => onOtherChange?.(e.target.value)}
              sx={{ mt: -0.5, mb: 1.5 }}
            />
          )}
        </>
      )}
    </Box>
  );
}
