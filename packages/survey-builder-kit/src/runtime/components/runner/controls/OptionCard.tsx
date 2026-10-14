import { forwardRef } from 'react';
import { Box, Typography } from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';

export interface OptionCardProps {
  label: string;
  badge?: string;
  selected: boolean;
  // true = check glyph in a chip (single-select); false = check glyph in a
  // square (multi-select) -- the selected-indicator SHAPE itself communicates
  // single- vs multi-select, not just color.
  indicatorShape: 'circle' | 'square';
  onClick: () => void;
  tabIndex?: number;
}

export const OptionCard = forwardRef<HTMLDivElement, OptionCardProps>(function OptionCard(
  { label, badge, selected, indicatorShape, onClick, tabIndex },
  ref,
) {
  return (
    <Box
      ref={ref}
      role={indicatorShape === 'circle' ? 'radio' : 'checkbox'}
      aria-checked={selected}
      tabIndex={tabIndex ?? 0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          onClick();
        }
      }}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        px: 2.5,
        py: 2,
        mb: 1.5,
        borderRadius: '10px',
        border: '1px solid',
        borderColor: selected ? 'primary.main' : 'divider',
        bgcolor: selected ? 'primary.light' : 'background.paper',
        cursor: 'pointer',
        transition: 'border-color .15s ease, background-color .15s ease',
        outline: 'none',
        '&:hover': { borderColor: 'primary.main' },
        '&:focus-visible': { boxShadow: (t) => `0 0 0 2px ${t.palette.primary.main}` },
      }}
    >
      <Box
        sx={{
          width: 24,
          height: 24,
          flexShrink: 0,
          borderRadius: indicatorShape === 'circle' ? '50%' : '6px',
          bgcolor: selected ? 'primary.main' : 'action.disabledBackground',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {selected && <CheckIcon sx={{ fontSize: 16, color: 'primary.contrastText' }} />}
      </Box>
      <Typography sx={{ flex: 1, fontSize: 16, fontWeight: 500 }}>{label}</Typography>
      {badge && (
        <Box
          sx={{
            px: 1,
            py: 0.25,
            borderRadius: '6px',
            border: '1px solid',
            borderColor: selected ? 'primary.main' : 'divider',
            fontSize: 12,
            fontWeight: 600,
            color: selected ? 'primary.main' : 'text.secondary',
            lineHeight: 1.6,
          }}
        >
          {badge}
        </Box>
      )}
    </Box>
  );
});
