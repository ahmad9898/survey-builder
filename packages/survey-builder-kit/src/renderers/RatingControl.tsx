import { withJsonFormsControlProps } from '@jsonforms/react';
import type { ControlProps } from '@jsonforms/core';
import { Box, FormHelperText, Rating, Typography } from '@mui/material';

function RatingControlComponent({
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

  const max = typeof schema.maximum === 'number' ? schema.maximum : 5;

  return (
    <Box sx={{ my: 1.5 }}>
      <Typography component="label" variant="body2">
        {label}
        {required ? ' *' : ''}
      </Typography>
      <Box>
        <Rating
          max={max}
          value={typeof data === 'number' ? data : null}
          disabled={!enabled}
          onChange={(_, value) => handleChange(path, value ?? undefined)}
        />
      </Box>
      {description && (
        <FormHelperText>{description}</FormHelperText>
      )}
      {errors && (
        <FormHelperText error>{errors}</FormHelperText>
      )}
    </Box>
  );
}

export const RatingControl = withJsonFormsControlProps(RatingControlComponent);
