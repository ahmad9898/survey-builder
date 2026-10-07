import { useState } from 'react';
import { Box, Checkbox, Divider, FormControlLabel, Stack, Tab, Tabs, Typography } from '@mui/material';
import { useBuilderStore } from '../store/builderStore';
import { BranchEditor } from './BranchEditor';
import { ScoringSettings } from './ScoringSettings';
import { ScoringEditor, SCOREABLE_TYPES } from './ScoringEditor';

// The Branching/Scoring tab content for one page -- deliberately just the
// content, no outer column chrome (width/border), so both Builder's
// Inspector column and the flow map's page panel can mount this inside
// their own differently-sized wrapper without duplicating the tab logic.
export function InspectorTabs({ pageId }: { pageId: string }) {
  const [tab, setTab] = useState<'branching' | 'scoring'>('branching');
  const survey = useBuilderStore((s) => s.survey);
  const selectedQuestionId = useBuilderStore((s) => s.selectedQuestionId);
  const setPageBlocksSubmission = useBuilderStore((s) => s.setPageBlocksSubmission);

  const page = survey.pages.find((p) => p.id === pageId);
  const selectedQuestion = page?.questions.find((q) => q.id === selectedQuestionId);
  if (!page) return null;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        sx={{ borderBottom: '1px solid', borderColor: 'divider', minHeight: 44, px: 1, flexShrink: 0 }}
      >
        <Tab value="branching" label="Branching" sx={{ minHeight: 44, textTransform: 'none' }} />
        <Tab value="scoring" label="Scoring" sx={{ minHeight: 44, textTransform: 'none' }} />
      </Tabs>

      <Box sx={{ flex: 1, overflowY: 'auto', p: 2 }}>
        {tab === 'branching' ? (
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              Show or skip pages automatically based on how someone answers.
            </Typography>
            <FormControlLabel
              control={
                <Checkbox
                  checked={!!page.blocksSubmission}
                  onChange={(e) => setPageBlocksSubmission(page.id, e.target.checked)}
                />
              }
              label={
                <Typography variant="body2">
                  This page blocks submission
                  <Typography component="span" variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    e.g. a referral or disqualification notice
                  </Typography>
                </Typography>
              }
            />
            <Divider />
            <BranchEditor key={page.id} pageId={page.id} />
          </Stack>
        ) : (
          <Stack spacing={2}>
            <ScoringSettings />
            {selectedQuestion && survey.scoring?.enabled && SCOREABLE_TYPES.includes(selectedQuestion.type) && (
              <>
                <Divider />
                <Typography variant="subtitle2">Selected question</Typography>
                <ScoringEditor question={selectedQuestion} />
              </>
            )}
          </Stack>
        )}
      </Box>
    </Box>
  );
}
