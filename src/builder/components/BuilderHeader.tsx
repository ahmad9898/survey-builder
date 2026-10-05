import { useState } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  AppBar,
  Box,
  Chip,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  TextField,
  Toolbar,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import Button from '@mui/material/Button';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
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
import CircularProgress from '@mui/material/CircularProgress';
import { useBuilderStore, type BuilderViewMode } from '../store/builderStore';
import { exportJson } from '../../storage/fileIO';
import { PreviewDrawer } from './PreviewDrawer';
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

export function BuilderHeader({
  saveStatus,
  onSaveNow,
}: {
  saveStatus: SaveStatus;
  onSaveNow: () => void;
}) {
  const survey = useBuilderStore((s) => s.survey);
  const setSurveyTitle = useBuilderStore((s) => s.setSurveyTitle);
  const viewMode = useBuilderStore((s) => s.viewMode);
  const setViewMode = useBuilderStore((s) => s.setViewMode);
  const undo = useBuilderStore((s) => s.undo);
  const redo = useBuilderStore((s) => s.redo);
  const canUndo = useBuilderStore((s) => s.history.past.length > 0);
  const canRedo = useBuilderStore((s) => s.history.future.length > 0);
  const navigate = useNavigate();

  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [previewDrawerOpen, setPreviewDrawerOpen] = useState(false);

  const totalQuestions = survey.pages.reduce((sum, p) => sum + p.questions.length, 0);
  const statusMeta = SAVE_STATUS_META[saveStatus];

  return (
    <AppBar
      position="static"
      color="inherit"
      sx={{ bgcolor: 'background.paper', borderBottom: '1px solid', borderColor: 'divider' }}
    >
      <Toolbar sx={{ height: 64, minHeight: '64px !important', gap: 1.5 }}>
        <Tooltip title="Back to my surveys">
          <IconButton component={RouterLink} to="/" size="small" aria-label="Back to my surveys">
            <ArrowBackIosNewIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>

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
            onClick={() => navigate(`/run/${survey.id}`, { state: { survey } })}
          >
            Preview
          </Button>
        </Tooltip>
        <Tooltip title="Save now (Ctrl/Cmd+S)">
          <span>
            <Button variant="contained" size="small" onClick={onSaveNow} disabled={saveStatus === 'saving'}>
              Publish
            </Button>
          </span>
        </Tooltip>
      </Toolbar>
      <PreviewDrawer open={previewDrawerOpen} onClose={() => setPreviewDrawerOpen(false)} />
    </AppBar>
  );
}
