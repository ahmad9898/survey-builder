import Dexie, { type EntityTable } from 'dexie';
import type { Survey } from '../types/survey';

export interface FlowLayoutRecord {
  surveyId: string;
  // Per-page canvas position the author has manually dragged to, overlaid on
  // top of the auto-layout result. Deliberately kept out of Survey/SurveyPage
  // itself -- this is a view concern, not survey data.
  positions: Record<string, { x: number; y: number }>;
}

// A crash/accidental-close safety net, NOT a competing source of truth: the
// `survey` prop <SurveyBuilder> is mounted with is authoritative on mount,
// this table is never read back automatically over it. See
// builderDraftRepository.ts and useDraftAutosave.ts.
//
// Keyed by a per-mount `instanceId` (generated once when <SurveyBuilder>
// mounts), NOT `surveyId` -- two instances editing the same survey (two
// browser tabs, or two mounted components) each get their own draft slot and
// never overwrite each other's local backup. `surveyId` is kept as a plain
// indexed field for any future "find drafts for this survey" lookup.
export interface BuilderDraftRecord {
  instanceId: string;
  surveyId: string;
  survey: Survey;
  savedAt: string;
}

// This library's OWN IndexedDB database -- deliberately separate from
// whatever database a host application (or this repo's own demo app
// package) uses for its "list of saved surveys" or response history. Those
// are host-level concerns; this one exists purely to back the Flow map's
// per-page canvas positions and the Builder's local-draft autosave, both of
// which are genuinely this library's own internal state.
export const db = new Dexie('survey-builder-kit') as Dexie & {
  flowLayouts: EntityTable<FlowLayoutRecord, 'surveyId'>;
  builderDrafts: EntityTable<BuilderDraftRecord, 'instanceId'>;
};

db.version(1).stores({
  flowLayouts: 'surveyId',
  builderDrafts: 'instanceId, surveyId, savedAt',
});
