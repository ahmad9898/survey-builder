import { create } from 'zustand';
import type { ConditionGroup, QuestionDef, QuestionType, ScoringEntry, Survey, SurveyPage } from '../../types/survey';
import { compilePage } from '../../domain/schemaCompiler';
import { newFieldId, newId } from '../../lib/id';
import { questionTypeMeta } from '../questionTypes';

function recompilePage(page: SurveyPage): SurveyPage {
  const { schema, uischema } = compilePage(page);
  return { ...page, schema, uischema };
}

function emptyPage(title: string): SurveyPage {
  return recompilePage({
    id: newId('page'),
    title,
    questions: [],
    schema: { type: 'object', properties: {} },
    uischema: { type: 'VerticalLayout', elements: [] },
    branch: [],
    defaultNextPageId: 'end',
  });
}

export function newSurvey(title = 'Untitled survey'): Survey {
  const firstPage = emptyPage('Page 1');
  return {
    id: newId('survey'),
    title,
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    startPageId: firstPage.id,
    pages: [firstPage],
    scoring: { enabled: false },
    scoringMap: {},
  };
}

interface BuilderState {
  survey: Survey;
  selectedPageId: string;
  selectedQuestionId: string | null;

  loadSurvey: (survey: Survey) => void;
  setSurveyTitle: (title: string) => void;

  addPage: () => void;
  removePage: (pageId: string) => void;
  selectPage: (pageId: string) => void;
  setPageTitle: (pageId: string, title: string) => void;
  setDefaultNextPage: (pageId: string, nextPageId: string | 'end') => void;
  setBranchRules: (pageId: string, branch: SurveyPage['branch']) => void;

  addQuestion: (pageId: string, type: QuestionType, atIndex?: number) => void;
  duplicateQuestion: (questionId: string) => void;
  removeQuestion: (questionId: string) => void;
  reorderQuestion: (pageId: string, fromIndex: number, toIndex: number) => void;
  selectQuestion: (questionId: string | null) => void;
  updateQuestion: (questionId: string, patch: Partial<QuestionDef>) => void;
  setVisibilityRule: (questionId: string, group: ConditionGroup | null) => void;

  setScoringEnabled: (enabled: boolean) => void;
  setScoringForQuestion: (questionId: string, entry: ScoringEntry | undefined) => void;
  setPassThreshold: (threshold: number | undefined) => void;
  setScoringCategories: (categories: { id: string; label: string }[]) => void;

  history: { past: Survey[]; future: Survey[] };
  undo: () => void;
  redo: () => void;
}

const HISTORY_LIMIT = 50;

function findPageContainingQuestion(survey: Survey, questionId: string): SurveyPage | undefined {
  return survey.pages.find((p) => p.questions.some((q) => q.id === questionId));
}

function allFieldIds(survey: Survey): Set<string> {
  return new Set(survey.pages.flatMap((p) => p.questions.map((q) => q.id)));
}

const initialSurvey = newSurvey();

