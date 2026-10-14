import { useEffect, useRef, useState } from 'react';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Box, Chip, Collapse, IconButton, Stack, TextField, Tooltip, Typography, useTheme } from '@mui/material';
import { alpha, type Theme } from '@mui/material/styles';
import Button from '@mui/material/Button';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import SwapVertIcon from '@mui/icons-material/SwapVert';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import { useBuilderStore } from '../store/builderStore';
import { usePanelPreferencesStore, SIDEBAR_WIDTH } from '../store/panelPreferencesStore';
import { isPageConditionalOnly, isPageUnconnected, pageFlowOrderDiffers, pageIconKind } from '../../domain/flowLayout';
import { resolvePageIcon } from '../pageIcon';
import { confirmDeletePage } from '../pageActions';
import { QUESTION_TYPE_ICONS } from '../questionTypeIcons';
import { sanitizeFreeTextCode } from '../../lib/id';
import { ResizeHandle } from './ResizeHandle';
import type { Survey, SurveyPage } from '../../types/survey';

// The survey's own identity -- name, free-text type, and (if set) the
// description chip -- sits above the page list rather than in the top
// toolbar: it's "what survey is this", which belongs with the page list it
// labels, not alongside Builder/Flow-map/Undo/Publish controls that act on
// whichever page is currently selected, not on the survey as a whole.
// Shared pill styling for the Name/Type rows -- bgcolor/border swap to a
// soft error tint while the value is empty, since both are mandatory; a
// legacy/imported survey that predates `type` existing just starts in this
// state until the author fills it in (see Survey.type's own comment on why
// it isn't backfilled or enforced at the schema/AJV level -- there's no
// sensible default to invent for free text, so this is enforced as a
// Builder-UI prompt, not a hard block on loading/saving older data).
// `theme.palette.error.light` is designed for solid/filled uses (buttons,
// icons) and reads as alarmingly saturated as a background wash -- alpha()
// over error.main, the same technique MUI's own Alert uses internally, is
// what actually gives the soft tint.
function pillSx(missing: boolean, theme: Theme) {
  return {
    display: 'flex' as const,
    alignItems: 'center',
    gap: 0.5,
    bgcolor: missing ? alpha(theme.palette.error.main, 0.08) : 'action.hover',
    border: '1px solid',
    borderColor: missing ? alpha(theme.palette.error.main, 0.4) : 'transparent',
    borderRadius: 5,
    pl: 1.25,
    pr: 1,
    py: 0.5,
  };
}

function RequiredMark() {
  return (
    <Box component="span" sx={{ color: 'error.main', fontWeight: 700, ml: 0.25 }}>
      *
    </Box>
  );
}

