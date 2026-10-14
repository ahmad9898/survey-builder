import { Autocomplete, TextField } from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import type { QuestionControlProps } from './types';

// Stacked cards stop scaling past a handful of options -- a searchable
// combobox instead, opening its listbox below. Same selected-state language
// (a check glyph) as the few-options cards once a value is chosen.
export function SingleChoiceManyControl({ question, value, onChange, onAdvance, autoFocus }: QuestionControlProps) {
  const choices = question.choices ?? [];
  const isDisqualifying = (choice: string) => choice in (question.disqualifyingOptions ?? {});

  return (
    <Autocomplete
      options={choices}
      value={typeof value === 'string' ? value : null}
      onChange={(_, newValue) => {
        onChange(newValue ?? undefined);
        // A disqualifying option is the one explicit exception to auto-
        // advance -- the respondent needs to see the warning banner
        // QuestionStage renders for this choice, not get swept past it.
        if (newValue && !isDisqualifying(newValue)) onAdvance();
      }}
      autoHighlight
      renderOption={(props, option) => {
        const { key, ...rest } = props;
        return (
          <li key={key} {...rest}>
            {option === value && <CheckIcon sx={{ fontSize: 18, mr: 1, color: 'primary.main' }} />}
            {option}
          </li>
        );
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          autoFocus={autoFocus}
          placeholder="Search options..."
          onKeyDown={(e) => {
            if (e.key === 'Enter' && value && typeof value === 'string' && !isDisqualifying(value)) {
              e.preventDefault();
              onAdvance();
            }
          }}
          slotProps={{ htmlInput: { ...params.inputProps, style: { fontSize: 18, padding: '10px 8px' } } }}
        />
      )}
    />
  );
}
