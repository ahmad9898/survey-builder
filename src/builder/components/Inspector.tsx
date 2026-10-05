import { Box } from '@mui/material';
import { InspectorTabs } from './InspectorTabs';
import { ResizeHandle } from './ResizeHandle';
import { usePanelPreferencesStore, RIGHT_PANEL_WIDTH } from '../store/panelPreferencesStore';

// Builder view's right-hand column: just the resizable/bordered "aside"
// chrome around InspectorTabs, which carries all the actual Branching/
// Scoring content and is shared with the flow map's page panel. The width
// itself is shared too (see panelPreferencesStore) -- the same one number
// used here and by FlowOverviewPanel/FlowMapPagePanel, not one per view.
export function Inspector({ pageId }: { pageId: string }) {
  const width = usePanelPreferencesStore((s) => s.rightPanelWidth);
  const setWidth = usePanelPreferencesStore((s) => s.setRightPanelWidth);

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
      <InspectorTabs pageId={pageId} />
    </Box>
  );
}