function SurveyIdentity({ survey }: { survey: Survey }) {
  const setSurveyTitle = useBuilderStore((s) => s.setSurveyTitle);
  const setSurveyType = useBuilderStore((s) => s.setSurveyType);
  const theme = useTheme();
  const totalQuestions = survey.pages.reduce((sum, p) => sum + p.questions.length, 0);
  const nameMissing = survey.title.trim().length === 0;
  const typeMissing = !(survey.type ?? '').trim();

  return (
    <Box sx={{ px: 2, pt: 2, pb: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
      <Stack spacing={0.75}>
        {/* Name and Type are the same pill-shaped, labeled-prefix input --
            Name just stretches full width and reads larger, since it's the
            primary field; the container styling itself matches exactly. */}
        <Box sx={pillSx(nameMissing, theme)}>
          <Typography variant="caption" color="text.secondary" fontWeight={600}>
            Name:
            <RequiredMark />
          </Typography>
          <TextField
            variant="standard"
            value={survey.title}
            onChange={(e) => setSurveyTitle(e.target.value)}
            fullWidth
            slotProps={{
              input: {
                disableUnderline: true,
                style: { fontSize: '0.8125rem' },
              },
            }}
            sx={{ '& .MuiInputBase-input': { p: 0 } }}
          />
        </Box>
        {nameMissing && (
          <Typography variant="caption" color="error.main" sx={{ mt: -0.5 }}>
            Name is required.
          </Typography>
        )}

        <Tooltip title="Type -- a free-text category for this survey, e.g. intake, screening">
          <Box sx={pillSx(typeMissing, theme)}>
            <Typography variant="caption" color="text.secondary" fontWeight={600}>
              Type:
              <RequiredMark />
            </Typography>
            <TextField
              variant="standard"
              placeholder="—"
              value={survey.type ?? ''}
              // Disallowed characters never make it into the value at all --
              // see sanitizeFreeTextCode's own comment -- so there's no
              // error state to show for THAT; emptiness is the only error
              // this field can be in.
              onChange={(e) => setSurveyType(sanitizeFreeTextCode(e.target.value))}
              fullWidth
              slotProps={{ input: { disableUnderline: true, style: { fontSize: '0.8125rem' } } }}
              sx={{ '& .MuiInputBase-input': { p: 0 } }}
            />
          </Box>
        </Tooltip>
        {typeMissing && (
          <Typography variant="caption" color="error.main" sx={{ mt: -0.5 }}>
            Type is required.
          </Typography>
        )}
        {survey.description && (
          <Chip
            size="small"
            label={survey.description}
            sx={{ height: 20, fontSize: 11, bgcolor: 'action.hover', fontWeight: 500, alignSelf: 'flex-start' }}
          />
        )}

        <Typography variant="caption" color="text.secondary">
          {survey.pages.length} pages · {totalQuestions} questions
        </Typography>
      </Stack>
    </Box>
  );
}

function PageTitle({ page }: { page: SurveyPage }) {
  const setPageTitle = useBuilderStore((s) => s.setPageTitle);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(page.title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      setDraft(page.title);
      requestAnimationFrame(() => inputRef.current?.select());
    }
  }, [editing, page.title]);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== page.title) setPageTitle(page.id, trimmed);
    setEditing(false);
  };

  if (editing) {
    return (
      <TextField
        inputRef={inputRef}
        size="small"
        variant="standard"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') setEditing(false);
        }}
        fullWidth
      />
    );
  }

  return (
    <Typography
      variant="body2"
      fontWeight={600}
      noWrap
      onDoubleClick={(e) => {
        e.stopPropagation();
        setEditing(true);
      }}
      title="Double-click to rename"
      sx={{ flex: 1, minWidth: 0 }}
    >
      {page.title}
    </Typography>
  );
}

