import { useEffect, useRef } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { CacheProvider } from '@emotion/react';
import createCache from '@emotion/cache';
import type { Survey } from './types/survey';
import { theme } from './theme';
import { BuilderStoreProvider } from './builder/store/BuilderStoreProvider';
import { useBuilderStore, newSurvey } from './builder/store/builderStore';
import { useFlowLayoutStore } from './builder/store/flowLayoutStore';
import { useDraftAutosave } from './builder/useDraftAutosave';
import { BuilderLayout } from './builder/components/BuilderLayout';
import { validateSurvey, normalizeSurvey } from './domain/surveySchema';
import { SurveyValidationError } from './components/SurveyValidationError';

export interface SurveyBuilderProps {
  /** Existing survey JSON to edit, or null/undefined to start a new one. */
  survey?: Survey | null;
  /** Fires (debounced ~500ms) as the author edits. */
  onChange?: (survey: Survey) => void;
  /** Fires when the author clicks the header's Save/Publish action (or presses Ctrl/Cmd+S). */
  onSave?: (survey: Survey) => void;
}

// One Emotion cache per component, keyed distinctly from SurveyRunner's --
// scopes this library's injected styles so they can't collide with a host
// project's own MUI/Emotion setup if it has one.
const emotionCache = createCache({ key: 'sbk-builder' });

/**
 * The full survey authoring UI (page list, question editor, branching/
 * scoring, flow map) as a single embeddable component. Client-only -- see
 * the README's SSR caveat.
 */
export function SurveyBuilder(props: SurveyBuilderProps) {
  // Validated on mount (and again if the host swaps in a different `survey`
  // prop) -- a malformed survey renders a clear error state here instead of
  // crashing somewhere deep inside the branching/scoring/flow-map code that
  // assumes well-formed data.
  const validation = props.survey ? validateSurvey(props.survey) : { valid: true as const };

  return (
    <CacheProvider value={emotionCache}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {!validation.valid ? (
          <SurveyValidationError errors={validation.errors} />
        ) : (
          // initialSurvey seeds the store ONCE, at mount (via createBuilderStore's
          // default param) -- later prop changes are handled explicitly by
          // SurveyBuilderInner's effect below, not by recreating the store.
          <BuilderStoreProvider initialSurvey={props.survey ? normalizeSurvey(props.survey) : undefined}>
            <SurveyBuilderInner {...props} />
          </BuilderStoreProvider>
        )}
      </ThemeProvider>
    </CacheProvider>
  );
}

function SurveyBuilderInner({ survey: surveyProp, onChange, onSave }: SurveyBuilderProps) {
  const survey = useBuilderStore((s) => s.survey);
  const loadSurvey = useBuilderStore((s) => s.loadSurvey);
  const loadFlowLayout = useFlowLayoutStore((s) => s.loadForSurvey);

  // Loads the flow map's saved canvas positions for whichever survey is
  // CURRENTLY active -- once on mount (for the survey BuilderStoreProvider
  // seeded with), and again below whenever the host swaps in a different
  // survey.
  const hasLoadedInitialFlowLayout = useRef(false);
  useEffect(() => {
    if (hasLoadedInitialFlowLayout.current) return;
    hasLoadedInitialFlowLayout.current = true;
    void loadFlowLayout(survey.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-syncs if the HOST changes which survey.id this instance should show
  // (e.g. the author picked a different survey to edit in the host app) --
  // not on every re-render, and not in response to this instance's OWN
  // edits (which are authoritative while editing continues; the prop is
  // only the source of truth on mount and on an actual survey swap).
  const lastSyncedSurveyPropId = useRef<string | undefined>(surveyProp?.id);
  useEffect(() => {
    if (!surveyProp || surveyProp.id === lastSyncedSurveyPropId.current) return;
    lastSyncedSurveyPropId.current = surveyProp.id;
    loadSurvey(surveyProp);
    void loadFlowLayout(surveyProp.id);
  }, [surveyProp, loadSurvey, loadFlowLayout]);

  // Debounced onChange -- don't fire on every keystroke.
  const changeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasMountedChange = useRef(false);
  useEffect(() => {
    if (!hasMountedChange.current) {
      hasMountedChange.current = true;
      return;
    }
    if (changeTimer.current) clearTimeout(changeTimer.current);
    changeTimer.current = setTimeout(() => onChange?.(survey), 500);
    return () => {
      if (changeTimer.current) clearTimeout(changeTimer.current);
    };
  }, [survey, onChange]);

  // The header's save-status chip reflects this library's OWN internal
  // local-draft autosave (a crash safety net), not whether the host has
  // done anything with onSave's payload -- see useDraftAutosave's comment.
  const saveStatus = useDraftAutosave(survey);

  const handleSave = () => onSave?.(survey);

  return <BuilderLayout saveStatus={saveStatus} onSave={handleSave} />;
}

// Re-exported so a host that starts with `survey={null}` can still get a
// valid, empty Survey object to seed their own state with if they want one
// (e.g. to immediately call onChange-shaped code before the author has
// touched anything) -- not required for normal use, SurveyBuilder already
// creates one internally when `survey` is null/undefined.
export { newSurvey };
