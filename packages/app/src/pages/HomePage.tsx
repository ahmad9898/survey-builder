import { useEffect, useRef, useState } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Button,
  IconButton,
  Link,
  List,
  ListItem,
  ListItemText,
  Stack,
  Typography,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import DownloadIcon from '@mui/icons-material/Download';
import { sampleSurveys } from '../fixtures/sampleSurveys';
import { surveyRepository } from '../storage/surveyRepository';
import { exportJson, importJsonFile } from '../lib/fileIO';
import { newSurvey } from 'survey-builder-kit';
import type { Survey } from 'survey-builder-kit';

export function HomePage() {
  const navigate = useNavigate();
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refresh = () => surveyRepository.list().then(setSurveys);

  useEffect(() => {
    refresh();
  }, []);

  const handleNew = async () => {
    const survey = newSurvey();
    await surveyRepository.save(survey);
    navigate(`/builder/${survey.id}`);
  };

  const handleDelete = async (id: string, title: string) => {
    if (!window.confirm(`Delete "${title}"? This can't be undone.`)) return;
    await surveyRepository.remove(id);
    refresh();
  };

  const handleImport = async (file: File) => {
    try {
      const survey = await importJsonFile<Survey>(file);
      await surveyRepository.save(survey);
      navigate(`/builder/${survey.id}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Import failed.');
    }
  };

  return (
    <Box sx={{ maxWidth: 640, mx: 'auto', p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="h4" gutterBottom>
          Survey Builder
        </Typography>
        <Link component={RouterLink} to="/viewer">
          Answers Viewer
        </Link>
      </Stack>

      <Stack direction="row" spacing={2} sx={{ my: 2 }}>
        <Button variant="contained" onClick={handleNew}>
          New survey
        </Button>
        <Button variant="outlined" onClick={() => fileInputRef.current?.click()}>
          Import survey JSON
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleImport(file);
            e.target.value = '';
          }}
        />
      </Stack>

      <Typography variant="subtitle1" sx={{ mt: 3 }} gutterBottom>
        My surveys
      </Typography>
      {surveys.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No surveys yet. Click "New survey" to build one.
        </Typography>
      ) : (
        <List>
          {surveys.map((survey) => (
            <ListItem
              key={survey.id}
              disableGutters
              secondaryAction={
                <Stack direction="row" spacing={0.5}>
                  <IconButton
                    size="small"
                    aria-label={`Export ${survey.title}`}
                    onClick={() => exportJson(`${survey.title}.json`, survey)}
                  >
                    <DownloadIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    aria-label={`Delete ${survey.title}`}
                    onClick={() => handleDelete(survey.id, survey.title)}
                  >
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </Stack>
              }
            >
              <ListItemText
                primary={
                  <Link component={RouterLink} to={`/builder/${survey.id}`}>
                    {survey.title}
                  </Link>
                }
                secondary={
                  <Link component={RouterLink} to={`/run/${survey.id}`}>
                    Take this survey
                  </Link>
                }
              />
            </ListItem>
          ))}
        </List>
      )}

      <Typography variant="subtitle1" sx={{ mt: 3 }} gutterBottom>
        Example surveys
      </Typography>
      <List>
        {sampleSurveys.map((survey) => (
          <ListItem key={survey.id} disableGutters>
            <Link component={RouterLink} to={`/run/${survey.id}`}>
              {survey.title}
            </Link>
          </ListItem>
        ))}
      </List>

      <Typography variant="body2" sx={{ mt: 4 }}>
        <Link component={RouterLink} to="/verify-harness">
          survey-builder-kit JSON round-trip harness (temporary)
        </Link>
      </Typography>
    </Box>
  );
}
