import { db } from './db';
import type { Survey } from 'survey-builder-kit';

export const surveyRepository = {
  list(): Promise<Survey[]> {
    return db.surveys.orderBy('updatedAt').reverse().toArray();
  },
  get(id: string): Promise<Survey | undefined> {
    return db.surveys.get(id);
  },
  save(survey: Survey): Promise<string> {
    return db.surveys.put(survey);
  },
  remove(id: string): Promise<void> {
    return db.surveys.delete(id);
  },
};
