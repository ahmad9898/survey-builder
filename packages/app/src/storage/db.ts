import Dexie, { type EntityTable } from 'dexie';
import type { Survey, SurveyResponse } from 'survey-builder-kit';

// This app's own IndexedDB database -- the "my surveys" list and response
// history are concerns of this demo/manual-testing app, not of the library
// package (survey-builder-kit has its own separate database for its
// internal flow-layout and draft-autosave state; see its storage/db.ts).
// Keeps the original "survey-builder" database name from before the
// workspace split, so existing local data isn't orphaned.
export const db = new Dexie('survey-builder') as Dexie & {
  surveys: EntityTable<Survey, 'id'>;
  responses: EntityTable<SurveyResponse, 'id'>;
};

// Preserves the pre-workspace-split version history exactly (versions 1-2
// had flowLayouts too, in this same database) so Dexie can still correctly
// open/migrate an existing user's browser-local data. Version 3 drops
// flowLayouts, which now lives in the library package's own database --
// any canvas positions an existing user had saved are lost (cosmetic only;
// they just re-auto-layout), not worth a cross-database migration for a
// dev-stage local-first tool. See the README's known limitations.
db.version(1).stores({
  surveys: 'id, updatedAt',
  responses: 'id, surveyId, completedAt',
});

db.version(2).stores({
  surveys: 'id, updatedAt',
  responses: 'id, surveyId, completedAt',
  flowLayouts: 'surveyId',
});

db.version(3).stores({
  surveys: 'id, updatedAt',
  responses: 'id, surveyId, completedAt',
  flowLayouts: null,
});
