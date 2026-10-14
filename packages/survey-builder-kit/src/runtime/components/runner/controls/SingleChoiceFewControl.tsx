import { useEffect, useRef } from 'react';
import { Box } from '@mui/material';
import { OptionCard } from './OptionCard';
import type { QuestionControlProps } from './types';

const AUTO_ADVANCE_DELAY = 180;
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

// Stacked option cards, lettered badges -- the mockup's reference treatment.
// Selecting auto-advances shortly after (so the selected state is visible
// first), but Continue stays available for a mouse user who wants to review
// before moving on. The matching letter or number key selects an option
// directly.
export function SingleChoiceFewControl({ question, value, onChange, onAdvance }: QuestionControlProps) {
  const choices = question.choices ?? [];
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const select = (choice: string) => {
    onChange(choice);
    if (timerRef.current) clearTimeout(timerRef.current);
    // A disqualifying option is the one explicit exception to auto-advance:
    // the respondent needs to actually see the warning banner QuestionStage
    // renders for this choice, not get swept past it.
    const isDisqualifying = choice in (question.disqualifyingOptions ?? {});
    if (!isDisqualifying) {
      timerRef.current = setTimeout(onAdvance, AUTO_ADVANCE_DELAY);
    }
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
