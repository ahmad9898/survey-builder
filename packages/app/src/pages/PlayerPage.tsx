import { useEffect, useRef, useState } from 'react';
import { useParams, useLocation, Link as RouterLink } from 'react-router-dom';
import { Box, Typography, Link } from '@mui/material';
import { renderAssessment } from 'survey-builder-kit';
import type { Survey, SurveyResponse } from 'survey-builder-kit';
import { sampleSurveys } from '../fixtures/sampleSurveys';
import { surveyRepository } from '../storage/surveyRepository';
import { responseRepository } from '../storage/responseRepository';

export function PlayerPage() {
  const { surveyId } = useParams<{ surveyId: string }>();
  const location = useLocation();
  const surveyFromNavState = (location.state as { survey?: Survey } | null)?.survey;
  const [survey, setSurvey] = useState<Survey | null>(null);
  const savedResponseFor = useRef<string | null>(null);

  // Same reasoning as BuilderPage's own identical effect -- see index.css's
  // #root.player-shell rule for why this is required, not cosmetic.
  useEffect(() => {
    const root = document.getElementById('root');
    root?.classList.add('player-shell');
    return () => {
      root?.classList.remove('player-shell');
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (surveyFromNavState) {
        setSurvey(surveyFromNavState);
        return;
      }
      const fromDb = await surveyRepository.get(surveyId!);
      if (cancelled) return;
      const found = fromDb ?? sampleSurveys.find((s) => s.id === surveyId) ?? null;
      setSurvey(found);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [surveyId, surveyFromNavState]);

  // renderAssessment's onSubmit now hands back a full SurveyResponse (id,
  // visitedPageIds, score, timestamps included) -- nothing left to
  // re-derive here, just persist it as-is.
  const handleSubmit = (response: SurveyResponse) => {
    if (!survey || savedResponseFor.current === survey.id) return;
    savedResponseFor.current = survey.id;
    responseRepository.save(response);
  };

  // Fires once per page advance (hasTrigger questions only, submitted:
  // false), and once more at actual submission (every answer, submitted:
  // true) -- unlike handleSubmit above, this isn't persisted anywhere yet,
  // just logged for now.
  const assessmentCallback = (response: SurveyResponse, submitted: boolean) => {
    console.log('assessmentCallback', response, 'submitted: ' + submitted);
  };

  if (!survey) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography>Survey not found.</Typography>
        <Link component={RouterLink} to="/">
          Back home
        </Link>
      </Box>
    );
  }

  return (
    <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      {/* survey-builder-kit's progress bar/step counter/Exit link all default
          to hidden now (see SurveyRunnerProps.renderProgressBarTo's own
          comment) -- these three empty slots are where they portal into,
          restoring the look this page had before that default changed. */}
      <Box id="player-progress-bar" />
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 2, px: 2, py: 1 }}>
        <Box id="player-steps" />
        <Box id="player-exit" />
      </Box>
      <Box sx={{ flex: 1, minHeight: 0 }}>
        {renderAssessment({
          survey,
          // Demo value for a "Date of Birth" question -- the key must match
          // that question's own id/slug in whatever survey is loaded (the
          // Builder auto-slugifies a "Date of Birth" title to
          // "date-of-birth"); the value is a plain 'YYYY-MM-DD' string, the
          // same format DateControl itself reads/produces. Harmless if no
          // question with this id exists on the loaded survey -- it's just
          // an unused key in that case.
          initialAnswers: { 'date1': '1995-03-15' },
          onSubmit: handleSubmit,
          onAnswer: assessmentCallback,
          exitPath: '/',
          bgColor: 'color-black',
          primaryColor: '#e11d48',
          renderProgressBarTo: '#player-progress-bar',
          renderStepsTo: '#player-steps',
          renderExitTo: '#player-exit',
        })}
      </Box>
    </Box>
  );
}
