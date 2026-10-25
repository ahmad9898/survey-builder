import { useState } from 'react';
import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Box,
  Chip,
  IconButton,
  MenuItem,
  Select,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import Button from '@mui/material/Button';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import { useBuilderStore } from '../store/builderStore';
import { ConditionEditor, type FieldOption } from './ConditionEditor';
import { isConditionGroup, type BranchRule, type ConditionGroup, type Survey } from '../../types/survey';
import { newId } from '../../lib/id';
import { availableFieldsForPage } from '../conditionFields';

const OPERATOR_TEXT: Record<string, string> = {
  eq: '=',
  neq: '≠',
  contains: 'contains',
  gt: '>',
  gte: '≥',
  lt: '<',
  lte: '≤',
  isEmpty: 'is empty',
  isNotEmpty: 'is not empty',
};

// Plain-language summary of a rule's condition for the collapsed rule-card
// view, e.g. "Heart attack in the last 12 months = Yes".
function describeCondition(group: ConditionGroup, fields: FieldOption[]): string {
  const parts = group.conditions.map((c) => {
    if (isConditionGroup(c)) return describeCondition(c, fields);
    const field = fields.find((f) => f.scope === c.fieldPath);
    const label = field?.label ?? 'Answer';
    if (c.operator === 'isEmpty' || c.operator === 'isNotEmpty') {
      return `${label} ${OPERATOR_TEXT[c.operator]}`;
    }
    const value = field?.questionType === 'boolean' ? (c.value === true ? 'Yes' : 'No') : String(c.value ?? '');
    return `${label} ${OPERATOR_TEXT[c.operator] ?? c.operator} ${value}`;
  });
  return parts.join(group.logic === 'AND' ? ' and ' : ' or ') || 'Always';
}

