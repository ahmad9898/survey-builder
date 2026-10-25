import { Box } from '@mui/material';
import { OptionCard } from './OptionCard';
import type { QuestionControlProps } from './types';

// Same option-card language as single choice, except the selected indicator
// is a square (not a circle/radio dot) so the shape itself says
// "multi-select", and clicking a selected card deselects it.
export function MultiChoiceControl({ question, value, onChange }: QuestionControlProps) {
  const choices = question.choices ?? [];
  const selected = Array.isArray(value) ? (value as string[]) : [];

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
    </Box>
  );
}
