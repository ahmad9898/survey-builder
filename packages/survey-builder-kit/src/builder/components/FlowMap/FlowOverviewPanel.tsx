import { Box, Stack, Typography } from '@mui/material';
import { useBuilderStore } from '../../store/builderStore';
import { usePanelPreferencesStore, RIGHT_PANEL_WIDTH } from '../../store/panelPreferencesStore';
import { computeFlowOverviewStats } from '../../../domain/flowLayout';
import { ResizeHandle } from '../ResizeHandle';

function StatRow({ label, value }: { label: string; value: number }) {
  return (
    <Stack direction="row" justifyContent="space-between" alignItems="center">
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={700}>
        {value}
      </Typography>
    </Stack>
  );
}

// The flow map's right column when nothing is selected: a summary of the
// whole survey. Selecting a page node swaps this out for FlowMapPagePanel;
// deselecting brings this back.
export function FlowOverviewPanel() {
  const survey = useBuilderStore((s) => s.survey);
  const stats = computeFlowOverviewStats(survey);
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
        p: 2.5,
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
      <Typography variant="subtitle1" fontWeight={700} gutterBottom>
        Flow overview
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
        The whole survey path, drawn from your pages and branching rules.
      </Typography>
      <Stack
        spacing={1.5}
        sx={{ p: 1.5, borderRadius: 1.5, border: '1px solid', borderColor: 'divider' }}
      >
        <StatRow label="Pages" value={stats.pageCount} />
        <StatRow label="Branch points" value={stats.branchPointCount} />
        <StatRow label="Paths to an ending" value={stats.pathsToEndingCount} />
      </Stack>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2.5 }}>
        Select a page on the map to view and edit it here.
      </Typography>
    </Box>
  );
}
