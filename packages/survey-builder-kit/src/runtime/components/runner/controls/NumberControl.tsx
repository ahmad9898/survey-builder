import { useEffect, useRef, useState } from 'react';
import { TextField } from '@mui/material';
import type { QuestionControlProps } from './types';

// "" and every complete-or-in-progress numeric string a respondent might be
// partway through typing -- an optional leading '-', digits, and at most one
// '.'. Anything outside this shape (letters, a second '.', etc.) is simply
// never applied to the field, so there's no need for onKeyDown-level key
// blocking on top of this.
const NUMERIC_PATTERN = /^-?\d*\.?\d*$/;

function parseNumeric(raw: string): number | undefined {
  return raw === '' || raw === '-' || raw === '.' || raw === '-.' ? undefined : Number(raw);
}

// A plain `<input type="text">` rather than `type="number"` -- same visual
// language (single large right-aligned field) and same stored value/format
// as before, but avoids the native number input's browser-specific quirks
// (spinner arrows, scroll-wheel changing the value while focused, "e"/"+"
// accepted as valid characters) while still rejecting any non-numeric
// keystroke at the JS level instead of relying on the input type to do it.
export function NumberControl({ value, onChange, onAdvance, autoFocus }: QuestionControlProps) {
  const [text, setText] = useState(() => (typeof value === 'number' ? String(value) : ''));

  // Re-sync the displayed text when `value` changes from OUTSIDE this
  // control's own onChange below (survey navigation restoring a saved
  // answer, undo, initialAnswers, etc.) -- not on every render, since our
  // own onChange causes `value` to echo back exactly the number we just
  // parsed from `text`.
  const lastEmitted = useRef<number | undefined>(typeof value === 'number' ? value : undefined);
  useEffect(() => {
    const incoming = typeof value === 'number' ? value : undefined;
    if (incoming === lastEmitted.current) return;
    lastEmitted.current = incoming;
    setText(incoming === undefined ? '' : String(incoming));
  }, [value]);

  return (
    <TextField
      fullWidth
      type="text"
      autoFocus={autoFocus}
      placeholder="0"
      value={text}
      onChange={(e) => {
        const raw = e.target.value;
        if (!NUMERIC_PATTERN.test(raw)) return;
        setText(raw);
        const parsed = parseNumeric(raw);
        lastEmitted.current = parsed;
        onChange(parsed);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          onAdvance();
        }
      }}
      slotProps={{
        htmlInput: { inputMode: 'numeric', style: { fontSize: 18, padding: '14px 16px', textAlign: 'right' } },
      }}
    />
  );
}
