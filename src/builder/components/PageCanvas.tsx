import { Box, Chip, Stack, Typography } from '@mui/material';
import Button from '@mui/material/Button';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import { useBuilderStore } from '../store/builderStore';
import { isPageConditionalOnly } from '../../domain/flowLayout';
import { QuestionListEditor } from './QuestionListEditor';

export function PageCanvas() {
  const survey = useBuilderStore((s) => s.survey);
  const selectedPageId = useBuilderStore((s) => s.selectedPageId);
  const setViewMode = useBuilderStore((s) => s.setViewMode);
  const page = survey.pages.find((p) => p.id === selectedPageId);

  if (!page) return null;

  const conditional = isPageConditionalOnly(survey, page.id);

  return (
    <Box sx={{ width: '100%', maxWidth: 760, mx: 'auto', py: 3.5, px: { xs: 2, md: 0 } }}>
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2.5 }}>
        <Typography variant="h6" fontWeight={700} sx={{ minWidth: 0 }} noWrap>
          {page.title}
        </Typography>
        {conditional && (
          <Chip
            size="small"
            label="Conditional"
            sx={{ bgcolor: 'action.hover', color: 'text.secondary', fontWeight: 600 }}
          />
        )}
        <Box sx={{ flex: 1 }} />
        <Button
          size="small"
          startIcon={<AccountTreeOutlinedIcon sx={{ fontSize: 16 }} />}
          onClick={() => setViewMode('flow')}
          sx={{ color: 'primary.main' }}
        >
          View in flow map
        </Button>
      </Stack>
      {conditional && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2, mt: -1.5 }}>
          Shown only when a prior answer requires review.
        </Typography>
      )}

      <QuestionListEditor page={page} />
    </Box>
  );
}
