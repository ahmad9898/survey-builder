import { withJsonFormsControlProps } from '@jsonforms/react';
import type { ControlProps } from '@jsonforms/core';
import { Box, FormHelperText, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';

function NpsControlComponent({
  data,
  handleChange,
  path,
  label,
  description,
  errors,
  visible,
  enabled,
  required,
  schema,
}: ControlProps) {
  if (visible === false) return null;

  const min = typeof schema.minimum === 'number' ? schema.minimum : 0;
  const max = typeof schema.maximum === 'number' ? schema.maximum : 10;
  const options = Array.from({ length: max - min + 1 }, (_, i) => min + i);

  return (
    <Box sx={{ my: 1.5 }}>
      <Typography component="label" variant="body2">
        {label}
        {required ? ' *' : ''}
      </Typography>
      <Box sx={{ mt: 0.5 }}>
        <ToggleButtonGroup
          exclusive
          size="small"
          value={typeof data === 'number' ? data : null}
          disabled={!enabled}
          onChange={(_, value) => {
            if (value !== null) handleChange(path, value);
          }}
        >
          {options.map((n) => (
            <ToggleButton key={n} value={n} sx={{ minWidth: 36 }}>
              {n}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Box>
      {description && <FormHelperText>{description}</FormHelperText>}
      {errors && <FormHelperText error>{errors}</FormHelperText>}
    </Box>
  );
}

export const NpsControl = withJsonFormsControlProps(NpsControlComponent);
