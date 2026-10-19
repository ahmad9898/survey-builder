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
  // Question ids the HOST supplied a predefinedAnswers entry for -- never
  // populated by anything the respondent does. RunnerShell's isVisible
  // treats a question in this set as hidden, same mechanism as a
  // visibilityRule but host-driven rather than survey-authored (see
  // SurveyRunnerProps.predefinedAnswers's own comment). Separate from
  // `answers` itself (which DOES get the predefined value merged in, same
  // as initialAnswers) so a respondent filling in a question mid-page
  // doesn't accidentally hide it the instant it gets a value.
  predefinedQuestionIds: Set<string>;
  // Question ids the HOST supplied via initialAnswers (a static, mount-time
  // snapshot of its keys -- never updated as `answers` changes afterward,
  // whether from the respondent typing or from setAnswers elsewhere). Used
  // only for RunnerShell's "skip this whole page" check: unlike
  // predefinedQuestionIds, these questions stay VISIBLE/editable on a mixed
  // page (initialAnswers is a pre-fill, not a hide) -- but if every visible
  // question on a page is in this set, there's nothing left to show OR
  // answer there, so the page is skipped outright, same as a page with zero
  // visible questions already was. Being static is what makes this safe:
  // it can never flip true mid-page just because the respondent finished
  // filling in the last field themselves.
  initialAnswerQuestionIds: Set<string>;
  visitedPageStack: string[];
  finished: boolean;
  score: ScoreResult | null;

  loadSurvey: (survey: Survey) => void;
  setAnswers: (data: Record<string, unknown>) => void;
  setPredefinedQuestionIds: (ids: Set<string>) => void;
  setInitialAnswerQuestionIds: (ids: Set<string>) => void;
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
    predefinedQuestionIds: new Set(),
    initialAnswerQuestionIds: new Set(),
    visitedPageStack: [],
    finished: false,
    score: null,

    loadSurvey: (survey) =>
      set({
        survey,
        currentPageId: survey.startPageId,
        answers: {},
        predefinedQuestionIds: new Set(),
        initialAnswerQuestionIds: new Set(),
        visitedPageStack: [survey.startPageId],
        finished: false,
        score: null,
      }),

    setAnswers: (data) => set({ answers: data }),
    setPredefinedQuestionIds: (ids) => set({ predefinedQuestionIds: ids }),
    setInitialAnswerQuestionIds: (ids) => set({ initialAnswerQuestionIds: ids }),

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
        predefinedQuestionIds: new Set(),
        initialAnswerQuestionIds: new Set(),
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
