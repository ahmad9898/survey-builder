import { db } from './db';
import type { Survey } from '../types/survey';

// A crash/accidental-close safety net for <SurveyBuilder> -- NOT a
// competing source of truth. The `survey` prop is authoritative on mount;
// nothing in this library ever reads a draft back out of here automatically
// over that prop. A host application is free to build its own "restore
// unsaved changes?" UI on top of this if it wants one, but that's a host
// decision, not something this library does on its own.
//
// Keyed by a per-mount instanceId (see useDraftAutosave.ts), not survey.id --
// the same survey open in two tabs, or two <SurveyBuilder> instances mounted
// on one page, each get their own draft slot and never overwrite each
// other's local backup.
export const builderDraftRepository = {
  get(instanceId: string): Promise<Survey | undefined> {
    return db.builderDrafts.get(instanceId).then((record) => record?.survey);
  },
  save(instanceId: string, survey: Survey): Promise<string> {
    return db.builderDrafts.put({ instanceId, surveyId: survey.id, survey, savedAt: new Date().toISOString() });
  },
  remove(instanceId: string): Promise<void> {
    return db.builderDrafts.delete(instanceId);
  },
};
