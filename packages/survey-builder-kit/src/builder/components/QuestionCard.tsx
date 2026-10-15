import { useEffect, useRef } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Box,
  Card,
  Checkbox,
  Chip,
  Collapse,
  Divider,
  FormControlLabel,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import Button from '@mui/material/Button';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import type { DisqualifyingNotice, QuestionDef, Survey } from '../../types/survey';
import { questionTypeMeta } from '../questionTypes';
import { QUESTION_TYPE_ICONS } from '../questionTypeIcons';
import { useBuilderStore } from '../store/builderStore';
import { ConditionEditor, type FieldOption } from './ConditionEditor';
import { ScoringEditor } from './ScoringEditor';

function ChoiceListEditor({
  questionId,
  choices,
  disqualifyingOptions,
}: {
  questionId: string;
  choices: string[];
  disqualifyingOptions?: Record<string, DisqualifyingNotice>;
}) {
  const updateQuestion = useBuilderStore((s) => s.updateQuestion);
  const theme = useTheme();
  const tokens = theme.custom.warningBanner;
  const dq = disqualifyingOptions ?? {};

  const setChoice = (index: number, value: string) => {
    const oldValue = choices[index];
    const next = [...choices];
    next[index] = value;
    const patch: Partial<QuestionDef> = { choices: next };
    // A disqualifying flag is keyed by the option's own text -- renaming the
    // option must carry the flag (and its notice) along with it, not
    // orphan it under text that no longer exists.
    if (oldValue !== value && oldValue in dq) {
      const nextDq = { ...dq };
      nextDq[value] = nextDq[oldValue];
      delete nextDq[oldValue];
      patch.disqualifyingOptions = nextDq;
    }
    updateQuestion(questionId, patch);
  };
  const removeChoice = (index: number) => {
    if (choices.length <= 1) return;
    const removed = choices[index];
    const patch: Partial<QuestionDef> = { choices: choices.filter((_, i) => i !== index) };
    if (removed in dq) {
      const nextDq = { ...dq };
      delete nextDq[removed];
      patch.disqualifyingOptions = nextDq;
    }
    updateQuestion(questionId, patch);
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
  const toggleDisqualifying = (choice: string) => {
    const nextDq = { ...dq };
    if (choice in nextDq) delete nextDq[choice];
    else nextDq[choice] = { title: '', body: '' };
    updateQuestion(questionId, { disqualifyingOptions: nextDq });
  };
  const setDisqualifyNotice = (choice: string, notice: DisqualifyingNotice) => {
    updateQuestion(questionId, { disqualifyingOptions: { ...dq, [choice]: notice } });
  };

  return (
    <Stack spacing={1}>
      <Typography variant="caption" color="text.secondary">
        Options
      </Typography>
      {choices.map((choice, i) => {
        const isDisqualifying = choice in dq;
        const rawNotice = dq[choice];
        // Defensive: disqualifyingOptions used to be `Record<string, string>`
        // before it grew a title/body shape. normalizeSurvey() repairs this
        // on mount, but a crash here (`.title` on a bare string) is bad
        // enough -- a blank Builder page -- that it's worth guarding again
        // at the point of use rather than trusting every caller upstream.
        const notice = typeof rawNotice === 'string' ? { title: rawNotice } : (rawNotice ?? { title: '', body: '' });
        const titleMissing = isDisqualifying && (notice.title ?? '').trim() === '';
        return (
          <Box key={i}>
            <Stack direction="row" spacing={0.5} alignItems="center">
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
              {isDisqualifying && (
                <Chip
                  size="small"
                  label="Disqualifying"
                  sx={{ bgcolor: tokens.iconBg, color: tokens.textStrong, fontWeight: 600, flexShrink: 0 }}
                />
              )}
              <Tooltip title={isDisqualifying ? 'Remove disqualifying flag' : 'Mark this option as disqualifying'}>
                <IconButton
                  size="small"
                  onClick={() => toggleDisqualifying(choice)}
                  aria-label={isDisqualifying ? `Remove disqualifying flag from "${choice}"` : `Mark "${choice}" as disqualifying`}
                  sx={{ color: isDisqualifying ? tokens.icon : 'action.active' }}
                >
                  <WarningAmberIcon fontSize="small" />
                </IconButton>
              </Tooltip>
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
            <Collapse in={isDisqualifying} unmountOnExit>
              <Stack
                spacing={1}
                sx={{
                  ml: 4.5,
                  mt: 0.5,
                  p: 1,
                  borderRadius: 1,
                  bgcolor: tokens.bg,
                  border: '1px solid',
                  borderColor: tokens.border,
                }}
              >
                <TextField
                  size="small"
                  fullWidth
                  required
                  label="Title shown if selected"
                  placeholder="e.g. Medical Review Required"
                  value={notice.title}
                  error={titleMissing}
                  helperText={
                    titleMissing
                      ? 'Required -- a blank disqualification notice is not allowed.'
                      : 'Short heading -- shown in bold, above the body text.'
                  }
                  onChange={(e) => setDisqualifyNotice(choice, { ...notice, title: e.target.value })}
                />
                <TextField
                  size="small"
                  fullWidth
                  multiline
                  label="Body text (optional)"
                  placeholder="e.g. This disqualifies you from the online assessment. Please see a GP in person."
                  value={notice.body ?? ''}
                  helperText="Longer detail -- shown below the title."
                  onChange={(e) => setDisqualifyNotice(choice, { ...notice, body: e.target.value })}
                />
              </Stack>
            </Collapse>
          </Box>
        );
      })}
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

// A Label question has no answer field, so its "content" is what it displays,
// not a form control to fill in. Rendered inline (not gated behind the
// settings Collapse) so the canvas reads as a preview of the live survey,
// matching the warning-banner treatment for a page that blocks submission.
function LabelPreview({ question, isBlockingPage }: { question: QuestionDef; isBlockingPage: boolean }) {
  const theme = useTheme();

  if (isBlockingPage) {
    const tokens = theme.custom.warningBanner;
    return (
      <Box
        sx={{
          mx: 1.5,
          mb: 1.5,
          p: 1.5,
          borderRadius: 1.5,
          bgcolor: tokens.bg,
          border: '1px solid',
          borderColor: tokens.border,
          display: 'flex',
          gap: 1.25,
        }}
      >
        <Box
          sx={{
            flexShrink: 0,
            width: 28,
            height: 28,
            borderRadius: 1,
            bgcolor: tokens.iconBg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <WarningAmberIcon sx={{ fontSize: 18, color: tokens.icon }} />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle2" sx={{ color: tokens.textStrong, fontWeight: 700 }}>
            {question.label || '(untitled)'}
          </Typography>
          {question.description && (
            <Typography variant="body2" sx={{ color: tokens.text, mt: 0.25 }}>
              {question.description}
            </Typography>
          )}
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ mx: 1.5, mb: 1.5 }}>
      <Typography variant="subtitle1" fontWeight={700}>
        {question.label || '(untitled)'}
      </Typography>
      {question.description && (
        <Typography variant="body2" color="text.secondary">
          {question.description}
        </Typography>
      )}
    </Box>
  );
}

export function QuestionCard({
  question,
  isBlockingPage = false,
}: {
  question: QuestionDef;
  isBlockingPage?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: question.id,
    data: { source: 'canvas-item' },
  });
  const selectedQuestionId = useBuilderStore((s) => s.selectedQuestionId);
  const selectQuestion = useBuilderStore((s) => s.selectQuestion);
  const duplicateQuestion = useBuilderStore((s) => s.duplicateQuestion);
  const removeQuestion = useBuilderStore((s) => s.removeQuestion);
  const updateQuestion = useBuilderStore((s) => s.updateQuestion);
  const finalizeQuestionId = useBuilderStore((s) => s.finalizeQuestionId);
  const setVisibilityRule = useBuilderStore((s) => s.setVisibilityRule);
  const survey = useBuilderStore((s) => s.survey);
  const warningTokens = useTheme().custom.warningBanner;

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
  const hasDisqualifyingOption = Object.keys(question.disqualifyingOptions ?? {}).length > 0;

  const cardRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (expanded) cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [expanded]);
  const setRefs = (node: HTMLDivElement | null) => {
    setNodeRef(node);
    cardRef.current = node;
  };

  const TypeIcon = QUESTION_TYPE_ICONS[question.type];

  return (
    <Card
      ref={setRefs}
      style={style}
      variant="outlined"
      sx={{
        borderColor: expanded ? 'primary.main' : 'divider',
        borderWidth: expanded ? 2 : 1,
        '&:hover .q-actions, &:focus-within .q-actions': { opacity: 1 },
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1} sx={{ pr: 1 }}>
        <Tooltip title="Drag to reorder">
          <IconButton size="small" {...listeners} {...attributes} sx={{ cursor: 'grab' }}>
            <DragIndicatorIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Chip
          size="small"
          icon={<TypeIcon sx={{ fontSize: 15 }} />}
          label={meta.paletteLabel}
          sx={{ bgcolor: 'action.hover', color: 'text.secondary', flexShrink: 0 }}
        />
        {hasDisqualifyingOption && (
          <Tooltip title="At least one option here is flagged disqualifying">
            <Chip
              size="small"
              icon={<WarningAmberIcon sx={{ fontSize: 14 }} />}
              label="Disqualifying"
              sx={{ bgcolor: warningTokens.iconBg, color: warningTokens.textStrong, fontWeight: 600, flexShrink: 0 }}
            />
          </Tooltip>
        )}
        <Box onClick={toggleExpanded} sx={{ flex: 1, cursor: 'pointer', py: 1.5, minWidth: 0 }}>
          <Typography variant="body2" fontWeight={600} noWrap>
            {question.label || '(untitled question)'}
          </Typography>
          {(question.required || question.visibilityRule || question.hasTrigger) && (
            <Typography variant="caption" color="text.secondary">
              {[question.required && 'Required', question.visibilityRule && 'Conditional', question.hasTrigger && 'Trigger']
                .filter(Boolean)
                .join(' · ')}
            </Typography>
          )}
        </Box>
        <Stack direction="row" className="q-actions" sx={{ opacity: 0, transition: 'opacity 0.15s' }}>
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
        </Stack>
        <IconButton
          size="small"
          onClick={toggleExpanded}
          aria-label={expanded ? 'Collapse question' : 'Expand question'}
          sx={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}
        >
          <ExpandMoreIcon fontSize="small" />
        </IconButton>
      </Stack>

      {isLabel && (
        <>
          <LabelPreview question={question} isBlockingPage={isBlockingPage} />
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mx: 1.5, mb: 1.5 }}>
            Informational label · no response required
          </Typography>
        </>
      )}

      <Collapse in={expanded} unmountOnExit>
        <Box sx={{ px: 2, pb: 2, pt: 0.5 }}>
          <Divider sx={{ mb: 2 }} />
          <Stack spacing={2}>
            <TextField
              label="Title"
              size="small"
              fullWidth
              value={question.title}
              onChange={(e) => updateQuestion(question.id, { title: e.target.value })}
              helperText="Internal name for this question, used to generate its slug below. Never shown to respondents -- always editable."
              // Only takes effect for a just-created question still waiting
              // on its first title (finalizeQuestionId no-ops otherwise) --
              // slugifies this title into the question's id, once, so the
              // author never has to think about ids at all. After that,
              // further edits here only ever change the title text.
              onBlur={() => finalizeQuestionId(question.id)}
            />
            <TextField
              label="Slug (question ID)"
              size="small"
              fullWidth
              disabled
              value={question.slug}
              helperText="Generated from the title above when this question was first created -- can't be changed afterward."
              slotProps={{ htmlInput: { sx: { fontFamily: 'monospace' } } }}
            />
            <TextField
              label={isLabel ? 'Heading' : 'Label'}
              size="small"
              fullWidth
              value={question.label}
              onChange={(e) => updateQuestion(question.id, { label: e.target.value })}
              helperText={isLabel ? undefined : 'Shown to the respondent as the question text.'}
            />
            <TextField
              label={isLabel ? 'Body text (optional)' : 'Description (optional)'}
              size="small"
              fullWidth
              multiline
              value={question.description ?? ''}
              onChange={(e) => updateQuestion(question.id, { description: e.target.value })}
            />
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
            {!isLabel && (
              <FormControlLabel
                control={
                  <Checkbox
                    checked={!!question.hasTrigger}
                    onChange={(e) => updateQuestion(question.id, { hasTrigger: e.target.checked })}
                  />
                }
                label={
                  <Typography variant="body2">
                    Trigger immediate callback
                    <Typography component="span" variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      Reports this answer to the host right away, not just when the respondent moves to the next page
                    </Typography>
                  </Typography>
                }
              />
            )}
            {hasChoices && (
              <ChoiceListEditor
                questionId={question.id}
                choices={question.choices ?? []}
                disqualifyingOptions={question.disqualifyingOptions}
              />
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