function PageRow({
  page,
  survey,
  active,
  expanded,
  onToggleExpanded,
}: {
  page: SurveyPage;
  survey: Survey;
  active: boolean;
  expanded: boolean;
  onToggleExpanded: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: page.id,
  });
  const selectedQuestionId = useBuilderStore((s) => s.selectedQuestionId);
  const selectPage = useBuilderStore((s) => s.selectPage);
  const selectQuestion = useBuilderStore((s) => s.selectQuestion);
  const removePage = useBuilderStore((s) => s.removePage);
  const setStartPage = useBuilderStore((s) => s.setStartPage);
  const theme = useTheme();

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const { Icon, color } = resolvePageIcon(pageIconKind(page));
  const conditional = isPageConditionalOnly(survey, page.id);
  const unconnected = isPageUnconnected(survey, page.id);
  const orderDiffers = pageFlowOrderDiffers(survey, page.id);
  const isStart = page.id === survey.startPageId;

  const handleDelete = () => {
    if (survey.pages.length <= 1) return;
    if (confirmDeletePage(survey, page.id, page.title)) {
      removePage(page.id);
    }
  };

  const goToQuestion = (questionId: string) => {
    if (!active) selectPage(page.id);
    selectQuestion(questionId);
  };

  return (
    <Box ref={setNodeRef} style={style}>
      <Stack
        direction="row"
        alignItems="center"
        spacing={0.75}
        onClick={() => selectPage(page.id)}
        sx={{
          cursor: 'pointer',
          borderRadius: 1.5,
          pl: 0.5,
          pr: 1,
          py: 0.5,
          bgcolor: active ? 'primary.light' : undefined,
          '&:hover': { bgcolor: active ? 'primary.light' : 'action.hover' },
          '&:hover .drag-handle, &:focus-within .drag-handle': { opacity: 1 },
          '&:hover .set-start-btn, &:focus-within .set-start-btn': { opacity: 1 },
        }}
      >
        <Box
          className="drag-handle"
          {...listeners}
          {...attributes}
          sx={{
            opacity: 0,
            transition: 'opacity 0.15s',
            display: 'flex',
            alignItems: 'center',
            cursor: 'grab',
            color: 'text.disabled',
          }}
        >
          <DragIndicatorIcon fontSize="small" />
        </Box>
        <Box
          sx={{
            width: 24,
            height: 24,
            borderRadius: 1,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: active ? 'primary.main' : 'action.hover',
          }}
        >
          <Icon sx={{ fontSize: 15, color: active ? 'primary.contrastText' : color }} />
        </Box>
        <PageTitle page={page} />
        {isStart && (
          <Tooltip title="This is the first page the survey opens on">
            <Chip
              size="small"
              icon={<PlayArrowIcon sx={{ fontSize: '12px !important' }} />}
              label="Start"
              sx={{
                height: 18,
                fontSize: 10,
                fontWeight: 700,
                bgcolor: theme.custom.successBanner.bg,
                color: theme.custom.successBanner.text,
                '& .MuiChip-icon': { color: theme.custom.successBanner.text, ml: '4px' },
              }}
            />
          </Tooltip>
        )}
        {!isStart && (
          <Tooltip title="Set as start page">
            <IconButton
              size="small"
              className="set-start-btn"
              aria-label={`Set "${page.title}" as start page`}
              onClick={(e) => {
                e.stopPropagation();
                setStartPage(page.id);
              }}
              sx={{ opacity: 0, transition: 'opacity 0.15s', flexShrink: 0 }}
            >
              <PlayCircleOutlineIcon sx={{ fontSize: 15 }} />
            </IconButton>
          </Tooltip>
        )}
        {unconnected && (
          <Chip
            size="small"
            label="Not connected"
            sx={{ height: 18, fontSize: 10, bgcolor: 'transparent', color: 'text.disabled', border: '1px dashed', borderColor: 'text.disabled' }}
          />
        )}
        {conditional && !unconnected && (
          <Chip
            size="small"
            label="Conditional"
            sx={{ height: 18, fontSize: 10, bgcolor: 'action.hover', color: 'text.secondary' }}
          />
        )}
        {orderDiffers && (
          <Tooltip title="This page's position in the list doesn't match where it actually falls in the flow respondents take -- reordering only changes the list, not the branching itself.">
            <SwapVertIcon sx={{ fontSize: 15, color: 'text.disabled', flexShrink: 0 }} />
          </Tooltip>
        )}
        <Typography variant="caption" color={active ? 'primary.dark' : 'text.secondary'}>
          {page.questions.length}
        </Typography>
        {survey.pages.length > 1 && (
          <Tooltip title={`Delete "${page.title}"`}>
            <IconButton
              size="small"
              aria-label={`Delete ${page.title}`}
              onClick={(e) => {
                e.stopPropagation();
                handleDelete();
              }}
            >
              <DeleteOutlineIcon sx={{ fontSize: 15 }} />
            </IconButton>
          </Tooltip>
        )}
        <IconButton
          size="small"
          aria-label={expanded ? `Collapse ${page.title}` : `Expand ${page.title}`}
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpanded();
          }}
        >
          <ExpandMoreIcon
            fontSize="small"
            sx={{ transform: expanded ? 'none' : 'rotate(-90deg)', transition: 'transform 0.15s' }}
          />
        </IconButton>
      </Stack>
      <Collapse in={expanded} unmountOnExit>
        <Stack sx={{ pl: 4.5, pr: 1 }}>
          {page.questions.length === 0 ? (
            <Typography variant="caption" color="text.secondary" sx={{ py: 0.5 }}>
              No questions yet
            </Typography>
          ) : (
            page.questions.map((q) => {
              const QIcon = QUESTION_TYPE_ICONS[q.type];
              const questionActive = active && selectedQuestionId === q.id;
              return (
                <Stack
                  key={q.id}
                  direction="row"
                  alignItems="center"
                  spacing={1}
                  onClick={() => goToQuestion(q.id)}
                  sx={{
                    cursor: 'pointer',
                    borderRadius: 1,
                    px: 1,
                    py: 0.5,
                    bgcolor: questionActive ? 'primary.main' : undefined,
                    color: questionActive ? 'primary.contrastText' : 'text.secondary',
                    '&:hover': { bgcolor: questionActive ? 'primary.main' : 'action.hover' },
                  }}
                >
                  <QIcon fontSize="small" sx={{ color: questionActive ? 'inherit' : 'action.active' }} />
                  <Typography variant="body2" noWrap sx={{ minWidth: 0 }}>
                    {q.label || '(untitled question)'}
                  </Typography>
                </Stack>
              );
            })
          )}
        </Stack>
      </Collapse>
    </Box>
  );
}

