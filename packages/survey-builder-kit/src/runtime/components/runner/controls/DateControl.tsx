import dayjs, { type Dayjs } from 'dayjs';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import type { QuestionControlProps } from './types';

// A typed/segmented date field, matching the "big single input" language of
// the other types -- DatePicker's own calendar icon-button (its default
// trailing adornment) is the small click-to-open-a-calendar affordance for
// people who prefer that, rather than a popover-first experience.
export function DateControl({ value, onChange, onAdvance, autoFocus }: QuestionControlProps) {
  const dateValue: Dayjs | null = typeof value === 'string' && value ? dayjs(value) : null;

  return (
    <DatePicker
      value={dateValue}
      onChange={(newValue: Dayjs | null) => onChange(newValue && newValue.isValid() ? newValue.format('YYYY-MM-DD') : undefined)}
      format="MM/DD/YYYY"
      slotProps={{
        textField: {
          fullWidth: true,
          autoFocus,
          placeholder: 'MM/DD/YYYY',
          onKeyDown: (e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onAdvance();
            }
          },
          sx: { '& input': { fontSize: 18, padding: '14px 16px' } },
        },
      }}
    />
  );
}
