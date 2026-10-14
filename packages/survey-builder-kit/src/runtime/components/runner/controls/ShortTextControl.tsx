import { TextField } from '@mui/material';
import type { QuestionControlProps } from './types';

// Single large field, no label chip inside it -- the question-stage headline
// above already IS the label. Enter submits and advances immediately; no
// blur required first.
export function ShortTextControl({ value, onChange, onAdvance, autoFocus }: QuestionControlProps) {
  return (
    <TextField
      fullWidth
      autoFocus={autoFocus}
      placeholder="Type your answer here..."
      value={typeof value === 'string' ? value : ''}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          onAdvance();
        }
      }}
      slotProps={{ htmlInput: { style: { fontSize: 18, padding: '14px 16px' } } }}
    />
  );
}
