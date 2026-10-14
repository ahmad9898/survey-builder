import { useEffect, useRef } from 'react';
import { Box, Typography } from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import type { QuestionControlProps } from './types';

const AUTO_ADVANCE_DELAY = 180;

// Its own compact pattern rather than a 2-option version of the "few
// options" card list: two large side-by-side buttons, equal visual weight.
// Common enough in a health-screening survey to deserve a snappier shape of
// its own.
export function BooleanControl({ value, onChange, onAdvance, autoFocus }: QuestionControlProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const select = (next: boolean) => {
    onChange(next);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(onAdvance, AUTO_ADVANCE_DELAY);
  };

  const buttonSx = (selected: boolean) => ({
    flex: 1,
    py: 3,
    borderRadius: '10px',
    border: '1px solid',
    borderColor: selected ? 'primary.main' : 'divider',
    bgcolor: selected ? 'primary.light' : 'background.paper',
    cursor: 'pointer',
    textAlign: 'center' as const,
    transition: 'border-color .15s ease, background-color .15s ease',
    outline: 'none',
    '&:hover': { borderColor: 'primary.main' },
    '&:focus-visible': { boxShadow: (t: { palette: { primary: { main: string } } }) => `0 0 0 2px ${t.palette.primary.main}` },
  });

  return (
    <Box
      role="radiogroup"
      sx={{ display: 'flex', gap: 2 }}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          e.preventDefault();
          (e.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]')[e.key === 'ArrowLeft' ? 0 : 1])?.focus();
        }
      }}
    >
      {([true, false] as const).map((option, i) => (
        <Box
          key={String(option)}
          role="radio"
          aria-checked={value === option}
          tabIndex={0}
          autoFocus={autoFocus && i === 0}
          onClick={() => select(option)}
          onKeyDown={(e) => {
            if (e.key === ' ' || e.key === 'Enter') {
              e.preventDefault();
              select(option);
            }
          }}
          sx={buttonSx(value === option)}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
            {value === option && <CheckIcon sx={{ fontSize: 20, color: 'primary.main' }} />}
            <Typography sx={{ fontSize: 18, fontWeight: 600 }}>{option ? 'Yes' : 'No'}</Typography>
          </Box>
        </Box>
      ))}
    </Box>
  );
}
