import { forwardRef, useState, type ReactElement, type ReactNode, type Ref } from 'react';
import {
  AppBar,
  Box,
  Chip,
  Dialog,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Slide,
  Stack,
  TextField,
  Toolbar,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import type { TransitionProps } from '@mui/material/transitions';
import Button from '@mui/material/Button';
import ViewAgendaOutlinedIcon from '@mui/icons-material/ViewAgendaOutlined';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';
import VisibilityIcon from '@mui/icons-material/Visibility';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import CloudDoneIcon from '@mui/icons-material/CloudDone';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import DownloadIcon from '@mui/icons-material/Download';
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import CloseIcon from '@mui/icons-material/Close';
import CircularProgress from '@mui/material/CircularProgress';
import { useBuilderStore, type BuilderViewMode } from '../store/builderStore';
import { exportJson } from '../../storage/fileIO';
import { PreviewDrawer } from './PreviewDrawer';
import type { SaveStatus } from '../useDraftAutosave';
import { SurveyRunner } from '../../SurveyRunner';

const SAVE_STATUS_META: Record<
  SaveStatus,
  { label: string; icon: ReactNode; color: 'default' | 'success' | 'warning' | 'error' }
> = {
  saved: { label: 'All changes saved', icon: <CloudDoneIcon fontSize="small" />, color: 'success' },
  unsaved: { label: 'Unsaved changes', icon: <CloudUploadIcon fontSize="small" />, color: 'warning' },
  saving: { label: 'Saving…', icon: <CircularProgress size={14} />, color: 'default' },
  error: { label: 'Save failed — retry', icon: <ErrorOutlineIcon fontSize="small" />, color: 'error' },
};

const SlideUpTransition = forwardRef(function SlideUpTransition(
  props: TransitionProps & { children: ReactElement },
  ref: Ref<unknown>,
) {
  return <Slide direction="up" ref={ref} {...props} />;
});

// "Save status" here is this library's OWN internal local-draft autosave
// (see useDraftAutosave) -- a crash-safety indicator, not a reflection of
// whether the host has persisted onSave's payload anywhere. "Publish" is the
// one action that hands the current survey JSON to the host via onSave;
// everything else here (Preview, Export JSON, Undo/Redo) is self-contained.
export function BuilderHeader({
  saveStatus,
  onSave,
}: {
  saveStatus: SaveStatus;
  onSave: () => void;
}) {
  const survey = useBuilderStore((s) => s.survey);
  const setSurveyTitle = useBuilderStore((s) => s.setSurveyTitle);
  const viewMode = useBuilderStore((s) => s.viewMode);
  const setViewMode = useBuilderStore((s) => s.setViewMode);
  const undo = useBuilderStore((s) => s.undo);
  const redo = useBuilderStore((s) => s.redo);
  const canUndo = useBuilderStore((s) => s.history.past.length > 0);
  const canRedo = useBuilderStore((s) => s.history.future.length > 0);

  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [previewDrawerOpen, setPreviewDrawerOpen] = useState(false);
  // The full multi-page respondent preview used to be a route navigation
  // (/run/:id) -- a library has no routes of its own to navigate to (and
  // can't depend on react-router, which isn't a peer dependency), so this
  // opens <SurveyRunner> in place instead. Same "see the real respondent
  // flow" intent, no routing dependency -- and it's a real exercise of the
  // library's own public SurveyRunner component, not a separate preview
  // implementation.
  const [fullPreviewOpen, setFullPreviewOpen] = useState(false);

  const totalQuestions = survey.pages.reduce((sum, p) => sum + p.questions.length, 0);
  const statusMeta = SAVE_STATUS_META[saveStatus];

  return (
    <AppBar
      position="static"
      color="inherit"
      sx={{ bgcolor: 'background.paper', borderBottom: '1px solid', borderColor: 'divider' }}
    >
      <Toolbar sx={{ height: 64, minHeight: '64px !important', gap: 1.5 }}>
        <Box sx={{ minWidth: 0 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <TextField
              variant="standard"
              value={survey.title}
              onChange={(e) => setSurveyTitle(e.target.value)}
              slotProps={{
                input: {
                  disableUnderline: true,
                  style: { fontSize: '1.05rem', fontWeight: 700 },
                },
              }}
              sx={{ '& .MuiInputBase-input': { p: 0 } }}
            />
            {survey.description && (
              <Chip size="small" label={survey.description} sx={{ bgcolor: 'action.hover', fontWeight: 500 }} />
            )}
          </Stack>
          <Typography variant="caption" color="text.secondary">
            {survey.pages.length} pages · {totalQuestions} questions
          </Typography>
        </Box>

        <Box sx={{ flex: 1 }} />

        <ToggleButtonGroup
          value={viewMode}
          exclusive
          size="small"
          onChange={(_, value: BuilderViewMode | null) => value && setViewMode(value)}
          sx={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}
        >
          <ToggleButton value="builder" sx={{ textTransform: 'none', px: 1.5, gap: 0.75 }}>
            <ViewAgendaOutlinedIcon sx={{ fontSize: 17 }} />
            Builder
          </ToggleButton>
          <ToggleButton value="flow" sx={{ textTransform: 'none', px: 1.5, gap: 0.75 }}>
            <AccountTreeOutlinedIcon sx={{ fontSize: 17 }} />
            Flow map
          </ToggleButton>
        </ToggleButtonGroup>

        <Box sx={{ flex: 1 }} />

        <Chip
          size="small"
          variant="outlined"
          color={statusMeta.color === 'default' ? undefined : statusMeta.color}
          icon={statusMeta.icon as ReactElement}
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
        <Tooltip title="More actions">
          <IconButton size="small" onClick={(e) => setMenuAnchor(e.currentTarget)} aria-label="More actions">
            <MoreHorizIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}>
          <MenuItem
            onClick={() => {
              setPreviewDrawerOpen(true);
              setMenuAnchor(null);
            }}
          >
            <ListItemIcon>
              <DashboardOutlinedIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Quick preview (side panel)</ListItemText>
          </MenuItem>
          <MenuItem
            onClick={() => {
              exportJson(`${survey.title}.json`, survey);
              setMenuAnchor(null);
            }}
          >
            <ListItemIcon>
              <DownloadIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Export JSON</ListItemText>
          </MenuItem>
        </Menu>
        <Tooltip title="Open the full survey preview">
          <Button
            variant="outlined"
            size="small"
            startIcon={<VisibilityIcon fontSize="small" />}
            onClick={() => setFullPreviewOpen(true)}
          >
            Preview
          </Button>
        </Tooltip>
        <Tooltip title="Save (Ctrl/Cmd+S)">
          <Button variant="contained" size="small" onClick={onSave}>
            Publish
          </Button>
        </Tooltip>
      </Toolbar>
      <PreviewDrawer open={previewDrawerOpen} onClose={() => setPreviewDrawerOpen(false)} />
      <Dialog fullScreen open={fullPreviewOpen} onClose={() => setFullPreviewOpen(false)} slots={{ transition: SlideUpTransition }}>
        <AppBar position="relative" color="inherit" sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
          <Toolbar>
            <IconButton edge="start" onClick={() => setFullPreviewOpen(false)} aria-label="Close preview">
              <CloseIcon />
            </IconButton>
            <Typography sx={{ ml: 1 }} variant="subtitle1">
              Preview — {survey.title}
            </Typography>
          </Toolbar>
        </AppBar>
        {/* Remounted fresh each time the dialog opens, via `key`, so a
            previous preview session's in-progress answers don't leak into
            the next one. */}
        {fullPreviewOpen && <SurveyRunner key={survey.id} survey={survey} onSubmit={() => setFullPreviewOpen(false)} />}
      </Dialog>
    </AppBar>
  );
}
