import { useEffect, useState } from 'react';
import { Box, Button, MenuItem, Popover, Select, Stack, Typography } from '@mui/material';
import type { ConditionLeaf, ConditionOperator } from '../../../types/survey';
import { ValueInput, type FieldOption } from '../ConditionEditor';

const OPERATORS: { value: ConditionOperator; label: string; needsValue: boolean }[] = [
  { value: 'eq', label: 'is', needsValue: true },
  { value: 'neq', label: 'is not', needsValue: true },
  { value: 'contains', label: 'contains', needsValue: true },
  { value: 'gt', label: '>', needsValue: true },
  { value: 'gte', label: '≥', needsValue: true },
  { value: 'lt', label: '<', needsValue: true },
  { value: 'lte', label: '≤', needsValue: true },
  { value: 'isEmpty', label: 'is empty', needsValue: false },
  { value: 'isNotEmpty', label: 'is not empty', needsValue: false },
];

function defaultLeaf(fields: FieldOption[]): ConditionLeaf {
  const field = fields[0];
  return { fieldPath: field?.scope ?? '', operator: 'eq', value: field?.questionType === 'boolean' ? true : '' };
}

export interface RuleConditionPopoverProps {
  open: boolean;
  anchorEl: HTMLElement | null;
  fields: FieldOption[];
  // Present when editing an existing rule's condition; absent when defining
  // a brand-new branch (drag-to-connect).
  initialLeaf?: ConditionLeaf | null;
  destinationLabel: string;
  onClose: () => void;
  onSave: (leaf: ConditionLeaf) => void;
  onEditFullRule?: () => void;
}

// Single-condition editor: field + operator + value, matching the
// single-leaf shape the flow map's edge labels can actually summarize.
// Anything needing AND/OR or multiple conditions stays in the sidebar's full
// ConditionEditor, reachable here via "Edit full rule...".
export function RuleConditionPopover({
  open,
  anchorEl,
  fields,
  initialLeaf,
  destinationLabel,
  onClose,
  onSave,
  onEditFullRule,
}: RuleConditionPopoverProps) {
  const [leaf, setLeaf] = useState<ConditionLeaf>(initialLeaf ?? defaultLeaf(fields));

  useEffect(() => {
    if (open) setLeaf(initialLeaf ?? defaultLeaf(fields));
    // Re-seed only when the popover (re)opens for a (possibly new) target,
    // not on every keystroke inside it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, anchorEl, initialLeaf]);

  const field = fields.find((f) => f.scope === leaf.fieldPath);
  const opMeta = OPERATORS.find((o) => o.value === leaf.operator);

  const handleSave = () => {
    if (!leaf.fieldPath) return;
    onSave(leaf);
  };

  return (
    <Popover
      open={open}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      transformOrigin={{ vertical: 'top', horizontal: 'center' }}
    >
      <Box sx={{ p: 2, width: 320 }}>
        <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
          {initialLeaf ? 'Edit branch condition' : 'New branch'}
        </Typography>
        {fields.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            No earlier questions to branch on yet — add a question to this page or an earlier one first.
          </Typography>
        ) : (
          <Stack spacing={1.25} sx={{ mb: 2 }}>
            <Typography variant="caption" color="text.secondary">
              IF
            </Typography>
            <Select
              size="small"
              fullWidth
              value={leaf.fieldPath}
              onChange={(e) => {
                const newField = fields.find((f) => f.scope === e.target.value);
                setLeaf({
                  fieldPath: e.target.value,
                  operator: leaf.operator,
                  value: newField?.questionType === 'boolean' ? true : '',
                });
              }}
            >
              {fields.map((f) => (
                <MenuItem key={f.scope} value={f.scope}>
                  {f.label}
                </MenuItem>
              ))}
            </Select>
            <Stack direction="row" spacing={1}>
              <Select
                size="small"
                value={leaf.operator}
                onChange={(e) => setLeaf({ ...leaf, operator: e.target.value as ConditionOperator })}
                sx={{ flex: 1 }}
              >
                {OPERATORS.map((o) => (
                  <MenuItem key={o.value} value={o.value}>
                    {o.label}
                  </MenuItem>
                ))}
              </Select>
              {opMeta?.needsValue && (
                <Box sx={{ flex: 1 }}>
                  <ValueInput leaf={leaf} field={field} onChange={(v) => setLeaf({ ...leaf, value: v })} />
                </Box>
              )}
            </Stack>
            <Typography variant="caption" color="text.secondary">
              THEN jump to <strong>{destinationLabel}</strong>
            </Typography>
          </Stack>
        )}
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          {onEditFullRule ? (
            <Button size="small" onClick={onEditFullRule}>
              Edit full rule…
            </Button>
          ) : (
            <Box />
          )}
          <Stack direction="row" spacing={1}>
            <Button size="small" color="inherit" onClick={onClose}>
              Cancel
            </Button>
            <Button size="small" variant="contained" disabled={fields.length === 0} onClick={handleSave}>
              Save
            </Button>
          </Stack>
        </Stack>
      </Box>
    </Popover>
  );
}
