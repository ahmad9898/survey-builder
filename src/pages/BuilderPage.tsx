import { useEffect, useRef, useState } from 'react';
import { useParams, Link as RouterLink } from 'react-router-dom';
import { Box, CircularProgress, Link, Typography } from '@mui/material';
import { BuilderLayout } from '../builder/components/BuilderLayout';
import { useBuilderStore } from '../builder/store/builderStore';
import { useFlowLayoutStore } from '../builder/store/flowLayoutStore';
import { surveyRepository } from '../storage/surveyRepository';

export type SaveStatus = 'saved' | 'unsaved' | 'saving' | 'error';

export function BuilderPage() {
  const { surveyId } = useParams<{ surveyId: string }>();
  const loadSurvey = useBuilderStore((s) => s.loadSurvey);
  const survey = useBuilderStore((s) => s.survey);
  const loadFlowLayout = useFlowLayoutStore((s) => s.loadForSurvey);
  const [status, setStatus] = useState<'loading' | 'ready' | 'not-found'>('loading');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasLoadedOnce = useRef(false);

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
        loadSurvey(found);
        void loadFlowLayout(found.id);
        setStatus('ready');
      } else {
        setStatus('not-found');
      }
    });
    return () => {
      cancelled = true;
    };
  }, [surveyId, loadSurvey, loadFlowLayout]);

  const saveNow = async () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveStatus('saving');
    try {
      await surveyRepository.save(survey);
      setSaveStatus('saved');
    } catch {
      setSaveStatus('error');
    }
  };

  // Debounced autosave: persist the survey shortly after edits settle, rather
  // than on every keystroke, so typing in a text field doesn't hammer IndexedDB.
  useEffect(() => {
    if (status !== 'ready') return;
    if (!hasLoadedOnce.current) {
      // Skip the flash of "unsaved" on the very first render after load.
      hasLoadedOnce.current = true;
      return;
    }
    setSaveStatus('unsaved');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveNow();
    }, 500);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [survey, status]);

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

  return <BuilderLayout saveStatus={saveStatus} onSaveNow={saveNow} />;
}
