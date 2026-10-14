import { useCallback, useRef, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Button,
  Chip,
  Link,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import TitleIcon from '@mui/icons-material/Title';
import {
  validateSurveyResponse,
  CURRENT_ANSWERS_FORMAT_VERSION,
  QUESTION_TYPE_ICONS,
} from 'survey-builder-kit';
import type { SurveyResponse, AnswerEntry, QuestionType } from 'survey-builder-kit';

// Read-only, local-only inspector for ONE exported response JSON file -- no
// survey definition, no app/IndexedDB state, nothing is ever uploaded
// anywhere (this is health-screening data). Parsed and rendered entirely
// client-side via FileReader/File.text(); never a fetch/XHR of its own.

type ViewerState =
  | { kind: 'empty' }
  | { kind: 'error'; message: string }
  // `response` is deliberately untyped here -- a legacy file's `answers`
  // values are raw scalars, not AnswerEntry objects, so SurveyResponse's
  // type doesn't actually describe it. Rendered as a plain id/value table.
  | { kind: 'legacy'; response: Record<string, unknown> }
  | { kind: 'full'; response: SurveyResponse };

function WarningBanner({ children }: { children: React.ReactNode }) {
  return (
    <Box
      sx={{
        display: 'flex',
        gap: 1.5,
        p: 2,
        borderRadius: 1.5,
        bgcolor: 'warning.light',
        border: '1px solid',
        borderColor: 'warning.main',
      }}
    >
      <WarningAmberIcon sx={{ color: 'warning.dark', flexShrink: 0 }} />
      <Box sx={{ color: 'warning.dark', minWidth: 0 }}>{children}</Box>
    </Box>
  );
}

// Groups entries by page, ordered by `visitedPageIds` (the actual path the
// respondent took) rather than the array's own element order -- a freshly
// built response already comes in this order (buildResponsePayload writes
// entries in visitedPageIds order), but this file came from outside the
// app (untrusted input): a hand-edited or re-serialized one shouldn't be
// trusted to preserve that ordering, so it's reconstructed defensively
// rather than assumed.
function orderedEntries(response: SurveyResponse): AnswerEntry[] {
  const all = response.answers;
  const ordered: AnswerEntry[] = [];
  for (const pageId of response.visitedPageIds) {
    for (const entry of all) {
      if (entry.pageId === pageId) ordered.push(entry);
    }
  }
  const seen = new Set(ordered.map((e) => e.questionId));
  for (const entry of all) {
    if (!seen.has(entry.questionId)) ordered.push(entry);
  }
  return ordered;
}

function AnswerCard({ entry }: { entry: AnswerEntry }) {
  const Icon = QUESTION_TYPE_ICONS[entry.type as QuestionType] ?? HelpOutlineIcon;

  if (entry.type === 'label') {
    return (
      <Paper variant="outlined" sx={{ p: 2, display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
        <Chip icon={<TitleIcon />} label="Info" size="small" variant="outlined" />
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body1" sx={{ fontWeight: 600 }}>
            {entry.label}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Acknowledged
          </Typography>
        </Box>
      </Paper>
    );
  }

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack direction="row" spacing={1.5} alignItems="flex-start">
        <Chip icon={<Icon />} label={entry.type} size="small" variant="outlined" sx={{ flexShrink: 0 }} />
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="body1" sx={{ fontWeight: 600 }}>
            {entry.label}
          </Typography>
          <Typography variant="body1" sx={{ mt: 0.5 }} color={entry.skipped ? 'text.disabled' : 'text.primary'}>
            {entry.displayValue}
          </Typography>

          {entry.options && (
            <Stack direction="row" flexWrap="wrap" gap={0.75} sx={{ mt: 1.5 }}>
              {entry.options.map((opt) => (
                <Chip
                  key={opt.value}
                  label={opt.label}
                  size="small"
                  variant={opt.selected ? 'filled' : 'outlined'}
                  color={opt.selected ? (opt.disqualifying ? 'warning' : 'primary') : 'default'}
                  sx={{ opacity: opt.selected ? 1 : 0.55 }}
                />
              ))}
            </Stack>
          )}

          {entry.disqualifying && (
            <Box sx={{ mt: 1.5 }}>
              <WarningBanner>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  Disqualifying answer
                </Typography>
                {entry.disqualifyMessage && <Typography variant="body2">{entry.disqualifyMessage}</Typography>}
              </WarningBanner>
            </Box>
          )}
        </Box>
      </Stack>
    </Paper>
  );
}

function FullResponseView({ response }: { response: SurveyResponse }) {
  const entries = orderedEntries(response);
  const anyDisqualifying = entries.some((e) => e.disqualifying);
  const isWarning = response.score?.passed === false || anyDisqualifying;

  return (
    <Stack spacing={2}>
      <Paper variant="outlined" sx={{ p: 2.5 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap={1.5}>
          <Box>
            <Typography variant="overline" color="text.secondary">
              Survey
            </Typography>
            <Stack direction="row" alignItems="center" spacing={1}>
              {/* title/type are typed as always-present (title) / optional
                  (type) on a freshly-built SurveyResponse, but this file
                  came from outside the app (untrusted input) -- an older
                  response predating these fields, or a hand-edited one,
                  might still lack them despite claiming
                  answersFormatVersion 2. */}
              <Typography variant="h6">{response.title ?? response.surveyId}</Typography>
              {response.type && (
                <Chip size="small" label={response.type} sx={{ bgcolor: 'action.hover', fontWeight: 500 }} />
              )}
            </Stack>
            <Typography variant="body2" color="text.secondary">
              {response.surveyId} &middot; v{response.surveyVersion} &middot; response {response.id}
            </Typography>
          </Box>
          {response.score && (
            <Chip
              icon={isWarning ? <WarningAmberIcon /> : <CheckCircleIcon />}
              color={isWarning ? 'warning' : 'success'}
              label={`Score ${response.score.total}${response.score.passed === undefined ? '' : response.score.passed ? ' · Passed' : ' · Did not pass'}`}
            />
          )}
          {!response.score && anyDisqualifying && (
            <Chip icon={<WarningAmberIcon />} color="warning" label="Disqualifying answer given" />
          )}
        </Stack>
        <Stack direction="row" spacing={3} sx={{ mt: 2 }}>
          <Box>
            <Typography variant="caption" color="text.secondary">
              Started
            </Typography>
            <Typography variant="body2">{new Date(response.startedAt).toLocaleString()}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">
              Completed
            </Typography>
            <Typography variant="body2">
              {response.completedAt ? new Date(response.completedAt).toLocaleString() : '—'}
            </Typography>
          </Box>
        </Stack>
      </Paper>

      <Stack spacing={1.5}>
        {entries.map((entry) => (
          <AnswerCard key={entry.questionId} entry={entry} />
        ))}
      </Stack>
    </Stack>
  );
}

function LegacyResponseView({ response }: { response: Record<string, unknown> }) {
  const answers = (response.answers ?? {}) as Record<string, unknown>;
  return (
    <Stack spacing={2}>
      <WarningBanner>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          Older response format
        </Typography>
        <Typography variant="body2">
          This file was saved before responses carried question context (labels, choice options, disqualifying
          info). Showing raw question IDs and values only.
        </Typography>
      </WarningBanner>
      <Paper variant="outlined">
        <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse' }}>
          <Box component="thead">
            <Box component="tr">
              <Box component="th" sx={{ textAlign: 'left', p: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
                Question ID
              </Box>
              <Box component="th" sx={{ textAlign: 'left', p: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
                Value
              </Box>
            </Box>
          </Box>
          <Box component="tbody">
            {Object.entries(answers).map(([questionId, value]) => (
              <Box component="tr" key={questionId}>
                <Box component="td" sx={{ p: 1.5, borderBottom: '1px solid', borderColor: 'divider', fontFamily: 'monospace' }}>
                  {questionId}
                </Box>
                <Box component="td" sx={{ p: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
                  {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                </Box>
              </Box>
            ))}
          </Box>
        </Box>
      </Paper>
    </Stack>
  );
}

export function ViewerPage() {
  const [state, setState] = useState<ViewerState>({ kind: 'empty' });
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    let parsed: unknown;
    try {
      const text = await file.text();
      parsed = JSON.parse(text);
    } catch {
      setState({ kind: 'error', message: 'Could not read this file as JSON.' });
      return;
    }

    if (typeof parsed !== 'object' || parsed === null) {
      setState({ kind: 'error', message: 'This file is not a JSON object.' });
      return;
    }
    const record = parsed as Record<string, unknown>;
    // Loose on purpose -- `typeof` matches both an array (current shape)
    // and a plain object (the legacy flat questionId->value shape) here;
    // which one it actually is gets sorted out below.
    if (typeof record.answers !== 'object' || record.answers === null) {
      setState({ kind: 'error', message: 'This does not look like a survey response export (missing "answers" data).' });
      return;
    }

    if (record.answersFormatVersion === CURRENT_ANSWERS_FORMAT_VERSION) {
      const validation = validateSurveyResponse(parsed);
      if (!validation.valid) {
        setState({
          kind: 'error',
          message: `This file claims the current response format, but doesn't match it:\n${(validation.errors ?? []).join('\n')}`,
        });
        return;
      }
      setState({ kind: 'full', response: parsed as SurveyResponse });
      return;
    }

    // No/unrecognized answersFormatVersion -- only accept it as a legacy
    // response if it at least carries the bare minimum every version of
    // SurveyResponse has always had; otherwise it's not a response file at all.
    if (typeof record.id !== 'string' || typeof record.surveyId !== 'string') {
      setState({ kind: 'error', message: 'This does not look like a survey response export.' });
      return;
    }
    setState({ kind: 'legacy', response: record });
  }, []);

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) void handleFile(file);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  };

  return (
    <Box sx={{ maxWidth: 760, mx: 'auto', p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h4">Answers Viewer</Typography>
        <Link component={RouterLink} to="/">
          Back home
        </Link>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Drop in one response JSON file to inspect it. Nothing is uploaded anywhere -- this reads the file locally in
        your browser only.
      </Typography>

      {state.kind !== 'empty' && (
        <Button size="small" onClick={() => setState({ kind: 'empty' })} sx={{ mb: 2 }}>
          ← Load a different file
        </Button>
      )}

      {state.kind === 'empty' && (
        <Box
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          sx={{
            border: '2px dashed',
            borderColor: isDragging ? 'primary.main' : 'divider',
            bgcolor: isDragging ? 'primary.light' : 'background.paper',
            borderRadius: 2,
            p: 6,
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'border-color .15s ease, background-color .15s ease',
          }}
        >
          <UploadFileIcon sx={{ fontSize: 40, color: 'text.secondary', mb: 1 }} />
          <Typography variant="body1" sx={{ fontWeight: 600 }}>
            Drop a response JSON file here
          </Typography>
          <Typography variant="body2" color="text.secondary">
            or click to browse
          </Typography>
          <input ref={fileInputRef} type="file" accept="application/json,.json" hidden onChange={onInputChange} />
        </Box>
      )}

      {state.kind === 'error' && (
        <Paper
          variant="outlined"
          sx={{ p: 3, display: 'flex', gap: 2, alignItems: 'flex-start', borderColor: 'error.main' }}
        >
          <ErrorOutlineIcon color="error" />
          <Box>
            <Typography variant="body1" sx={{ fontWeight: 600 }} color="error.main">
              Couldn't read this file
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
              {state.message}
            </Typography>
          </Box>
        </Paper>
      )}

      {state.kind === 'legacy' && <LegacyResponseView response={state.response} />}
      {state.kind === 'full' && <FullResponseView response={state.response} />}
    </Box>
  );
}
