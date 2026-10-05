import { Box, Chip, Divider, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useBuilderStore } from '../../store/builderStore';
import { usePanelPreferencesStore, RIGHT_PANEL_WIDTH } from '../../store/panelPreferencesStore';
import { isPageConditionalOnly, isPageUnconnected } from '../../../domain/flowLayout';
import { QuestionListEditor } from '../QuestionListEditor';
import { InspectorTabs } from '../InspectorTabs';
import { ResizeHandle } from '../ResizeHandle';

// The flow map's right column while a page node is selected: the same
// QuestionListEditor and InspectorTabs Builder view mounts, so editing here
// goes through the identical store actions -- not a second implementation
// of either that could drift out of sync. Width is the SAME shared
// preference Inspector and FlowOverviewPanel use -- one number for the
// right-hand panel across both views, not a separate default for this one.
export function FlowMapPagePanel({ pageId, onClose }: { pageId: string; onClose: () => void }) {
  const survey = useBuilderStore((s) => s.survey);
  const page = survey.pages.find((p) => p.id === pageId);
  const width = usePanelPreferencesStore((s) => s.rightPanelWidth);
  const setWidth = usePanelPreferencesStore((s) => s.setRightPanelWidth);
  if (!page) return null;

  const conditional = isPageConditionalOnly(survey, page.id);
  const unconnected = isPageUnconnected(survey, page.id);

  return (
    <Box
      component="aside"
      sx={{
        position: 'relative',
        width,
        flexShrink: 0,
        borderLeft: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
      }}
    >
      <ResizeHandle
        edge="left"
        width={width}
        min={RIGHT_PANEL_WIDTH.min}
        max={RIGHT_PANEL_WIDTH.max}
        defaultWidth={RIGHT_PANEL_WIDTH.default}
        onChange={setWidth}
        label="Resize inspector panel"
      />
      <Stack
        direction="row"
        alignItems="flex-start"
        spacing={1}
        sx={{ p: 2, pb: 1.5, borderBottom: '1px solid', borderColor: 'divider', flexShrink: 0 }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle1" fontWeight={700} noWrap>
            {page.title}
          </Typography>
          <Stack direction="row" spacing={0.75} sx={{ mt: 0.5, flexWrap: 'wrap', rowGap: 0.5 }}>
            {unconnected && (
              <Chip
                size="small"
                label="Not connected"
                sx={{ height: 18, fontSize: 10, bgcolor: 'transparent', color: 'text.disabled', border: '1px dashed', borderColor: 'text.disabled' }}
              />
            )}
            {conditional && !unconnected && (
              <Chip size="small" label="Conditional" sx={{ height: 18, fontSize: 10, bgcolor: 'action.hover', color: 'text.secondary' }} />
            )}
          </Stack>
        </Box>
        <Tooltip title="Close (Esc)">
          <IconButton size="small" onClick={onClose} aria-label="Close page panel">
            <CloseIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>

      <Box sx={{ maxHeight: '48%', overflowY: 'auto', p: 2 }}>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
          Questions
        </Typography>
        <QuestionListEditor page={page} />
      </Box>

      <Divider />

      <InspectorTabs pageId={page.id} />
    </Box>
  );
}
