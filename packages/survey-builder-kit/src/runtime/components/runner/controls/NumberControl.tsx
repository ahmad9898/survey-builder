import { TextField } from '@mui/material';
import type { QuestionControlProps } from './types';

// Same single-large-field language as short text, but numeric input mode and
// right-aligned digits. No unit suffix: QuestionDef/the schema compiler have
// no unit concept to read one from (see conversation before this was built).
export function NumberControl({ value, onChange, onAdvance, autoFocus }: QuestionControlProps) {
  return (
    <TextField
      fullWidth
      type="number"
      autoFocus={autoFocus}
      placeholder="0"
      value={typeof value === 'number' ? value : ''}
      onChange={(e) => {
        const raw = e.target.value;
        onChange(raw === '' ? undefined : Number(raw));
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
