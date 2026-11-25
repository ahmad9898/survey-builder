import { useEffect, useRef } from 'react';
import { Box, TextField } from '@mui/material';
import { OptionCard } from './OptionCard';
import { OTHER_OPTION_VALUE } from '../../../../types/survey';
import type { QuestionControlProps } from './types';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

// Stacked option cards, lettered badges -- the mockup's reference treatment.
// Selecting only records the value; the respondent still has to click
// Continue themselves. The matching letter or number key selects an option
// directly (also without advancing).
export function SingleChoiceFewControl({
  question,
  value,
  onChange,
  otherValue,
  onOtherChange,
}: QuestionControlProps) {
  const choices = question.choices ?? [];
  const containerRef = useRef<HTMLDivElement>(null);
  const otherSelected = question.allowOtherOption && value === OTHER_OPTION_VALUE;

  const select = (choice: string) => {
    onChange(choice);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // These shortcuts hijack plain letter/digit keys -- never while the
      // respondent is actually typing into a text field (namely the "Other"
      // box above), or e.g. typing "B" into it would be read as "select
      // option B" instead of a character in their answer.
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      const letterIndex = LETTERS.indexOf(e.key.toUpperCase());
      const digitIndex = /^[1-9]$/.test(e.key) ? Number(e.key) - 1 : -1;
      const index = digitIndex >= 0 ? digitIndex : letterIndex;
      if (index >= 0 && index < choices.length) {
        e.preventDefault();
        select(choices[index]);
        return;
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const options = containerRef.current?.querySelectorAll<HTMLElement>('[role="radio"]');
        if (!options || options.length === 0) return;
        const focusedIndex = Array.from(options).findIndex((el) => el === document.activeElement);
        const nextIndex =
          focusedIndex === -1
            ? 0
            : (focusedIndex + (e.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
        options[nextIndex]?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [choices.join('|'), value]);

  return (
    <Box ref={containerRef} role="radiogroup">
      {choices.map((choice, i) => (
        <OptionCard
          key={choice}
          label={choice}
          badge={LETTERS[i] ?? String(i + 1)}
          selected={value === choice}
          indicatorShape="circle"
          onClick={() => select(choice)}
        />
      ))}
      {question.allowOtherOption && (
        <>
          <OptionCard
            label={question.otherOptionLabel || 'Other'}
            selected={!!otherSelected}
            indicatorShape="circle"
            onClick={() => onChange(OTHER_OPTION_VALUE)}
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
