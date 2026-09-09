export interface ScoreByCategory {
  categoryId: string;
  label: string;
  points: number;
}

export interface ScoreResult {
  total: number;
  byCategory: ScoreByCategory[];
  passed?: boolean;
}

export interface SurveyResponse {
  id: string;
  surveyId: string;
  surveyVersion: number;
  answers: Record<string, unknown>;
  visitedPageIds: string[];
  score?: ScoreResult;
  startedAt: string;
  completedAt?: string;
}
