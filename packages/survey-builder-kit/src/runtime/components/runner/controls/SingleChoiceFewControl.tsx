import { useEffect, useRef } from 'react';
import { Box } from '@mui/material';
import { OptionCard } from './OptionCard';
import type { QuestionControlProps } from './types';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

// Stacked option cards, lettered badges -- the mockup's reference treatment.
// Selecting only records the value; the respondent still has to click
// Continue themselves. The matching letter or number key selects an option
// directly (also without advancing).
export function SingleChoiceFewControl({ question, value, onChange }: QuestionControlProps) {
  const choices = question.choices ?? [];
  const containerRef = useRef<HTMLDivElement>(null);

  const select = (choice: string) => {
    onChange(choice);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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
    </Box>
  );
}
