import { useEffect, useState } from 'react';
import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { Box, Button, Chip, IconButton, Stack, TextField, Tooltip, Typography } from '@mui/material';
import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';
import SaveIcon from '@mui/icons-material/Save';
import VisibilityIcon from '@mui/icons-material/Visibility';
import CloudDoneIcon from '@mui/icons-material/CloudDone';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import CircularProgress from '@mui/material/CircularProgress';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { useBuilderStore } from '../store/builderStore';
import { PageCanvas } from './PageCanvas';
import { PageOutline } from './PageOutline';
import { PreviewDrawer } from './PreviewDrawer';
import { ScoringSettings } from './ScoringSettings';
import { exportJson } from '../../storage/fileIO';
import type { SaveStatus } from '../../pages/BuilderPage';

const SAVE_STATUS_META: Record<
  SaveStatus,
  { label: string; icon: React.ReactNode; color: 'default' | 'success' | 'warning' | 'error' }
> = {
  saved: { label: 'All changes saved', icon: <CloudDoneIcon fontSize="small" />, color: 'success' },
  unsaved: { label: 'Unsaved changes', icon: <CloudUploadIcon fontSize="small" />, color: 'warning' },
  saving: { label: 'Saving…', icon: <CircularProgress size={14} />, color: 'default' },
  error: { label: 'Save failed — retry', icon: <ErrorOutlineIcon fontSize="small" />, color: 'error' },
};

export function BuilderLayout({
  saveStatus,
  onSaveNow,
}: {
  saveStatus: SaveStatus;
  onSaveNow: () => void;
}) {
  const survey = useBuilderStore((s) => s.survey);
  const setSurveyTitle = useBuilderStore((s) => s.setSurveyTitle);
  const selectedPageId = useBuilderStore((s) => s.selectedPageId);
  const reorderQuestion = useBuilderStore((s) => s.reorderQuestion);
  const undo = useBuilderStore((s) => s.undo);
  const redo = useBuilderStore((s) => s.redo);
  const canUndo = useBuilderStore((s) => s.history.past.length > 0);
  const canRedo = useBuilderStore((s) => s.history.future.length > 0);
  const navigate = useNavigate();
  const [previewOpen, setPreviewOpen] = useState(false);

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

  // A distance threshold lets plain clicks on question cards pass through
  // untouched; only pointer movement past 8px starts a drag.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || !page || active.id === over.id) return;
    const fromIndex = page.questions.findIndex((q) => q.id === active.id);
    const toIndex = page.questions.findIndex((q) => q.id === over.id);
    if (fromIndex !== -1 && toIndex !== -1) {
      reorderQuestion(page.id, fromIndex, toIndex);
    }
  };

  const statusMeta = SAVE_STATUS_META[saveStatus];

  return (
    <Box sx={{ p: 2 }}>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        alignItems={{ xs: 'stretch', md: 'center' }}
        justifyContent="space-between"
        spacing={1.5}
        sx={{ mb: 3 }}
      >
        <Stack direction="row" alignItems="center" spacing={1}>
          <Tooltip title="Back to my surveys">
            <IconButton component={RouterLink} to="/" size="small" aria-label="Back to my surveys">
              <ArrowBackIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Click to rename this survey">
            <TextField
              variant="standard"
              value={survey.title}
              onChange={(e) => setSurveyTitle(e.target.value)}
              slotProps={{ input: { style: { fontSize: '1.5rem' } } }}
            />
          </Tooltip>
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <Chip
            size="small"
            variant="outlined"
            color={statusMeta.color === 'default' ? undefined : statusMeta.color}
            icon={statusMeta.icon as React.ReactElement}
            label={statusMeta.label}
          />
          <Tooltip title="Undo (Ctrl/Cmd+Z)">
            <span>
              <IconButton size="small" disabled={!canUndo} onClick={undo} aria-label="Undo">
                <UndoIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Redo (Ctrl/Cmd+Shift+Z)">
            <span>
              <IconButton size="small" disabled={!canRedo} onClick={redo} aria-label="Redo">
                <RedoIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Save now (Ctrl/Cmd+S)">
            <span>
              <Button
                variant="outlined"
                startIcon={<SaveIcon fontSize="small" />}
                onClick={onSaveNow}
                disabled={saveStatus === 'saving'}
              >
                Save
              </Button>
            </span>
          </Tooltip>
          <Tooltip title="Live preview of the current page">
            <IconButton size="small" onClick={() => setPreviewOpen(true)} aria-label="Open live preview">
              <VisibilityIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Button variant="outlined" onClick={() => exportJson(`${survey.title}.json`, survey)}>
            Export JSON
          </Button>
          <Button
            variant="contained"
            onClick={() => navigate(`/run/${survey.id}`, { state: { survey } })}
          >
            Preview survey
          </Button>
        </Stack>
      </Stack>

      {page ? (
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} sx={{ alignItems: 'flex-start' }}>
            <PageOutline />
            <Box sx={{ flex: 1, minWidth: 0, width: '100%' }}>
              <PageCanvas />
            </Box>
          </Stack>
        </DndContext>
      ) : (
        <Typography sx={{ mt: 2 }}>No page selected.</Typography>
      )}

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} sx={{ alignItems: 'flex-start', mt: 3 }}>
        <Box sx={{ width: 280, flexShrink: 0, display: { xs: 'none', md: 'block' } }} />
        <Box sx={{ flex: 1, minWidth: 0, width: '100%' }}>
          <ScoringSettings />
        </Box>
      </Stack>

      <PreviewDrawer open={previewOpen} onClose={() => setPreviewOpen(false)} />
    </Box>
  );
}
