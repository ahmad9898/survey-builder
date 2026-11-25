import { Autocomplete, Stack, TextField } from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import { OTHER_OPTION_VALUE } from '../../../../types/survey';
import type { QuestionControlProps } from './types';

// Stacked cards stop scaling past a handful of options -- a searchable
// combobox instead, opening its listbox below. Same selected-state language
// (a check glyph) as the few-options cards once a value is chosen.
export function SingleChoiceManyControl({
  question,
  value,
  onChange,
  onAdvance,
  autoFocus,
  otherValue,
  onOtherChange,
}: QuestionControlProps) {
  const choices = question.choices ?? [];
  const otherLabel = question.otherOptionLabel || 'Other';
  const options = question.allowOtherOption ? [...choices, otherLabel] : choices;
  const otherSelected = question.allowOtherOption && value === OTHER_OPTION_VALUE;
  const isDisqualifying = (choice: string) => choice in (question.disqualifyingOptions ?? {});
  // The combobox's own value/options only ever see the "Other" LABEL, never
  // the OTHER_OPTION_VALUE sentinel -- translated back and forth here so
  // this question's stored answer stays the same stable sentinel every
  // other choice control uses.
  const displayValue = typeof value === 'string' ? (otherSelected ? otherLabel : value) : null;

  return (
    <Stack spacing={1.5}>
      <Autocomplete
        options={options}
        value={displayValue}
        // Selecting only records the value -- it never advances on its own;
        // see renderInput's onKeyDown below for the one explicit way to also
        // advance from here (pressing Enter), same convention text fields use.
        onChange={(_, newValue) => {
          if (question.allowOtherOption && newValue === otherLabel) {
            onChange(OTHER_OPTION_VALUE);
            return;
          }
          onChange(newValue ?? undefined);
        }}
        autoHighlight
        renderOption={(props, option) => {
          const { key, ...rest } = props;
          return (
            <li key={key} {...rest}>
              {option === displayValue && <CheckIcon sx={{ fontSize: 18, mr: 1, color: 'primary.main' }} />}
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
      {otherSelected && (
        <TextField
          fullWidth
          autoFocus
          multiline
          minRows={2}
          size="small"
          placeholder="Please specify"
          value={typeof otherValue === 'string' ? otherValue : ''}
          onChange={(e) => onOtherChange?.(e.target.value)}
        />
      )}
    </Stack>
  );
}
