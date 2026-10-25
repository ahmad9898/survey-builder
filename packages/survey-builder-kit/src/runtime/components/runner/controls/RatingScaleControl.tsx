import { Box, Stack, Typography } from '@mui/material';
import type { QuestionControlProps } from './types';

// Shared by `rating` and `nps` -- both are "integer with a declared min/max"
// in the compiled schema, just with different default ranges (1-5 vs 0-10),
// so they get one pill-row component rather than two near-identical ones.
// QuestionDef has no endpoint-label field (e.g. "Not at all"/"Extremely"),
// so this always falls back to showing the bare min/max numbers underneath.
export function RatingScaleControl({ question, value, onChange, autoFocus }: QuestionControlProps) {
  const isNps = question.type === 'nps';
  const min = question.min ?? (isNps ? 0 : 1);
  const max = question.max ?? (isNps ? 10 : 5);
  const values = Array.from({ length: max - min + 1 }, (_, i) => min + i);

  // Selecting only records the value -- it never advances on its own; the
  // respondent still has to click Continue/Submit themselves.
  const select = (n: number) => {
    onChange(n);
  };

  return (
    <Box>
      <Stack
        direction="row"
        spacing={1}
        role="radiogroup"
        flexWrap="wrap"
        onKeyDown={(e) => {
          if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
          e.preventDefault();
          const options = e.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]');
          const focusedIndex = Array.from(options).findIndex((el) => el === document.activeElement);
          const nextIndex =
            focusedIndex === -1 ? 0 : (focusedIndex + (e.key === 'ArrowRight' ? 1 : -1) + options.length) % options.length;
          options[nextIndex]?.focus();
        }}
      >
        {values.map((n, i) => {
          const selected = value === n;
          return (
            <Box
              key={n}
              role="radio"
              aria-checked={selected}
              aria-label={String(n)}
              tabIndex={0}
              autoFocus={autoFocus && i === 0}
              onClick={() => select(n)}
              onKeyDown={(e) => {
                if (e.key === ' ' || e.key === 'Enter') {
                  e.preventDefault();
                  select(n);
                }
              }}
              sx={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                border: '1px solid',
                borderColor: selected ? 'primary.main' : 'divider',
                bgcolor: selected ? 'primary.main' : 'background.paper',
                color: selected ? 'primary.contrastText' : 'text.primary',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 16,
                fontWeight: 600,
                cursor: 'pointer',
                outline: 'none',
                transition: 'border-color .15s ease, background-color .15s ease',
                '&:hover': { borderColor: 'primary.main' },
                '&:focus-visible': { boxShadow: (t) => `0 0 0 2px ${t.palette.primary.main}` },
              }}
            >
              {n}
            </Box>
          );
        })}
      </Stack>
      <Stack direction="row" justifyContent="space-between" sx={{ mt: 1, px: 0.5 }}>
        <Typography variant="caption" color="text.secondary">
          {min}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {max}
        </Typography>
      </Stack>
    </Box>
  );
}
