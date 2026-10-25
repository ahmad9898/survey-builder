import { useEffect, useMemo, useRef } from 'react';
import Box from '@mui/material/Box';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { CacheProvider } from '@emotion/react';
import createCache from '@emotion/cache';
import type { Survey } from './types/survey';
import { createLibraryTheme } from './theme';
import { BuilderStoreProvider } from './builder/store/BuilderStoreProvider';
import { useBuilderStore, newSurvey } from './builder/store/builderStore';
import { useFlowLayoutStore } from './builder/store/flowLayoutStore';
import { useSnackbarStore } from './builder/store/snackbarStore';
import { useDraftAutosave } from './builder/useDraftAutosave';
import { BuilderLayout } from './builder/components/BuilderLayout';
import { validateSurvey, normalizeSurvey } from './domain/surveySchema';
import { findMissingMandatoryFields } from './builder/surveyReadiness';
import { SurveyValidationError } from './components/SurveyValidationError';

export interface SurveyBuilderProps {
  /** Existing survey JSON to edit, or null/undefined to start a new one. */
  survey?: Survey | null;
  /** Fires (debounced ~500ms) as the author edits. */
  onChange?: (survey: Survey) => void;
  /** Fires when the author clicks the header's Save/Publish action (or presses Ctrl/Cmd+S). */
  onSave?: (survey: Survey) => void;
  /**
   * Added to this component's own root element's `className`, nothing more
   * -- not a DOM node or a ref, despite the name. Lets a host theme ONE
   * mounted instance purely from its own CSS (`.acme-blue-theme { ... }`),
   * without touching this library's internals or re-rendering with a
   * different theme object per instance. Omit it for no extra class.
   */
  bgColor?: string;
  /**
   * Overrides the library's default primary color (`#4f46e5`) for this one
   * mounted instance -- every `primary.main`/`.dark`/`.light`/`.contrastText`
   * usage throughout the component (buttons, selected states, the flow
   * map's active-node styling, etc.) reads from the theme, so this one
   * value reaches all of them. `dark`/`light`/`contrastText` are derived
   * from it automatically. Unlike `bgColor`, this DOES re-render under a
   * different theme object -- there's no way to override MUI's `sx={{
   * color: 'primary.main' }}` tokens from plain host CSS the way `bgColor`
   * overrides literal CSS properties.
   */
  primaryColor?: string;
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
  const theme = useMemo(() => createLibraryTheme(props.primaryColor), [props.primaryColor]);

  return (
    <CacheProvider value={emotionCache}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {/* The one DOM wrapper between the (non-DOM) providers above and
            whichever branch renders below -- bgColor's whole mechanism is
            this className, so it has to land on every render path (error
            state included), not just the happy path. height: '100%' here,
            not on this Box's child, is what lets the existing "renders at
            height: 100% of whatever you mount it in" contract keep working
            with an extra DOM layer now in between. */}
        <Box className={props.bgColor} sx={{ height: '100%' }}>
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
        </Box>
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

  const showError = useSnackbarStore((s) => s.showError);

  // Publish refuses to fire -- and onSave is never called -- while any
  // field the Builder itself marks mandatory (required indicator + inline
  // error) is still empty; see findMissingMandatoryFields for the full
  // list. The author sees exactly why via the same toast other rejected
  // actions use (e.g. FlowMapView's "needs at least one page"), not a
  // silent no-op.
  const handleSave = () => {
    const issues = findMissingMandatoryFields(survey);
    if (issues.length > 0) {
      showError(issues.length === 1 ? issues[0] : `${issues[0]} (+${issues.length - 1} more)`);
      return;
    }
    onSave?.(survey);
  };

  return <BuilderLayout saveStatus={saveStatus} onSave={handleSave} />;
}

// Re-exported so a host that starts with `survey={null}` can still get a
// valid, empty Survey object to seed their own state with if they want one
// (e.g. to immediately call onChange-shaped code before the author has
// touched anything) -- not required for normal use, SurveyBuilder already
// creates one internally when `survey` is null/undefined.
export { newSurvey };
