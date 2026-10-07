import { db } from './db';
import type { SurveyResponse } from '../types/response';

export const responseRepository = {
  save(response: SurveyResponse): Promise<string> {
    return db.responses.put(response);
  },
  listBySurvey(surveyId: string): Promise<SurveyResponse[]> {
    return db.responses.where('surveyId').equals(surveyId).reverse().sortBy('completedAt');
  },
};
