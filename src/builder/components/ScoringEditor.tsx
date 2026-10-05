import { Box, MenuItem, Select, Stack, TextField, Typography } from '@mui/material';
import type { QuestionDef, ScoringEntry } from '../../types/survey';
import { useBuilderStore } from '../store/builderStore';

interface ScoringEditorProps {
  question: QuestionDef;
}

export const SCOREABLE_TYPES = ['singleChoice', 'multipleChoice', 'rating', 'nps', 'number', 'boolean'];

export function ScoringEditor({ question }: ScoringEditorProps) {
  const survey = useBuilderStore((s) => s.survey);
  const setScoringForQuestion = useBuilderStore((s) => s.setScoringForQuestion);

  if (!survey.scoring?.enabled) return null;
  if (!SCOREABLE_TYPES.includes(question.type)) return null;

  const scope = `#/properties/${question.id}`;
  const entry: ScoringEntry = survey.scoringMap?.[scope] ?? {};
  const categories = survey.scoring.categories ?? [];

  const update = (patch: Partial<ScoringEntry>) => {
    setScoringForQuestion(question.id, { ...entry, ...patch });
  };

  return (
    <Box>
      <Typography variant="caption" color="text.secondary">
        Scoring
      </Typography>
      <Stack spacing={1} sx={{ mt: 0.5 }}>
        {categories.length > 0 && (
          <Select
            size="small"
            value={entry.categoryId ?? ''}
            displayEmpty
            onChange={(e) => update({ categoryId: e.target.value || undefined })}
          >
            <MenuItem value="">No category</MenuItem>
            {categories.map((c) => (
              <MenuItem key={c.id} value={c.id}>
                {c.label}
              </MenuItem>
            ))}
          </Select>
        )}

        {(question.type === 'singleChoice' || question.type === 'multipleChoice') &&
          (question.choices ?? []).map((choice) => (
            <Stack direction="row" spacing={1} alignItems="center" key={choice}>
              <Typography variant="body2" sx={{ flex: 1 }}>
                {choice}
              </Typography>
              <TextField
                size="small"
                type="number"
                sx={{ width: 90 }}
                value={entry.optionScores?.[choice] ?? 0}
                onChange={(e) =>
                  update({
                    optionScores: { ...entry.optionScores, [choice]: Number(e.target.value) },
                  })
                }
              />
            </Stack>
          ))}

        {(question.type === 'rating' || question.type === 'nps' || question.type === 'number') && (
          <Stack direction="row" spacing={1}>
            <TextField
              label="Points at min"
              size="small"
              type="number"
              value={entry.linearScore?.minPoints ?? 0}
              onChange={(e) =>
                update({
                  linearScore: {
                    min: entry.linearScore?.min ?? question.min ?? 0,
                    max: entry.linearScore?.max ?? question.max ?? 10,
                    minPoints: Number(e.target.value),
                    maxPoints: entry.linearScore?.maxPoints ?? 0,
                  },
                })
              }
            />
            <TextField
              label="Points at max"
              size="small"
              type="number"
              value={entry.linearScore?.maxPoints ?? 0}
              onChange={(e) =>
                update({
                  linearScore: {
                    min: entry.linearScore?.min ?? question.min ?? 0,
                    max: entry.linearScore?.max ?? question.max ?? 10,
                    minPoints: entry.linearScore?.minPoints ?? 0,
                    maxPoints: Number(e.target.value),
                  },
                })
              }
            />
          </Stack>
        )}

        {question.type === 'boolean' && (
          <TextField
            label="Points if Yes"
            size="small"
            type="number"
            value={entry.valueScore ?? 0}
            onChange={(e) => update({ valueScore: Number(e.target.value) })}
          />
        )}
      </Stack>
    </Box>
  );
}
