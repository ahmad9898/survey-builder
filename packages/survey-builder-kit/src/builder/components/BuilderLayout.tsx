import { useEffect } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import { useBuilderStore } from '../store/builderStore';
import { BuilderHeader } from './BuilderHeader';
import { PageSidebar } from './PageSidebar';
import { PageCanvas } from './PageCanvas';
import { Inspector } from './Inspector';
import { FlowMapView } from './FlowMap/FlowMapView';
import { GlobalSnackbar } from './GlobalSnackbar';
import type { SaveStatus } from '../useDraftAutosave';

export function BuilderLayout({
  saveStatus,
  onSave,
}: {
  saveStatus: SaveStatus;
  onSave: () => void;
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
        onSave();
        return;
      }
      if (e.key.toLowerCase() !== 'z') return;
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, onSave]);

  const page = survey.pages.find((p) => p.id === selectedPageId);

  return (
    // Fills whatever container the host mounts <SurveyBuilder> in -- the
    // standalone app's own page gives that container 100vh itself (see
    // packages/app's "builder-shell" CSS), but a library component can't
    // assume it owns the full browser viewport the way a dedicated route did.
    //
    // No bgcolor here deliberately: the header/sidebar/inspector are their
    // own opaque panels (background.paper), but this root has nothing to
    // paint behind the page canvas -- so a host's bgColor background (see
    // SurveyBuilder.tsx) shows through there instead of being hidden under
    // a second, redundant opaque layer.
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <BuilderHeader saveStatus={saveStatus} onSave={onSave} />
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
