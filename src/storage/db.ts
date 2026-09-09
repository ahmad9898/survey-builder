import Dexie, { type EntityTable } from 'dexie';
import type { Survey } from '../types/survey';
import type { SurveyResponse } from '../types/response';

// IndexedDB over localStorage: response volume can grow past localStorage's
// ~5-10MB quota, Dexie's indexed `where()` queries avoid manually parsing a
// single JSON blob, and its async API keeps large reads off the main thread.
export const db = new Dexie('survey-builder') as Dexie & {
  surveys: EntityTable<Survey, 'id'>;
  responses: EntityTable<SurveyResponse, 'id'>;
};

db.version(1).stores({
  surveys: 'id, updatedAt',
  responses: 'id, surveyId, completedAt',
});
