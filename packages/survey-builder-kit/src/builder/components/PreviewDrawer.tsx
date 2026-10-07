import { useState } from 'react';
import { JsonForms } from '@jsonforms/react';
import { Box, Drawer, IconButton, Stack, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { materialCells } from '@jsonforms/material-renderers';
import { useBuilderStore } from '../store/builderStore';
import { builderRenderers } from '../../renderers';

export function PreviewDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const survey = useBuilderStore((s) => s.survey);
  const selectedPageId = useBuilderStore((s) => s.selectedPageId);
  const page = survey.pages.find((p) => p.id === selectedPageId);

  // Ephemeral, builder-only sample data so the author can click through
  // choices and see SHOW/HIDE rules fire live, reset whenever the page changes.
  const [previewData, setPreviewData] = useState<Record<string, unknown>>({});

  return (
    <Drawer anchor="right" open={open} onClose={onClose} slotProps={{ paper: { sx: { width: 380, p: 2.5 } } }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography variant="subtitle1">Live preview</Typography>
        <IconButton size="small" onClick={onClose} aria-label="Close preview">
          <CloseIcon fontSize="small" />
        </IconButton>
      </Stack>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
        {page?.title ?? 'Current page'} — try answering to see conditional questions appear.
      </Typography>
      <Box>
        {!page || page.questions.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            Add questions to see a preview.
          </Typography>
        ) : (
          <JsonForms
            key={page.id}
            schema={page.schema}
            uischema={page.uischema}
            data={previewData}
            renderers={builderRenderers}
            cells={materialCells}
            validationMode="ValidateAndHide"
            onChange={({ data }) => setPreviewData(data)}
          />
        )}
      </Box>
    </Drawer>
  );
}
