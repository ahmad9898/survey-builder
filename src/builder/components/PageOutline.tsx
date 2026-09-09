import { useEffect, useRef, useState } from 'react';
import {
  Box,
  Collapse,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import Button from '@mui/material/Button';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useBuilderStore } from '../store/builderStore';
import { QUESTION_TYPE_ICONS } from '../questionTypeIcons';
import type { SurveyPage } from '../../types/survey';

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

export function PageOutline() {
  const survey = useBuilderStore((s) => s.survey);
  const selectedPageId = useBuilderStore((s) => s.selectedPageId);
  const selectedQuestionId = useBuilderStore((s) => s.selectedQuestionId);
  const selectPage = useBuilderStore((s) => s.selectPage);
  const selectQuestion = useBuilderStore((s) => s.selectQuestion);
  const addPage = useBuilderStore((s) => s.addPage);
  const removePage = useBuilderStore((s) => s.removePage);

  const handleDeletePage = (pageId: string, title: string) => {
    if (survey.pages.length <= 1) return;
    if (
      !window.confirm(
        `Delete "${title}"? This removes all its questions and can't be undone by itself (use Undo right after if you change your mind).`,
      )
    ) {
      return;
    }
    removePage(pageId);
  };

  const goToQuestion = (pageId: string, questionId: string) => {
    if (selectedPageId !== pageId) selectPage(pageId);
    selectQuestion(questionId);
  };

  return (
    <Stack sx={{ width: 280, flexShrink: 0 }} spacing={0.5}>
      <Typography variant="subtitle2" color="text.secondary" sx={{ px: 1 }}>
        Pages
      </Typography>
      {survey.pages.map((page) => {
        const active = page.id === selectedPageId;
        return (
          <Box key={page.id}>
            <Stack
              direction="row"
              alignItems="center"
              spacing={0.5}
              onClick={() => selectPage(page.id)}
              sx={{
                cursor: 'pointer',
                borderRadius: 1,
                px: 1,
                py: 0.75,
                bgcolor: active ? 'action.selected' : undefined,
                '&:hover': { bgcolor: active ? 'action.selected' : 'action.hover' },
              }}
            >
              <ExpandMoreIcon
                fontSize="small"
                sx={{
                  color: 'text.secondary',
                  transform: active ? 'none' : 'rotate(-90deg)',
                  transition: 'transform 0.15s',
                }}
              />
              <PageTitle page={page} />
              <Typography variant="caption" color="text.secondary">
                {page.questions.length}
              </Typography>
              {survey.pages.length > 1 && (
                <Tooltip title={`Delete "${page.title}"`}>
                  <IconButton
                    size="small"
                    aria-label={`Delete ${page.title}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeletePage(page.id, page.title);
                    }}
                  >
                    <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Tooltip>
              )}
            </Stack>
            <Collapse in={active} unmountOnExit>
              <Stack sx={{ pl: 4, pr: 1 }}>
                {page.questions.length === 0 ? (
                  <Typography variant="caption" color="text.secondary" sx={{ py: 0.5 }}>
                    No questions yet
                  </Typography>
                ) : (
                  page.questions.map((q) => {
                    const Icon = QUESTION_TYPE_ICONS[q.type];
                    const questionActive = selectedQuestionId === q.id;
                    return (
                      <Stack
                        key={q.id}
                        direction="row"
                        alignItems="center"
                        spacing={1}
                        onClick={() => goToQuestion(page.id, q.id)}
                        sx={{
                          cursor: 'pointer',
                          borderRadius: 1,
                          px: 1,
                          py: 0.5,
                          bgcolor: questionActive ? 'primary.main' : undefined,
                          color: questionActive ? 'primary.contrastText' : 'text.primary',
                          '&:hover': {
                            bgcolor: questionActive ? 'primary.main' : 'action.hover',
                          },
                        }}
                      >
                        <Icon fontSize="small" sx={{ color: questionActive ? 'inherit' : 'action.active' }} />
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
      })}
      <Button size="small" startIcon={<AddIcon fontSize="small" />} onClick={addPage} sx={{ alignSelf: 'flex-start', mt: 1 }}>
        Add page
      </Button>
    </Stack>
  );
}
