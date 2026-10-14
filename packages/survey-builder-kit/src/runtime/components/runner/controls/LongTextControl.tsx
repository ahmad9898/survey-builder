import { TextField } from '@mui/material';
import type { QuestionControlProps } from './types';

// Multiline -- Enter must insert a newline here, NOT advance (that would be
// wrong for a paragraph answer). Advancing happens via the Continue button
// or Cmd/Ctrl+Enter; QuestionStage shows a different footer hint for this
// one type rather than the bare "press ↵" used everywhere else.
export function LongTextControl({ value, onChange, onAdvance, autoFocus }: QuestionControlProps) {
  return (
    <TextField
      fullWidth
      multiline
      minRows={3}
      maxRows={8}
      autoFocus={autoFocus}
      placeholder="Type your answer here..."
      value={typeof value === 'string' ? value : ''}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          onAdvance();
        }
      }}
      slotProps={{ htmlInput: { style: { fontSize: 18 } } }}
    />
  );
}
