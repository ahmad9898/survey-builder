import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Checkbox,
  FormControlLabel,
  Link,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { renderAssessment } from 'survey-builder-kit';
import { sampleSurveys } from '../fixtures/sampleSurveys';

// Demonstrates the render*To props: a host-built page shell with its OWN
// navbar/sidebar/content layout, and the runner's progress bar, step
// counter, Exit link, and quiz body each portaled into a specific slot in
// that shell instead of the runner's own built-in header. Toggling the two
// checkboxes below demonstrates the `null` ("hide this piece entirely")
// case live, on the same page -- see packages/survey-builder-kit's README,
// "render*To props" section, for the full semantics.
export function CustomChromePlayerPage() {
  const [survey] = useState(() => sampleSurveys[0]);
  const [hideSteps, setHideSteps] = useState(false);
  const [hideExit, setHideExit] = useState(false);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'grey.100' }}>
      {/* Host's own top navbar -- NOT part of survey-builder-kit. The Exit
          link renders into #custom-exit-slot on the right. */}
      <Box
        sx={{
          height: 56,
          px: 3,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          bgcolor: 'common.white',
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1}>
          <Typography sx={{ fontWeight: 700 }}>Acme Health Portal</Typography>
          <Typography variant="caption" color="text.secondary">
            (host chrome -- not part of survey-builder-kit)
          </Typography>
        </Stack>
        <Box id="custom-exit-slot" />
      </Box>

      {/* The runner's own progress bar, full-width, directly under the host's
          navbar instead of pinned to the runner's own top edge. */}
      <Box id="custom-progress-slot" />

      <Stack direction="row" spacing={3} sx={{ p: 3, alignItems: 'flex-start' }}>
        <Paper sx={{ width: 260, p: 2, flexShrink: 0 }}>
          <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
            Your progress
          </Typography>
          {/* The runner's own "X of N" step counter + dots, in a sidebar
              instead of the built-in header. */}
          <Box id="custom-steps-slot" sx={{ mb: 2 }} />

          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Demo controls
          </Typography>
          <FormControlLabel
            control={<Checkbox checked={hideSteps} onChange={(e) => setHideSteps(e.target.checked)} size="small" />}
            label={<Typography variant="body2">Hide step counter (renderStepsTo=null)</Typography>}
          />
          <FormControlLabel
            control={<Checkbox checked={hideExit} onChange={(e) => setHideExit(e.target.checked)} size="small" />}
            label={<Typography variant="body2">Hide Exit link (renderExitTo=null)</Typography>}
          />
          <Typography variant="body2" sx={{ mt: 2 }}>
            <Link component={RouterLink} to="/">
              Back home
            </Link>
          </Typography>
        </Paper>

        <Paper sx={{ flex: 1, minHeight: 500, p: 0, overflow: 'hidden' }}>
          {/* The runner's own quiz body -- whichever question stage, or the
              review screen, is currently showing -- portaled into this card
              instead of the runner's own built-in body area. */}
          <Box id="custom-assessment-slot" sx={{ minHeight: 500 }} />
        </Paper>
      </Stack>

      {/* <SurveyRunner> has no built-in header bar any more -- there's
          nothing left for its own root element to render in place once
          every piece below is portaled into one of the slots above, so
          where this call sits in the JSX doesn't matter. */}
      {renderAssessment({
        survey,
        exitPath: '/',
        renderProgressBarTo: '#custom-progress-slot',
        renderStepsTo: hideSteps ? null : '#custom-steps-slot',
        renderExitTo: hideExit ? null : '#custom-exit-slot',
        renderAssessmentTo: '#custom-assessment-slot',
      })}
    </Box>
  );
}
