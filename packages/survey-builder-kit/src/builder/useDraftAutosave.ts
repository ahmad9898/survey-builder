import { useEffect, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Survey } from '../types/survey';
import { builderDraftRepository } from '../storage/builderDraftRepository';

export type SaveStatus = 'saved' | 'unsaved' | 'saving' | 'error';

// Debounced local-draft autosave for <SurveyBuilder> -- a crash/accidental-
// close safety net, not a competing source of truth. The `survey` prop is
// authoritative on mount; this never gets read back automatically over it.
// All IndexedDB access happens inside the effect below, which (like any
// effect) never runs during server rendering -- no extra SSR guard needed
// here specifically, though the library as a whole is still client-only
// (see the README).
export function useDraftAutosave(survey: Survey): SaveStatus {
  const [status, setStatus] = useState<SaveStatus>('saved');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasMountedRef = useRef(false);
  // Generated once per mount -- scopes this instance's draft slot so it can
  // never collide with another <SurveyBuilder> instance (same survey open in
  // two tabs, or two instances mounted on one page), per survey.id.
  const instanceIdRef = useRef<string | null>(null);
  if (instanceIdRef.current === null) instanceIdRef.current = uuidv4();

  useEffect(() => {
    // Skip the flash of "unsaved" on the very first render after mount.
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }
    setStatus('unsaved');
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setStatus('saving');
      try {
        await builderDraftRepository.save(instanceIdRef.current!, survey);
        setStatus('saved');
      } catch {
        setStatus('error');
      }
    }, 500);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [survey]);

  return status;
}
