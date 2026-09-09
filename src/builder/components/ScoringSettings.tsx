import { useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Button,
  Checkbox,
  FormControlLabel,
  IconButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { useBuilderStore } from '../store/builderStore';
import { newId } from '../../lib/id';

export function ScoringSettings() {
  const survey = useBuilderStore((s) => s.survey);
  const setScoringEnabled = useBuilderStore((s) => s.setScoringEnabled);
  const setPassThreshold = useBuilderStore((s) => s.setPassThreshold);
  const updateCategories = useBuilderStore((s) => s.setScoringCategories);
  const [newCategoryLabel, setNewCategoryLabel] = useState('');

  const categories = survey.scoring?.categories ?? [];

  return (
    <Accordion variant="outlined" defaultExpanded={!!survey.scoring?.enabled} sx={{ mt: 3, maxWidth: 640 }}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography variant="subtitle1">Scoring</Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Stack spacing={1.5} sx={{ maxWidth: 400 }}>
          <FormControlLabel
            control={
              <Checkbox
                checked={!!survey.scoring?.enabled}
                onChange={(e) => setScoringEnabled(e.target.checked)}
              />
            }
            label="Enable scoring for this survey"
          />

          {survey.scoring?.enabled && (
            <>
              <TextField
                label="Pass threshold (optional)"
                size="small"
                type="number"
                value={survey.scoring.passThreshold ?? ''}
                onChange={(e) =>
                  setPassThreshold(e.target.value === '' ? undefined : Number(e.target.value))
                }
              />

              <Typography variant="caption" color="text.secondary">
                Categories (optional sub-score groups)
              </Typography>
              {categories.map((c, i) => (
                <Stack direction="row" spacing={1} alignItems="center" key={c.id}>
                  <TextField
                    size="small"
                    fullWidth
                    value={c.label}
                    onChange={(e) => {
                      const next = [...categories];
                      next[i] = { ...c, label: e.target.value };
                      updateCategories(next);
                    }}
                  />
                  <IconButton
                    size="small"
                    onClick={() => updateCategories(categories.filter((_, idx) => idx !== i))}
                  >
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </Stack>
              ))}
              <Stack direction="row" spacing={1}>
                <TextField
                  size="small"
                  placeholder="New category name"
                  value={newCategoryLabel}
                  onChange={(e) => setNewCategoryLabel(e.target.value)}
                />
                <Button
                  size="small"
                  disabled={!newCategoryLabel.trim()}
                  onClick={() => {
                    updateCategories([...categories, { id: newId('cat'), label: newCategoryLabel.trim() }]);
                    setNewCategoryLabel('');
                  }}
                >
                  Add
                </Button>
              </Stack>
            </>
          )}
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
}
