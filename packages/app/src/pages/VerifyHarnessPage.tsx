import { useState } from 'react';
import { Box, Divider, Stack, Typography } from '@mui/material';
import { SurveyBuilder, renderAssessment } from 'survey-builder-kit';
import { competitorSwitchSurvey } from '../fixtures/sampleSurveys';
import { exportJson } from '../lib/fileIO';

// TEMPORARY verification harness -- NOT real integration.
//
// This page exists only to prove the survey-builder-kit JSON round-trip
// works: it mounts <SurveyBuilder>/<SurveyRunner> against a sample survey and
// downloads whatever JSON each callback hands back, so it can be inspected by
// hand. The real app wires these callbacks to surveyRepository/
// responseRepository (see BuilderPage.tsx/PlayerPage.tsx) instead of
// triggering a download -- this page (and its route in App.tsx) should be
// deleted once the library's contract is confirmed to be what's needed.
export function VerifyHarnessPage() {
  const [builderSurvey] = useState(() => competitorSwitchSurvey);
  const [runnerSurvey] = useState(() => competitorSwitchSurvey);

  return (
    <Stack sx={{ height: '100vh' }}>
      <Box sx={{ p: 1.5, bgcolor: 'warning.light' }}>
        <Typography variant="body2">
          Temporary verification harness -- onChange/onSave/onSubmit below download the resulting JSON instead of
          saving it anywhere real.
        </Typography>
      </Box>
      <Stack direction="row" sx={{ flex: 1, minHeight: 0 }}>
        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <Typography variant="overline" sx={{ p: 1 }}>
            SurveyBuilder
          </Typography>
          <Box sx={{ flex: 1, minHeight: 0 }}>
            <SurveyBuilder
              survey={builderSurvey}
              onChange={(survey) => exportJson(`builder-onChange-${Date.now()}.json`, survey)}
              onSave={(survey) => exportJson(`builder-onSave-${Date.now()}.json`, survey)}
            />
          </Box>
        </Box>
        <Divider orientation="vertical" flexItem />
        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <Typography variant="overline" sx={{ p: 1 }}>
            SurveyRunner
          </Typography>
          <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
            {renderAssessment({
              survey: runnerSurvey,
              onChange: (answers) => exportJson(`runner-onChange-${Date.now()}.json`, answers),
              onSubmit: (response) => exportJson(`runner-onSubmit-${Date.now()}.json`, response),
            })}
          </Box>
        </Box>
      </Stack>
    </Stack>
  );
}
