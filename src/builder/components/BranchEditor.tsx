import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Chip,
  IconButton,
  MenuItem,
  Select,
  Stack,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { useBuilderStore } from '../store/builderStore';
import { ConditionEditor, type FieldOption } from './ConditionEditor';
import type { BranchRule, Survey } from '../../types/survey';
import { newId } from '../../lib/id';

// Fields a page's branch rules may reference: every question on this page and
// earlier pages, since a branch decision is made only after this page's
// answers (and everything before it) are known.
function availableFieldsForPage(survey: Survey, pageId: string): FieldOption[] {
  const pageIndex = survey.pages.findIndex((p) => p.id === pageId);
  if (pageIndex === -1) return [];
  const fields: FieldOption[] = [];
  for (let i = 0; i <= pageIndex; i++) {
    for (const q of survey.pages[i].questions) {
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

export function BranchEditor({ pageId }: { pageId: string }) {
  const survey = useBuilderStore((s) => s.survey);
  const setBranchRules = useBuilderStore((s) => s.setBranchRules);
  const setDefaultNextPage = useBuilderStore((s) => s.setDefaultNextPage);

  const page = survey.pages.find((p) => p.id === pageId);
  if (!page) return null;

  const otherPages = survey.pages.filter((p) => p.id !== pageId);
  const availableFields = availableFieldsForPage(survey, pageId);

  const updateRule = (index: number, patch: Partial<BranchRule>) => {
    const next = [...page.branch];
    next[index] = { ...next[index], ...patch };
    setBranchRules(pageId, next);
  };

  const addRule = () => {
    const rule: BranchRule = {
      id: newId('branch'),
      when: { logic: 'AND', conditions: [] },
      goToPageId: otherPages[0]?.id ?? 'end',
    };
    setBranchRules(pageId, [...page.branch, rule]);
  };

  const removeRule = (index: number) => {
    setBranchRules(pageId, page.branch.filter((_, i) => i !== index));
  };

  return (
    <Accordion variant="outlined" defaultExpanded={page.branch.length > 0} sx={{ mt: 3, maxWidth: 640 }}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="subtitle1">Branching</Typography>
          {page.branch.length > 0 && (
            <Chip size="small" label={`${page.branch.length} rule${page.branch.length === 1 ? '' : 's'}`} />
          )}
        </Stack>
      </AccordionSummary>
      <AccordionDetails>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
          Rules are evaluated top to bottom for this page; the first match wins.
        </Typography>
        <Stack spacing={2}>
          {page.branch.length === 0 && (
            <Typography variant="body2" color="text.secondary">
              No branch rules yet — everyone who fills out this page follows the "Otherwise" path below.
            </Typography>
          )}
          {page.branch.map((rule, i) => (
            <Box key={rule.id} sx={{ p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
              <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                <Typography variant="caption" color="text.secondary">
                  If:
                </Typography>
                <IconButton
                  size="small"
                  aria-label="Remove branch rule"
                  onClick={() => removeRule(i)}
                >
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </Stack>
              <ConditionEditor
                value={rule.when.conditions.length > 0 ? rule.when : { logic: 'AND', conditions: [] }}
                onChange={(group) => updateRule(i, { when: group ?? { logic: 'AND', conditions: [] } })}
                availableFields={availableFields}
              />
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  Go to
                </Typography>
                <Select
                  size="small"
                  value={rule.goToPageId}
                  onChange={(e) => updateRule(i, { goToPageId: e.target.value })}
                >
                  <MenuItem value="end">End of survey</MenuItem>
                  {otherPages.map((p) => (
                    <MenuItem key={p.id} value={p.id}>
                      {p.title}
                    </MenuItem>
                  ))}
                </Select>
              </Stack>
            </Box>
          ))}
          <Button size="small" onClick={addRule} sx={{ alignSelf: 'flex-start' }}>
            + Add branch rule
          </Button>

          <Stack direction="row" spacing={1} alignItems="center">
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
      </AccordionDetails>
    </Accordion>
  );
}
