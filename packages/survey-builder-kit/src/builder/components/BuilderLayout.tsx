import { useEffect } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import { useBuilderStore } from '../store/builderStore';
import { BuilderHeader } from './BuilderHeader';
import { PageSidebar } from './PageSidebar';
import { PageCanvas } from './PageCanvas';
import { Inspector } from './Inspector';
import { FlowMapView } from './FlowMap/FlowMapView';
import { GlobalSnackbar } from './GlobalSnackbar';
import type { SaveStatus } from '../../pages/BuilderPage';

export function BuilderLayout({
  saveStatus,
  onSaveNow,
}: {
  saveStatus: SaveStatus;
  onSaveNow: () => void;
}) {
  const survey = useBuilderStore((s) => s.survey);
  const selectedPageId = useBuilderStore((s) => s.selectedPageId);
  const viewMode = useBuilderStore((s) => s.viewMode);
  const undo = useBuilderStore((s) => s.undo);
  const redo = useBuilderStore((s) => s.redo);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;
      if (!isMod) return;
      if (e.key.toLowerCase() === 's') {
        e.preventDefault();
        onSaveNow();
        return;
      }
      if (e.key.toLowerCase() !== 'z') return;
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, onSaveNow]);

  const page = survey.pages.find((p) => p.id === selectedPageId);

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
      <BuilderHeader saveStatus={saveStatus} onSaveNow={onSaveNow} />
      <Box sx={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <PageSidebar />
        {viewMode === 'flow' ? (
          <FlowMapView />
        ) : page ? (
          <>
            <Box sx={{ flex: 1, minWidth: 0, overflowY: 'auto' }}>
              <PageCanvas />
            </Box>
            <Inspector pageId={page.id} />
          </>
        ) : (
          <Stack sx={{ flex: 1 }} alignItems="center" justifyContent="center">
            <Typography color="text.secondary">No page selected.</Typography>
          </Stack>
        )}
      </Box>
      <GlobalSnackbar />
    </Box>
  );
}
