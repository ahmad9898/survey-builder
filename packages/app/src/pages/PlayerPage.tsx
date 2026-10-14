import { useEffect, useRef, useState } from 'react';
import { useParams, useLocation, Link as RouterLink } from 'react-router-dom';
import { Box, Typography, Link } from '@mui/material';
import { SurveyRunner, computeScore } from 'survey-builder-kit';
import type { Survey } from 'survey-builder-kit';
import { sampleSurveys } from '../fixtures/sampleSurveys';
import { surveyRepository } from '../storage/surveyRepository';
import { responseRepository } from '../storage/responseRepository';
import { newId } from '../lib/id';

export function PlayerPage() {
  const { surveyId } = useParams<{ surveyId: string }>();
  const location = useLocation();
  const surveyFromNavState = (location.state as { survey?: Survey } | null)?.survey;
  const [survey, setSurvey] = useState<Survey | null>(null);
  const startedAtRef = useRef(new Date().toISOString());
  const savedResponseFor = useRef<string | null>(null);

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

  const handleSubmit = (answers: Record<string, unknown>) => {
    if (!survey || savedResponseFor.current === survey.id) return;
    savedResponseFor.current = survey.id;
    const score = survey.scoring?.enabled
      ? computeScore(survey.scoringMap, answers, survey.scoring.categories, survey.scoring.passThreshold)
      : undefined;
    responseRepository.save({
      id: newId('response'),
      surveyId: survey.id,
      surveyVersion: survey.version,
      answers,
      // <SurveyRunner>'s public API doesn't expose page-visit history (only
      // final answers), so this app-level record can no longer track it.
      visitedPageIds: [],
      score,
      startedAt: startedAtRef.current,
      completedAt: new Date().toISOString(),
    });
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
      <SurveyRunner survey={survey} onSubmit={handleSubmit} />
    </Box>
  );
}
