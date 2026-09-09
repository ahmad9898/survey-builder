import { useEffect, useRef } from 'react';
import { useParams, useLocation, Link as RouterLink } from 'react-router-dom';
import { Box, Typography, Link } from '@mui/material';
import { usePlayerStore } from '../runtime/store/playerStore';
import { SurveyPage } from '../runtime/components/SurveyPage';
import { ResultsScreen } from '../runtime/components/ResultsScreen';
import { sampleSurveys } from '../fixtures/sampleSurveys';
import type { Survey } from '../types/survey';
import { surveyRepository } from '../storage/surveyRepository';
import { responseRepository } from '../storage/responseRepository';
import { newId } from '../lib/id';

export function PlayerPage() {
  const { surveyId } = useParams<{ surveyId: string }>();
  const location = useLocation();
  const surveyFromNavState = (location.state as { survey?: Survey } | null)?.survey;
  const survey = usePlayerStore((s) => s.survey);
  const finished = usePlayerStore((s) => s.finished);
  const answers = usePlayerStore((s) => s.answers);
  const score = usePlayerStore((s) => s.score);
  const visitedPageStack = usePlayerStore((s) => s.visitedPageStack);
  const loadSurvey = usePlayerStore((s) => s.loadSurvey);
  const savedResponseFor = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (surveyFromNavState) {
        loadSurvey(surveyFromNavState);
        return;
      }
      const fromDb = await surveyRepository.get(surveyId!);
      if (cancelled) return;
      const found = fromDb ?? sampleSurveys.find((s) => s.id === surveyId);
      if (found) loadSurvey(found);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [surveyId, surveyFromNavState, loadSurvey]);

  useEffect(() => {
    if (!finished || !survey) return;
    if (savedResponseFor.current === survey.id) return;
    savedResponseFor.current = survey.id;
    responseRepository.save({
      id: newId('response'),
      surveyId: survey.id,
      surveyVersion: survey.version,
      answers,
      visitedPageIds: visitedPageStack,
      score: score ?? undefined,
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    });
  }, [finished, survey, answers, score, visitedPageStack]);

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

  return finished ? <ResultsScreen /> : <SurveyPage />;
}
