import Dexie, { type EntityTable } from 'dexie';
import type { Survey } from '../types/survey';
import type { SurveyResponse } from '../types/response';

export interface FlowLayoutRecord {
  surveyId: string;
  // Per-page canvas position the author has manually dragged to, overlaid on
  // top of the auto-layout result. Deliberately kept out of Survey/SurveyPage
  // itself -- this is a view concern, not survey data.
  positions: Record<string, { x: number; y: number }>;
}

// IndexedDB over localStorage: response volume can grow past localStorage's
// ~5-10MB quota, Dexie's indexed `where()` queries avoid manually parsing a
// single JSON blob, and its async API keeps large reads off the main thread.
export const db = new Dexie('survey-builder') as Dexie & {
  surveys: EntityTable<Survey, 'id'>;
  responses: EntityTable<SurveyResponse, 'id'>;
  flowLayouts: EntityTable<FlowLayoutRecord, 'surveyId'>;
};

db.version(1).stores({
  surveys: 'id, updatedAt',
  responses: 'id, surveyId, completedAt',
});

db.version(2).stores({
  surveys: 'id, updatedAt',
  responses: 'id, surveyId, completedAt',
  flowLayouts: 'surveyId',
});