function RuleCard({
  rule,
  order,
  reorderable,
  otherPages,
  availableFields,
  onChange,
  onDelete,
}: {
  rule: BranchRule;
  // This rule's 1-based position in evaluation order -- shown and draggable
  // only once there's more than one conditioned rule to order (see
  // BranchEditor below), since a lone rule has nothing to be ordered
  // against.
  order: number;
  reorderable: boolean;
  otherPages: Survey['pages'];
  availableFields: FieldOption[];
  onChange: (patch: Partial<BranchRule>) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(rule.when.conditions.length === 0);
  const isBlock = rule.action === 'block';
  const destinationLabel =
    rule.goToPageId === 'end' ? 'End of survey' : otherPages.find((p) => p.id === rule.goToPageId)?.title ?? 'Unknown page';

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: rule.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <Box
      ref={setNodeRef}
      style={style}
      sx={{
        p: 1.5,
        borderRadius: 1.5,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        '&:hover .rule-actions, &:focus-within .rule-actions': { opacity: 1 },
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
        {reorderable && (
          <Stack alignItems="center" spacing={0.25} sx={{ flexShrink: 0, pt: 0.25 }}>
            <Tooltip title="Drag to reorder -- rules are evaluated top to bottom, first match wins">
              <IconButton size="small" {...listeners} {...attributes} sx={{ cursor: 'grab' }}>
                <DragIndicatorIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Typography variant="caption" color="text.disabled" fontWeight={700}>
              {order}
            </Typography>
          </Stack>
        )}
        <Stack spacing={0.75} sx={{ minWidth: 0, flex: 1 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Chip size="small" label="IF" sx={{ bgcolor: 'action.hover', fontWeight: 700, fontSize: 11 }} />
            <Typography variant="body2" sx={{ minWidth: 0 }} noWrap title={describeCondition(rule.when, availableFields)}>
              {describeCondition(rule.when, availableFields)}
            </Typography>
          </Stack>
          <ArrowDownwardIcon sx={{ fontSize: 14, color: 'text.disabled', ml: '3px' }} />
          <Stack direction="row" spacing={1} alignItems="center">
            <Chip
              size="small"
              label="THEN"
              sx={
                isBlock
                  ? { bgcolor: 'error.light', color: 'error.dark', fontWeight: 700, fontSize: 11 }
                  : { bgcolor: 'primary.light', color: 'primary.dark', fontWeight: 700, fontSize: 11 }
              }
            />
            <Typography variant="body2" color={isBlock ? 'error.dark' : 'primary.dark'} fontWeight={600} noWrap>
              {isBlock ? 'Block submission' : `Jump to ${destinationLabel}`}
            </Typography>
          </Stack>
        </Stack>
        <Stack direction="row" className="rule-actions" sx={{ opacity: 0, transition: 'opacity 0.15s', flexShrink: 0 }}>
          <Tooltip title={editing ? 'Done editing' : 'Edit rule'}>
            <IconButton size="small" aria-label="Edit rule" onClick={() => setEditing((v) => !v)}>
              <EditOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete rule">
            <IconButton size="small" aria-label="Delete rule" onClick={onDelete}>
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>

      {editing && (
        <Stack spacing={1.5} sx={{ mt: 1.5, pt: 1.5, borderTop: '1px dashed', borderColor: 'divider' }}>
          <ConditionEditor
            value={rule.when.conditions.length > 0 ? rule.when : { logic: 'AND', conditions: [] }}
            onChange={(group) => onChange({ when: group ?? { logic: 'AND', conditions: [] } })}
            availableFields={availableFields}
          />
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="caption" color="text.secondary">
              Then
            </Typography>
            <ToggleButtonGroup
              size="small"
              exclusive
              value={isBlock ? 'block' : 'goToPage'}
              onChange={(_, next) => {
                if (!next) return;
                if (next === 'block') onChange({ action: 'block', goToPageId: 'end' });
                else onChange({ action: 'goToPage', goToPageId: otherPages[0]?.id ?? 'end' });
              }}
            >
              <ToggleButton value="goToPage" sx={{ fontSize: 12.5, py: 0.25 }}>
                Go to page
              </ToggleButton>
              <ToggleButton value="block" sx={{ fontSize: 12.5, py: 0.25 }}>
                Block submission
              </ToggleButton>
            </ToggleButtonGroup>
          </Stack>
          {isBlock ? (
            <Typography variant="caption" color="text.secondary">
              Disables Continue/Submit on this page while this condition matches -- the respondent stays here
              (no navigation) until it no longer does.
            </Typography>
          ) : (
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="caption" color="text.secondary">
                Go to
              </Typography>
              <Select size="small" value={rule.goToPageId} onChange={(e) => onChange({ goToPageId: e.target.value })}>
                <MenuItem value="end">End of survey</MenuItem>
                {otherPages.map((p) => (
                  <MenuItem key={p.id} value={p.id}>
                    {p.title}
                  </MenuItem>
                ))}
              </Select>
            </Stack>
          )}
        </Stack>
      )}
    </Box>
  );
}

export function BranchEditor({ pageId }: { pageId: string }) {
  const survey = useBuilderStore((s) => s.survey);
  const addBranchRule = useBuilderStore((s) => s.addBranchRule);
  const updateBranchRule = useBuilderStore((s) => s.updateBranchRule);
  const removeBranchRule = useBuilderStore((s) => s.removeBranchRule);
  const reorderBranchRule = useBuilderStore((s) => s.reorderBranchRule);
  const setDefaultNextPage = useBuilderStore((s) => s.setDefaultNextPage);

  const page = survey.pages.find((p) => p.id === pageId);
  if (!page) return null;

  const otherPages = survey.pages.filter((p) => p.id !== pageId);
  const availableFields = availableFieldsForPage(survey, pageId);
  // Order only matters -- and is only something to show or drag -- once
  // there's more than one conditioned rule to disambiguate between.
  const reorderable = page.branch.length > 1;

  // A distance threshold lets a plain click on the edit/delete buttons pass
  // through untouched; only pointer movement past 8px starts a drag.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const fromIndex = page.branch.findIndex((r) => r.id === active.id);
    const toIndex = page.branch.findIndex((r) => r.id === over.id);
    if (fromIndex !== -1 && toIndex !== -1) reorderBranchRule(pageId, fromIndex, toIndex);
  };

  const addRule = () => {
    addBranchRule(pageId, {
      id: newId('branch'),
      when: { logic: 'AND', conditions: [] },
      goToPageId: otherPages[0]?.id ?? 'end',
    });
  };

  return (
    <Stack spacing={1.5}>
      <Typography variant="caption" color="text.secondary">
        Rules are evaluated top to bottom; the first match wins.
        {reorderable && ' Drag to reorder.'}
      </Typography>

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <SortableContext items={page.branch.map((r) => r.id)} strategy={verticalListSortingStrategy}>
          <Stack spacing={1.5}>
            {page.branch.map((rule, i) => (
              <RuleCard
                key={rule.id}
                rule={rule}
                order={i + 1}
                reorderable={reorderable}
                otherPages={otherPages}
                availableFields={availableFields}
                onChange={(patch) => updateBranchRule(pageId, rule.id, patch)}
                onDelete={() => removeBranchRule(pageId, rule.id)}
              />
            ))}
          </Stack>
        </SortableContext>
      </DndContext>

      <Button
        onClick={addRule}
        sx={{
          border: '1px dashed',
          borderColor: 'divider',
          color: 'text.secondary',
          justifyContent: 'flex-start',
          py: 1,
        }}
      >
        + Add rule
      </Button>

      <Stack direction="row" spacing={1} alignItems="center" sx={{ pt: 1 }}>
        <Typography variant="caption" color="text.secondary">
          Otherwise, go to
        </Typography>
        <Select
          size="small"
          value={page.defaultNextPageId}
          onChange={(e) => setDefaultNextPage(pageId, e.target.value)}
        >
          <MenuItem value="end">End of survey</MenuItem>
          {otherPages.map((p) => (
            <MenuItem key={p.id} value={p.id}>
              {p.title}
            </MenuItem>
          ))}
        </Select>
      </Stack>
    </Stack>
  );
}
