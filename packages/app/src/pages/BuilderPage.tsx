import { useEffect, useState } from 'react';
import { useParams, Link as RouterLink } from 'react-router-dom';
import { Box, CircularProgress, Link, Typography } from '@mui/material';
import { SurveyBuilder } from 'survey-builder-kit';
import type { Survey } from 'survey-builder-kit';
import { surveyRepository } from '../storage/surveyRepository';

export function BuilderPage() {
  const { surveyId } = useParams<{ surveyId: string }>();
  const [status, setStatus] = useState<'loading' | 'ready' | 'not-found'>('loading');
  const [survey, setSurvey] = useState<Survey | null>(null);

  // The builder needs the full viewport width (palette + canvas + property
  // panel + preview side by side), unlike the narrower content pages, so it
  // opts #root out of the app-wide bordered/centered shell while mounted.
  useEffect(() => {
    const root = document.getElementById('root');
    root?.classList.add('builder-shell');
    return () => {
      root?.classList.remove('builder-shell');
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    surveyRepository.get(surveyId!).then((found) => {
      if (cancelled) return;
      if (found) {
        setSurvey(found);
        setStatus('ready');
      } else {
        setStatus('not-found');
      }
    });
    return () => {
      cancelled = true;
    };
  }, [surveyId]);

  // This app's own persistence layer (the `surveys` IndexedDB table) --
  // separate from <SurveyBuilder>'s internal per-instance draft autosave,
  // which is just a crash/accidental-close safety net. onChange/onSave are
  // the app's actual source of truth for what gets saved where.
  const handleChange = (updated: Survey) => {
    console.log(updated)
    void surveyRepository.save(updated);
  };
  const handleSave = (updated: Survey) => {
    console.log(updated)
    void surveyRepository.save(updated);
  };

  if (status === 'loading') {
    return (
      <Box sx={{ p: 4, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  if (status === 'not-found') {
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
      <SurveyBuilder survey={survey} onChange={handleChange} onSave={handleSave} />
    </Box>
  );
}