export function PageSidebar() {
  const survey = useBuilderStore((s) => s.survey);
  const selectedPageId = useBuilderStore((s) => s.selectedPageId);
  const addPage = useBuilderStore((s) => s.addPage);
  const reorderPage = useBuilderStore((s) => s.reorderPage);
  const sidebarWidth = usePanelPreferencesStore((s) => s.sidebarWidth);
  const setSidebarWidth = usePanelPreferencesStore((s) => s.setSidebarWidth);
  const [manuallyExpanded, setManuallyExpanded] = useState<Set<string>>(new Set());

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const fromIndex = survey.pages.findIndex((p) => p.id === active.id);
    const toIndex = survey.pages.findIndex((p) => p.id === over.id);
    if (fromIndex !== -1 && toIndex !== -1) reorderPage(fromIndex, toIndex);
  };

  const toggleExpanded = (pageId: string) => {
    setManuallyExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(pageId)) next.delete(pageId);
      else next.add(pageId);
      return next;
    });
  };

  return (
    <Box
      component="aside"
      sx={{
        position: 'relative',
        width: sidebarWidth,
        flexShrink: 0,
        borderRight: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
      }}
    >
      <ResizeHandle
        edge="right"
        width={sidebarWidth}
        min={SIDEBAR_WIDTH.min}
        max={SIDEBAR_WIDTH.max}
        defaultWidth={SIDEBAR_WIDTH.default}
        onChange={setSidebarWidth}
        label="Resize pages panel"
      />
      <SurveyIdentity survey={survey} />
      <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 2, py: 1.5 }}>
        <Typography variant="subtitle2">Pages</Typography>
        <Chip size="small" label={survey.pages.length} sx={{ height: 18, fontSize: 11 }} />
        <Box sx={{ flex: 1 }} />
        <Tooltip title="Add page">
          <IconButton size="small" onClick={addPage} aria-label="Add page">
            <AddIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>

      <Box sx={{ flex: 1, overflowY: 'auto', px: 1 }}>
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <SortableContext items={survey.pages.map((p) => p.id)} strategy={verticalListSortingStrategy}>
            <Stack spacing={0.25}>
              {survey.pages.map((page) => {
                const active = page.id === selectedPageId;
                const expanded = active || manuallyExpanded.has(page.id);
                return (
                  <PageRow
                    key={page.id}
                    page={page}
                    survey={survey}
                    active={active}
                    expanded={expanded}
                    onToggleExpanded={() => toggleExpanded(page.id)}
                  />
                );
              })}
            </Stack>
          </SortableContext>
        </DndContext>
      </Box>

      <Box sx={{ p: 1.5, pt: 1 }}>
        <Button
          fullWidth
          startIcon={<AddIcon fontSize="small" />}
          onClick={addPage}
          sx={{
            border: '1px dashed',
            borderColor: 'divider',
            color: 'text.secondary',
            justifyContent: 'flex-start',
            py: 1,
          }}
        >
          Add page
        </Button>
      </Box>
    </Box>
  );
}
