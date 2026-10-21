import { withJsonFormsControlProps } from '@jsonforms/react';
import type { ControlProps } from '@jsonforms/core';
import { Box, Typography } from '@mui/material';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';

// Builder-only preview -- never a real Turnstile widget. The actual widget
// needs a live site key and a real network round-trip to Cloudflare,
// neither of which make sense while just authoring a survey (and the
// Builder has no respondent to challenge anyway). See runtime/components/
// runner/controls/TurnstileControl.tsx for what actually renders in
// <SurveyRunner>.
function TurnstilePlaceholderControlComponent({ label, description, visible, required }: ControlProps) {
  if (visible === false) return null;

  return (
    <Box sx={{ my: 1.5 }}>
      <Typography component="label" variant="body2">
        {label}
        {required ? ' *' : ''}
      </Typography>
      <Box
        sx={{
          mt: 0.5,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 1,
          px: 2,
          py: 1.5,
          border: '1px dashed',
          borderColor: 'divider',
          borderRadius: '8px',
          color: 'text.secondary',
          bgcolor: 'action.hover',
        }}
      >
        <ShieldOutlinedIcon fontSize="small" />
        <Typography variant="body2">Turnstile verification widget</Typography>
      </Box>
      {description && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
          {description}
        </Typography>
      )}
    </Box>
  );
}

export const TurnstilePlaceholderControl = withJsonFormsControlProps(TurnstilePlaceholderControlComponent);
