import {
  Box,
  Button,
  IconButton,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import type { ConditionGroup, ConditionLeaf, ConditionOperator, QuestionType } from '../../types/survey';
import { isConditionGroup } from '../../types/survey';

export interface FieldOption {
  scope: string;
  label: string;
  questionType: QuestionType;
  choices?: string[];
}

const OPERATORS: { value: ConditionOperator; label: string; needsValue: boolean }[] = [
  { value: 'eq', label: 'is', needsValue: true },
  { value: 'neq', label: 'is not', needsValue: true },
  { value: 'contains', label: 'contains', needsValue: true },
  { value: 'gt', label: '>', needsValue: true },
  { value: 'gte', label: '>=', needsValue: true },
  { value: 'lt', label: '<', needsValue: true },
  { value: 'lte', label: '<=', needsValue: true },
  { value: 'isEmpty', label: 'is empty', needsValue: false },
  { value: 'isNotEmpty', label: 'is not empty', needsValue: false },
];

interface ConditionEditorProps {
  value: ConditionGroup | null;
  onChange: (group: ConditionGroup | null) => void;
  availableFields: FieldOption[];
  emptyLabel?: string;
}

function emptyLeaf(availableFields: FieldOption[]): ConditionLeaf {
  const field = availableFields[0];
  return {
    fieldPath: field?.scope ?? '',
    operator: 'eq',
    value: field?.questionType === 'boolean' ? true : '',
  };
}

// Renders the right value input for the referenced field's type, so a
// comparison actually matches the value type stored in answers (a boolean
// field must compare against a real boolean, not the string "true").
export function ValueInput({
  leaf,
  field,
  onChange,
}: {
  leaf: ConditionLeaf;
  field: FieldOption | undefined;
  onChange: (value: unknown) => void;
}) {
  if (!field) {
    return (
      <TextField
        size="small"
        value={leaf.value === undefined ? '' : String(leaf.value)}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  if (field.questionType === 'boolean') {
    return (
      <Select size="small" value={leaf.value === true ? 'true' : 'false'} onChange={(e) => onChange(e.target.value === 'true')}>
        <MenuItem value="true">Yes</MenuItem>
        <MenuItem value="false">No</MenuItem>
      </Select>
    );
  }

  if (
    (field.questionType === 'singleChoice' || field.questionType === 'multipleChoice') &&
    field.choices
  ) {
    return (
      <Select
        size="small"
        value={typeof leaf.value === 'string' ? leaf.value : ''}
        onChange={(e) => onChange(e.target.value)}
      >
        {field.choices.map((choice) => (
          <MenuItem key={choice} value={choice}>
            {choice}
          </MenuItem>
        ))}
      </Select>
    );
  }

  if (field.questionType === 'number' || field.questionType === 'rating' || field.questionType === 'nps') {
    return (
      <TextField
        size="small"
        type="number"
        value={typeof leaf.value === 'number' ? leaf.value : ''}
        onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
      />
    );
  }

  return (
    <TextField
      size="small"
      value={leaf.value === undefined ? '' : String(leaf.value)}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function ConditionEditor({ value, onChange, availableFields, emptyLabel }: ConditionEditorProps) {
  const enabled = value !== null;

  const leaves = (value?.conditions ?? []).filter(
    (c): c is ConditionLeaf => !isConditionGroup(c),
  );

  const setLeaves = (next: ConditionLeaf[]) => {
    if (next.length === 0) {
      onChange(null);
      return;
    }
    onChange({ logic: value?.logic ?? 'AND', conditions: next });
  };

  if (availableFields.length === 0) {
    return (
      <Typography variant="caption" color="text.secondary">
        No earlier questions to reference yet.
      </Typography>
    );
  }

  if (!enabled) {
    return (
      <Button
        size="small"
        onClick={() => onChange({ logic: 'AND', conditions: [emptyLeaf(availableFields)] })}
      >
        {emptyLabel ?? '+ Add condition'}
      </Button>
    );
  }

  return (
    <Stack spacing={1}>
      <Stack direction="row" spacing={1} alignItems="center">
        <Typography variant="caption" color="text.secondary">
          Match
        </Typography>
        <Select
          size="small"
          value={value.logic}
          onChange={(e) => onChange({ ...value, logic: e.target.value as 'AND' | 'OR' })}
        >
          <MenuItem value="AND">ALL of</MenuItem>
          <MenuItem value="OR">ANY of</MenuItem>
        </Select>
      </Stack>

      {leaves.map((leaf, i) => {
        const opMeta = OPERATORS.find((o) => o.value === leaf.operator);
        const field = availableFields.find((f) => f.scope === leaf.fieldPath);
        return (
          <Stack direction="row" spacing={1} alignItems="center" key={i}>
            <Select
              size="small"
              value={leaf.fieldPath}
              sx={{ minWidth: 120 }}
              onChange={(e) => {
                const newField = availableFields.find((f) => f.scope === e.target.value);
                const next = [...leaves];
                next[i] = {
                  ...leaf,
                  fieldPath: e.target.value,
                  value: newField?.questionType === 'boolean' ? true : '',
                };
                setLeaves(next);
              }}
            >
              {availableFields.map((f) => (
                <MenuItem key={f.scope} value={f.scope}>
                  {f.label}
                </MenuItem>
              ))}
            </Select>
            <Select
              size="small"
              value={leaf.operator}
              onChange={(e) => {
                const next = [...leaves];
                next[i] = { ...leaf, operator: e.target.value as ConditionOperator };
                setLeaves(next);
              }}
            >
              {OPERATORS.map((o) => (
                <MenuItem key={o.value} value={o.value}>
                  {o.label}
                </MenuItem>
              ))}
            </Select>
            {opMeta?.needsValue && (
              <ValueInput
                leaf={leaf}
                field={field}
                onChange={(v) => {
                  const next = [...leaves];
                  next[i] = { ...leaf, value: v };
                  setLeaves(next);
                }}
              />
            )}
            <IconButton
              size="small"
              onClick={() => setLeaves(leaves.filter((_, idx) => idx !== i))}
            >
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </Stack>
        );
      })}

      <Box>
        <Button size="small" onClick={() => setLeaves([...leaves, emptyLeaf(availableFields)])}>
          + Add condition
        </Button>
        <Button size="small" color="inherit" onClick={() => onChange(null)}>
          Remove all
        </Button>
      </Box>
    </Stack>
  );
}
