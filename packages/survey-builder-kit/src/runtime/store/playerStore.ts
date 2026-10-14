import { createStore } from 'zustand/vanilla';
import type { Survey, SurveyPage } from '../../types/survey';
import type { ScoreResult } from '../../types/response';
import { resolveNextPage } from '../../domain/branchingEngine';
import { computeScore } from '../../domain/scoringEngine';
import { createStoreContext } from '../../lib/createStoreContext';

export interface PlayerState {
  survey: Survey | null;
  currentPageId: string | null;
  answers: Record<string, unknown>;
  visitedPageStack: string[];
  finished: boolean;
  score: ScoreResult | null;

  loadSurvey: (survey: Survey) => void;
  setAnswers: (data: Record<string, unknown>) => void;
  goNext: () => void;
  goBack: () => void;
  reset: () => void;
}

function getPage(survey: Survey, pageId: string): SurveyPage {
  const page = survey.pages.find((p) => p.id === pageId);
  if (!page) throw new Error(`Unknown page id: ${pageId}`);
  return page;
}

// One store per mounted Runner instance (see PlayerStoreContext below), not
// a shared module-level singleton -- two respondents' sessions (or the same
// survey rendered twice on one host page) must never share answers/position.
export function createPlayerStore() {
  return createStore<PlayerState>((set, get) => ({
    survey: null,
    currentPageId: null,
    answers: {},
    visitedPageStack: [],
    finished: false,
    score: null,

    loadSurvey: (survey) =>
      set({
        survey,
        currentPageId: survey.startPageId,
        answers: {},
        visitedPageStack: [survey.startPageId],
        finished: false,
        score: null,
      }),

    setAnswers: (data) => set({ answers: data }),

    goNext: () => {
      const { survey, currentPageId, answers, visitedPageStack } = get();
      if (!survey || !currentPageId) return;
      const page = getPage(survey, currentPageId);
      const nextPageId = resolveNextPage(page, answers);
      if (nextPageId === 'end') {
        const score = survey.scoring?.enabled
          ? computeScore(survey.scoringMap, answers, survey.scoring.categories, survey.scoring.passThreshold)
          : null;
        set({ finished: true, score });
        return;
      }
      set({
        currentPageId: nextPageId,
        visitedPageStack: [...visitedPageStack, nextPageId],
      });
    },

    goBack: () => {
      const { visitedPageStack } = get();
      if (visitedPageStack.length <= 1) return;
      const newStack = visitedPageStack.slice(0, -1);
      set({
        visitedPageStack: newStack,
        currentPageId: newStack[newStack.length - 1],
        finished: false,
      });
    },

    reset: () => {
      const { survey } = get();
      if (!survey) return;
      set({
        currentPageId: survey.startPageId,
        answers: {},
        visitedPageStack: [survey.startPageId],
        finished: false,
        score: null,
      });
    },
  }));
}

export type PlayerStoreApi = ReturnType<typeof createPlayerStore>;

const { Context: PlayerStoreContext, useBoundStore: usePlayerStore, useStoreApi: usePlayerStoreApi } =
  createStoreContext<PlayerState>('usePlayerStore');

export { PlayerStoreContext, usePlayerStore, usePlayerStoreApi };