export const useBuilderStore = create<BuilderState>((set, get) => ({
  survey: initialSurvey,
  selectedPageId: initialSurvey.pages[0].id,
  selectedQuestionId: null,
  history: { past: [], future: [] },

  loadSurvey: (survey) => {
    // Marked as a time-travel event (even though it isn't undo/redo) so the
    // history subscriber doesn't record a transition *into* this survey from
    // whatever was previously loaded -- that would let undo cross between
    // unrelated surveys after a client-side route change.
    isTimeTraveling = true;
    set({
      survey,
      selectedPageId: survey.pages[0]?.id ?? '',
      selectedQuestionId: null,
      history: { past: [], future: [] },
    });
    isTimeTraveling = false;
  },

  setSurveyTitle: (title) =>
    set((s) => ({ survey: { ...s.survey, title, updatedAt: new Date().toISOString() } })),

  addPage: () =>
    set((s) => {
      const page = emptyPage(`Page ${s.survey.pages.length + 1}`);
      const pages = [...s.survey.pages];
      // wire the previously-last page's default next to the new page, keeping a linear default flow
      const last = pages[pages.length - 1];
      if (last) pages[pages.length - 1] = { ...last, defaultNextPageId: page.id };
      pages.push(page);
      return {
        survey: { ...s.survey, pages, updatedAt: new Date().toISOString() },
        selectedPageId: page.id,
        selectedQuestionId: null,
      };
    }),

  removePage: (pageId) =>
    set((s) => {
      if (s.survey.pages.length <= 1) return s;
      const pages = s.survey.pages.filter((p) => p.id !== pageId);
      const fixed = pages.map((p) => ({
        ...p,
        defaultNextPageId: p.defaultNextPageId === pageId ? 'end' : p.defaultNextPageId,
        branch: p.branch.filter((b) => b.goToPageId !== pageId),
      }));
      const startPageId = s.survey.startPageId === pageId ? fixed[0].id : s.survey.startPageId;
      return {
        survey: { ...s.survey, pages: fixed, startPageId, updatedAt: new Date().toISOString() },
        selectedPageId: s.selectedPageId === pageId ? fixed[0].id : s.selectedPageId,
      };
    }),

  selectPage: (pageId) => set({ selectedPageId: pageId, selectedQuestionId: null }),

  setPageTitle: (pageId, title) =>
    set((s) => ({
      survey: {
        ...s.survey,
        updatedAt: new Date().toISOString(),
        pages: s.survey.pages.map((p) => (p.id === pageId ? { ...p, title } : p)),
      },
    })),

  setDefaultNextPage: (pageId, nextPageId) =>
    set((s) => ({
      survey: {
        ...s.survey,
        updatedAt: new Date().toISOString(),
        pages: s.survey.pages.map((p) =>
          p.id === pageId ? { ...p, defaultNextPageId: nextPageId } : p,
        ),
      },
    })),

  setBranchRules: (pageId, branch) =>
    set((s) => ({
      survey: {
        ...s.survey,
        updatedAt: new Date().toISOString(),
        pages: s.survey.pages.map((p) => (p.id === pageId ? { ...p, branch } : p)),
      },
    })),

  addQuestion: (pageId, type, atIndex) =>
    set((s) => {
      const meta = questionTypeMeta(type);
      const id = newFieldId(allFieldIds(s.survey), type);
      const question: QuestionDef = {
        id,
        type,
        label: meta.defaultLabel,
        ...(type === 'singleChoice' || type === 'multipleChoice'
          ? { choices: ['Option 1', 'Option 2'] }
          : {}),
      };
      const pages = s.survey.pages.map((p) => {
        if (p.id !== pageId) return p;
        const questions = [...p.questions];
        const index = atIndex === undefined ? questions.length : atIndex;
        questions.splice(index, 0, question);
        return recompilePage({ ...p, questions });
      });
      return {
        survey: { ...s.survey, pages, updatedAt: new Date().toISOString() },
        selectedQuestionId: id,
        selectedPageId: pageId,
      };
    }),

  duplicateQuestion: (questionId) =>
    set((s) => {
      const page = findPageContainingQuestion(s.survey, questionId);
      const original = page?.questions.find((q) => q.id === questionId);
      if (!page || !original) return s;
      const copyId = newFieldId(allFieldIds(s.survey), original.type);
      const copy: QuestionDef = { ...original, id: copyId, label: `${original.label} (copy)` };
      const pages = s.survey.pages.map((p) => {
        if (p.id !== page.id) return p;
        const index = p.questions.findIndex((q) => q.id === questionId);
        const questions = [...p.questions];
        questions.splice(index + 1, 0, copy);
        return recompilePage({ ...p, questions });
      });
      return {
        survey: { ...s.survey, pages, updatedAt: new Date().toISOString() },
        selectedQuestionId: copyId,
        selectedPageId: page.id,
      };
    }),

  removeQuestion: (questionId) =>
    set((s) => {
      const pages = s.survey.pages.map((p) => {
        if (!p.questions.some((q) => q.id === questionId)) return p;
        return recompilePage({ ...p, questions: p.questions.filter((q) => q.id !== questionId) });
      });
      const { [questionId]: _removed, ...scoringMap } = s.survey.scoringMap ?? {};
      return {
        survey: { ...s.survey, pages, scoringMap, updatedAt: new Date().toISOString() },
        selectedQuestionId: s.selectedQuestionId === questionId ? null : s.selectedQuestionId,
      };
    }),

  reorderQuestion: (pageId, fromIndex, toIndex) =>
    set((s) => {
      const pages = s.survey.pages.map((p) => {
        if (p.id !== pageId) return p;
        const questions = [...p.questions];
        const [moved] = questions.splice(fromIndex, 1);
        questions.splice(toIndex, 0, moved);
        return recompilePage({ ...p, questions });
      });
      return { survey: { ...s.survey, pages, updatedAt: new Date().toISOString() } };
    }),

  selectQuestion: (questionId) => set({ selectedQuestionId: questionId }),

  updateQuestion: (questionId, patch) =>
    set((s) => {
      const pages = s.survey.pages.map((p) => {
        if (!p.questions.some((q) => q.id === questionId)) return p;
        const questions = p.questions.map((q) => (q.id === questionId ? { ...q, ...patch } : q));
        return recompilePage({ ...p, questions });
      });
      return { survey: { ...s.survey, pages, updatedAt: new Date().toISOString() } };
    }),

  setVisibilityRule: (questionId, group) => {
    get().updateQuestion(questionId, { visibilityRule: group });
  },

  setScoringEnabled: (enabled) =>
    set((s) => ({
      survey: {
        ...s.survey,
        scoring: { ...(s.survey.scoring ?? {}), enabled },
        updatedAt: new Date().toISOString(),
      },
    })),

  setScoringForQuestion: (questionId, entry) =>
    set((s) => {
      const scoringMap = { ...(s.survey.scoringMap ?? {}) };
      const scope = `#/properties/${questionId}`;
      if (entry) scoringMap[scope] = entry;
      else delete scoringMap[scope];
      return { survey: { ...s.survey, scoringMap, updatedAt: new Date().toISOString() } };
    }),

  setPassThreshold: (threshold) =>
    set((s) => ({
      survey: {
        ...s.survey,
        scoring: { ...(s.survey.scoring ?? { enabled: false }), passThreshold: threshold },
        updatedAt: new Date().toISOString(),
      },
    })),

  setScoringCategories: (categories) =>
    set((s) => ({
      survey: {
        ...s.survey,
        scoring: { ...(s.survey.scoring ?? { enabled: false }), categories },
        updatedAt: new Date().toISOString(),
      },
    })),

  undo: () => {
    const { survey, history } = get();
    if (history.past.length === 0) return;
    const previous = history.past.at(-1)!;
    isTimeTraveling = true;
    set({
      survey: previous,
      history: {
        past: history.past.slice(0, -1),
        future: [survey, ...history.future].slice(0, HISTORY_LIMIT),
      },
    });
    isTimeTraveling = false;
  },

  redo: () => {
    const { survey, history } = get();
    if (history.future.length === 0) return;
    const next = history.future[0];
    isTimeTraveling = true;
    set({
      survey: next,
      history: {
        past: [...history.past, survey].slice(-HISTORY_LIMIT),
        future: history.future.slice(1),
      },
    });
    isTimeTraveling = false;
  },
}));

// Records a history entry whenever `survey` changes for any reason other than
// undo/redo itself (which sets `isTimeTraveling` to skip re-recording the
// state it's restoring). Kept outside the action definitions above so none of
// the ~15 survey-mutating actions need to be rewritten to opt in individually.
let isTimeTraveling = false;
let previousSurveyForHistory = initialSurvey;
useBuilderStore.subscribe((state) => {
  if (isTimeTraveling) {
    previousSurveyForHistory = state.survey;
    return;
  }
  if (state.survey === previousSurveyForHistory) return;
  const justRecorded = previousSurveyForHistory;
  previousSurveyForHistory = state.survey;
  useBuilderStore.setState((s) => ({
    history: {
      past: [...s.history.past, justRecorded].slice(-HISTORY_LIMIT),
      future: [],
    },
  }));
});

export function selectedQuestion(state: BuilderState): QuestionDef | null {
  if (!state.selectedQuestionId) return null;
  const page = findPageContainingQuestion(state.survey, state.selectedQuestionId);
  return page?.questions.find((q) => q.id === state.selectedQuestionId) ?? null;
}

export function selectedPage(state: BuilderState): SurveyPage | undefined {
  return state.survey.pages.find((p) => p.id === state.selectedPageId);
}
