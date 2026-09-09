import { useEffect, useRef } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Box,
  Card,
  Checkbox,
  Collapse,
  Divider,
  FormControlLabel,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import Button from '@mui/material/Button';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import type { QuestionDef, Survey } from '../../types/survey';
import { questionTypeMeta } from '../questionTypes';
import { useBuilderStore } from '../store/builderStore';
import { ConditionEditor, type FieldOption } from './ConditionEditor';
import { ScoringEditor } from './ScoringEditor';

function ChoiceListEditor({ questionId, choices }: { questionId: string; choices: string[] }) {
  const updateQuestion = useBuilderStore((s) => s.updateQuestion);

  const setChoice = (index: number, value: string) => {
    const next = [...choices];
    next[index] = value;
    updateQuestion(questionId, { choices: next });
  };
  const removeChoice = (index: number) => {
    if (choices.length <= 1) return;
    updateQuestion(questionId, { choices: choices.filter((_, i) => i !== index) });
  };
  const moveChoice = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= choices.length) return;
    const next = [...choices];
    [next[index], next[target]] = [next[target], next[index]];
    updateQuestion(questionId, { choices: next });
  };
  const addChoice = () => {
    updateQuestion(questionId, { choices: [...choices, `Option ${choices.length + 1}`] });
  };

  return (
    <Stack spacing={1}>
      <Typography variant="caption" color="text.secondary">
        Options
      </Typography>
      {choices.map((choice, i) => (
        <Stack direction="row" spacing={0.5} key={i} alignItems="center">
          <Stack>
            <IconButton
              size="small"
              disabled={i === 0}
              onClick={() => moveChoice(i, -1)}
              aria-label={`Move option "${choice}" up`}
              sx={{ p: 0.25 }}
            >
              <ArrowUpwardIcon sx={{ fontSize: 14 }} />
            </IconButton>
            <IconButton
              size="small"
              disabled={i === choices.length - 1}
              onClick={() => moveChoice(i, 1)}
              aria-label={`Move option "${choice}" down`}
              sx={{ p: 0.25 }}
            >
              <ArrowDownwardIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </Stack>
          <TextField
            size="small"
            fullWidth
            value={choice}
            onChange={(e) => setChoice(i, e.target.value)}
          />
          <Tooltip title={choices.length <= 1 ? 'At least one option is required' : 'Remove option'}>
            <span>
              <IconButton
                size="small"
                disabled={choices.length <= 1}
                onClick={() => removeChoice(i)}
                aria-label={`Remove option "${choice}"`}
              >
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
      ))}
      <Button size="small" onClick={addChoice}>
        + Add option
      </Button>
    </Stack>
  );
}

// Fields a question's visibility rule may reference: every question on this
// page and earlier pages (excluding itself), since branching/build order
// means later pages can't yet be answered when this one renders.
function availableFieldsFor(survey: Survey, questionId: string): FieldOption[] {
  const pageIndex = survey.pages.findIndex((p) => p.questions.some((q) => q.id === questionId));
  if (pageIndex === -1) return [];
  const fields: FieldOption[] = [];
  for (let i = 0; i <= pageIndex; i++) {
    for (const q of survey.pages[i].questions) {
      if (q.id !== questionId && q.type !== 'label')
        fields.push({
          scope: `#/properties/${q.id}`,
          label: q.label,
          questionType: q.type,
          choices: q.choices,
        });
    }
  }
  return fields;
}

