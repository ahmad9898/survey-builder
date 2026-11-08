import { useEffect, useMemo, useRef, useState } from 'react';
import dayjs from 'dayjs';
import { Box, MenuItem, Select, Stack, Typography, type SelectChangeEvent } from '@mui/material';
import type { QuestionControlProps } from './types';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const CURRENT_YEAR = new Date().getFullYear();
// Descending, current year first -- the overwhelmingly common use of a
// generic `date` question in this builder is a date OF BIRTH, so a long
// look-back (vs. a look-ahead) is the right default; no future years.
const YEARS = Array.from({ length: 121 }, (_, i) => CURRENT_YEAR - i);

interface DateParts {
  day: number | undefined;
  month: number | undefined;
  year: number | undefined;
}

const EMPTY_PARTS: DateParts = { day: undefined, month: undefined, year: undefined };

function daysInMonth(month: number | undefined, year: number | undefined): number {
  if (!month) return 31;
  return dayjs(`${year ?? 2000}-${String(month).padStart(2, '0')}-01`).daysInMonth();
}

function partsFromValue(value: unknown): DateParts {
  if (typeof value === 'string' && value && dayjs(value).isValid()) {
    const d = dayjs(value);
    return { day: d.date(), month: d.month() + 1, year: d.year() };
  }
  return EMPTY_PARTS;
}

function toIsoString(parts: DateParts): string | undefined {
  if (!parts.day || !parts.month || !parts.year) return undefined;
  return dayjs(`${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`).format('YYYY-MM-DD');
}

const fieldSx = {
  '& .MuiSelect-select': { fontSize: 16, py: 1.5 },
} as const;

const labelSx = {
  display: 'block',
  mb: 0.5,
  color: 'text.secondary',
  letterSpacing: 0.5,
  fontWeight: 600,
  textTransform: 'uppercase',
} as const;

// Three plain dropdowns (day/month/year) instead of a calendar popover --
// faster to fill in for a date of birth (the dominant use of the generic
// `date` type here) than typing/picking through a calendar, and avoids any
// MM/DD vs DD/MM ambiguity. Still stores/reads the same 'YYYY-MM-DD' string
// as before once all three are picked, so nothing downstream (validation,
// scoring, response payload) needs to know the input changed shape.
//
// Keeps its own local {day, month, year} state rather than deriving each
// dropdown's displayed value straight from `value` -- `value` can only ever
// be a COMPLETE date or nothing (there's no "partial date" the rest of the
// library understands), so if the displayed selection were derived purely
// from `value`, picking just a day (with month/year still unset) would
// commit `onChange(undefined)` and the dropdown would immediately forget
// what was just picked.
export function DateControl({ value, onChange }: QuestionControlProps) {
  const [parts, setParts] = useState<DateParts>(() => partsFromValue(value));

  // Re-sync local state when `value` changes from OUTSIDE this control's own
  // commits (survey navigation restoring a saved answer, the review
  // screen's "Edit" jumping back here, initialAnswers, etc.) -- but not on
  // every render, since our own commit() below causes `value` to echo back
  // exactly the ISO string we just produced from `parts`.
  const lastEmitted = useRef<string | undefined>(toIsoString(parts));
  useEffect(() => {
    const incoming = typeof value === 'string' ? value : undefined;
    if (incoming === lastEmitted.current) return;
    const next = partsFromValue(value);
    lastEmitted.current = toIsoString(next);
    setParts(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const { day, month, year } = parts;
  const days = useMemo(() => {
    const count = daysInMonth(month, year);
    return Array.from({ length: count }, (_, i) => i + 1);
  }, [month, year]);

  const commit = (patch: Partial<DateParts>) => {
    const next: DateParts = { ...parts, ...patch };
    if (next.day && next.month) {
      next.day = Math.min(next.day, daysInMonth(next.month, next.year));
    }
    setParts(next);
    const iso = toIsoString(next);
    lastEmitted.current = iso;
    onChange(iso);
  };

  const handleDay = (e: SelectChangeEvent<number | ''>) => commit({ day: e.target.value === '' ? undefined : Number(e.target.value) });
  const handleMonth = (e: SelectChangeEvent<number | ''>) => commit({ month: e.target.value === '' ? undefined : Number(e.target.value) });
  const handleYear = (e: SelectChangeEvent<number | ''>) => commit({ year: e.target.value === '' ? undefined : Number(e.target.value) });

  return (
    <Stack direction="row" spacing={2}>
      <Box sx={{ flex: 1 }}>
        <Typography variant="caption" sx={labelSx}>Day</Typography>
        <Select<number | ''>
          fullWidth
          displayEmpty
          value={day ?? ''}
          onChange={handleDay}
          sx={fieldSx}
          renderValue={(v) => (v === '' ? 'Day' : v)}
        >
          {days.map((d) => (
            <MenuItem key={d} value={d}>{d}</MenuItem>
          ))}
        </Select>
      </Box>
      <Box sx={{ flex: 1 }}>
        <Typography variant="caption" sx={labelSx}>Month</Typography>
        <Select<number | ''>
          fullWidth
          displayEmpty
          value={month ?? ''}
          onChange={handleMonth}
          sx={fieldSx}
          renderValue={(v) => (v === '' ? 'Month' : MONTHS[Number(v) - 1])}
        >
          {MONTHS.map((m, i) => (
            <MenuItem key={m} value={i + 1}>{m}</MenuItem>
          ))}
        </Select>
      </Box>
      <Box sx={{ flex: 1 }}>
        <Typography variant="caption" sx={labelSx}>Year</Typography>
        <Select<number | ''>
          fullWidth
          displayEmpty
          value={year ?? ''}
          onChange={handleYear}
          sx={fieldSx}
          renderValue={(v) => (v === '' ? 'Year' : v)}
        >
          {YEARS.map((y) => (
            <MenuItem key={y} value={y}>{y}</MenuItem>
          ))}
        </Select>
      </Box>
    </Stack>
  );
}
