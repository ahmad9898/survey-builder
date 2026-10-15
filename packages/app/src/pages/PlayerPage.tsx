import { useEffect, useRef, useState } from 'react';
import { useParams, useLocation, Link as RouterLink } from 'react-router-dom';
import { Box, Typography, Link } from '@mui/material';
import { SurveyRunner } from 'survey-builder-kit';
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

  // <SurveyRunner>'s onSubmit now hands back a full SurveyResponse (id,
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
    <Box sx={{ flex: 1, minHeight: 0 }}>
      <SurveyRunner
        survey={survey}
        onSubmit={handleSubmit}
        onAnswer={assessmentCallback}
        exitPath="/"
        bgColor="color-black"
        primaryColor="#e11d48"
      />
    </Box>
  );
}