export function QuestionCard({ question }: { question: QuestionDef }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: question.id,
    data: { source: 'canvas-item' },
  });
  const selectedQuestionId = useBuilderStore((s) => s.selectedQuestionId);
  const selectQuestion = useBuilderStore((s) => s.selectQuestion);
  const duplicateQuestion = useBuilderStore((s) => s.duplicateQuestion);
  const removeQuestion = useBuilderStore((s) => s.removeQuestion);
  const updateQuestion = useBuilderStore((s) => s.updateQuestion);
  const setVisibilityRule = useBuilderStore((s) => s.setVisibilityRule);
  const survey = useBuilderStore((s) => s.survey);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const expanded = selectedQuestionId === question.id;
  const toggleExpanded = () => selectQuestion(expanded ? null : question.id);

  const meta = questionTypeMeta(question.type);
  const hasChoices = question.type === 'singleChoice' || question.type === 'multipleChoice';
  const hasMinMax = question.type === 'rating' || question.type === 'number' || question.type === 'nps';
  const isLabel = question.type === 'label';
  const hasText = question.type === 'shortText' || question.type === 'longText';
  const isDate = question.type === 'date';

  const cardRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (expanded) cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [expanded]);
  const setRefs = (node: HTMLDivElement | null) => {
    setNodeRef(node);
    cardRef.current = node;
  };

  return (
    <Card
      ref={setRefs}
      style={style}
      variant="outlined"
      sx={{
        borderColor: expanded ? 'primary.main' : undefined,
        borderWidth: expanded ? 2 : 1,
      }}
    >
      <Stack direction="row" alignItems="center">
        <Tooltip title="Drag to reorder">
          <IconButton size="small" {...listeners} {...attributes} sx={{ cursor: 'grab' }}>
            <DragIndicatorIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Box onClick={toggleExpanded} sx={{ flex: 1, cursor: 'pointer', px: 1, py: 1.5, minWidth: 0 }}>
          <Typography variant="body2" fontWeight={500} noWrap>
            {question.label || '(untitled question)'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {meta.paletteLabel}
            {question.required ? ' · required' : ''}
            {question.visibilityRule ? ' · conditional' : ''}
          </Typography>
        </Box>
        <Tooltip title="Duplicate question">
          <IconButton
            size="small"
            aria-label="Duplicate question"
            onClick={() => duplicateQuestion(question.id)}
          >
            <ContentCopyIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Delete question">
          <IconButton
            size="small"
            aria-label="Delete question"
            onClick={() => {
              if (window.confirm(`Delete "${question.label || 'this question'}"?`)) {
                removeQuestion(question.id);
              }
            }}
          >
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <IconButton
          size="small"
          onClick={toggleExpanded}
          aria-label={expanded ? 'Collapse question' : 'Expand question'}
          sx={{ mr: 0.5, transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}
        >
          <ExpandMoreIcon fontSize="small" />
        </IconButton>
      </Stack>

      <Collapse in={expanded} unmountOnExit>
        <Box sx={{ px: 2, pb: 2, pt: 0.5 }}>
          <Divider sx={{ mb: 2 }} />
          <Stack spacing={2}>
            <TextField
              label={isLabel ? 'Text' : 'Label'}
              size="small"
              fullWidth
              multiline={isLabel}
              value={question.label}
              onChange={(e) => updateQuestion(question.id, { label: e.target.value })}
            />
            {!isLabel && (
              <TextField
                label="Description (optional)"
                size="small"
                fullWidth
                multiline
                value={question.description ?? ''}
                onChange={(e) => updateQuestion(question.id, { description: e.target.value })}
              />
            )}
            {!isLabel && (
              <FormControlLabel
                control={
                  <Checkbox
                    checked={!!question.required}
                    onChange={(e) => updateQuestion(question.id, { required: e.target.checked })}
                  />
                }
                label="Required"
              />
            )}
            {!isLabel && question.required && (
              <TextField
                label="Custom message when empty (optional)"
                size="small"
                fullWidth
                placeholder={`${question.label || 'This field'} is required.`}
                value={question.requiredMessage ?? ''}
                onChange={(e) =>
                  updateQuestion(question.id, { requiredMessage: e.target.value || undefined })
                }
              />
            )}
            {hasChoices && (
              <ChoiceListEditor questionId={question.id} choices={question.choices ?? []} />
            )}
            {hasMinMax && (
              <>
                <Stack direction="row" spacing={1}>
                  <TextField
                    label="Min"
                    size="small"
                    type="number"
                    value={question.min ?? ''}
                    onChange={(e) =>
                      updateQuestion(question.id, {
                        min: e.target.value === '' ? undefined : Number(e.target.value),
                      })
                    }
                  />
                  <TextField
                    label="Max"
                    size="small"
                    type="number"
                    value={question.max ?? ''}
                    onChange={(e) =>
                      updateQuestion(question.id, {
                        max: e.target.value === '' ? undefined : Number(e.target.value),
                      })
                    }
                  />
                </Stack>
                <TextField
                  label="Custom message when out of range (optional)"
                  size="small"
                  fullWidth
                  placeholder={`${question.label || 'This field'} is out of the allowed range.`}
                  value={question.rangeMessage ?? ''}
                  onChange={(e) =>
                    updateQuestion(question.id, { rangeMessage: e.target.value || undefined })
                  }
                />
              </>
            )}
            {hasText && (
              <>
                <Divider />
                <Typography variant="caption" color="text.secondary">
                  Custom validation
                </Typography>
                <Stack direction="row" spacing={1}>
                  <TextField
                    label="Min length"
                    size="small"
                    type="number"
                    value={question.minLength ?? ''}
                    onChange={(e) =>
                      updateQuestion(question.id, {
                        minLength: e.target.value === '' ? undefined : Number(e.target.value),
                      })
                    }
                  />
                  <TextField
                    label="Max length"
                    size="small"
                    type="number"
                    value={question.maxLength ?? ''}
                    onChange={(e) =>
                      updateQuestion(question.id, {
                        maxLength: e.target.value === '' ? undefined : Number(e.target.value),
                      })
                    }
                  />
                </Stack>
                {(question.minLength !== undefined || question.maxLength !== undefined) && (
                  <TextField
                    label="Custom message for length (optional)"
                    size="small"
                    fullWidth
                    placeholder={`${question.label || 'This field'} length is invalid.`}
                    value={question.lengthMessage ?? ''}
                    onChange={(e) =>
                      updateQuestion(question.id, { lengthMessage: e.target.value || undefined })
                    }
                  />
                )}
                <TextField
                  label="Pattern (regex, optional)"
                  size="small"
                  fullWidth
                  placeholder="e.g. ^[0-9]{5}$"
                  value={question.pattern ?? ''}
                  onChange={(e) =>
                    updateQuestion(question.id, { pattern: e.target.value || undefined })
                  }
                />
                {question.pattern && (
                  <TextField
                    label="Custom message for pattern (optional)"
                    size="small"
                    fullWidth
                    placeholder={`${question.label || 'This field'} is not in a valid format.`}
                    value={question.patternMessage ?? ''}
                    onChange={(e) =>
                      updateQuestion(question.id, { patternMessage: e.target.value || undefined })
                    }
                  />
                )}
              </>
            )}
            {isDate && (
              <>
                <Divider />
                <Typography variant="caption" color="text.secondary">
                  Custom validation
                </Typography>
                <Stack direction="row" spacing={1}>
                  <TextField
                    label="Min age (years)"
                    size="small"
                    type="number"
                    value={question.minYears ?? ''}
                    onChange={(e) =>
                      updateQuestion(question.id, {
                        minYears: e.target.value === '' ? undefined : Number(e.target.value),
                      })
                    }
                  />
                  <TextField
                    label="Max age (years)"
                    size="small"
                    type="number"
                    value={question.maxYears ?? ''}
                    onChange={(e) =>
                      updateQuestion(question.id, {
                        maxYears: e.target.value === '' ? undefined : Number(e.target.value),
                      })
                    }
                  />
                </Stack>
                {(question.minYears !== undefined || question.maxYears !== undefined) && (
                  <TextField
                    label="Custom message when age is out of range (optional)"
                    size="small"
                    fullWidth
                    placeholder={`${question.label || 'This field'} does not meet the required age.`}
                    value={question.yearsMessage ?? ''}
                    onChange={(e) =>
                      updateQuestion(question.id, { yearsMessage: e.target.value || undefined })
                    }
                  />
                )}
              </>
            )}

            <Divider />
            <Typography variant="caption" color="text.secondary">
              Show this question only if:
            </Typography>
            <ConditionEditor
              value={question.visibilityRule ?? null}
              onChange={(group) => setVisibilityRule(question.id, group)}
              availableFields={availableFieldsFor(survey, question.id)}
            />

            {survey.scoring?.enabled && (
              <>
                <Divider />
                <ScoringEditor question={question} />
              </>
            )}
          </Stack>
        </Box>
      </Collapse>
    </Card>
  );
}
