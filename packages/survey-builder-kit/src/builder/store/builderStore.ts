import { createStore } from 'zustand/vanilla';
import { CURRENT_SCHEMA_VERSION, type BranchRule, type ConditionGroup, type QuestionDef, type QuestionType, type ScoringEntry, type Survey, type SurveyPage } from '../../types/survey';
import { compilePage } from '../../domain/schemaCompiler';
import { collapseSingleEdge, pageHasNoFallbackRisk } from '../../domain/branchInvariant';
import { newFieldId, newId, slugifyUnique } from '../../lib/id';
import { createStoreContext } from '../../lib/createStoreContext';
import { questionTypeMeta } from '../questionTypes';
import type { FlowLayoutStoreApi } from './flowLayoutStore';
import type { SnackbarStoreApi } from './snackbarStore';

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
    schemaVersion: CURRENT_SCHEMA_VERSION,
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    startPageId: firstPage.id,
    pages: [firstPage],
    scoring: { enabled: false },
    scoringMap: {},
  };
}

export type BuilderViewMode = 'builder' | 'flow';

export interface BuilderState {
  survey: Survey;
  // Nullable so "nothing is actively focused" is representable in the same
  // single field that drives the sidebar's highlight, the Builder canvas,
  // and the flow map's ring + panel -- there is deliberately no second,
  // parallel "is a node selected" flag that could disagree with this one.
  selectedPageId: string | null;
  selectedQuestionId: string | null;
  viewMode: BuilderViewMode;
  // The single most-recently-created question, if its id is still a
  // placeholder (newFieldId's type-based id, e.g. "shortText3") waiting to
  // be replaced by a slug of its real title -- see finalizeQuestionId. Only
  // ever one at a time (set by addQuestion, cleared by finalizeQuestionId),
  // and not persisted on the Survey itself: purely in-memory authoring-UI
  // state, reset to null on reload like selectedQuestionId.
  freshQuestionId: string | null;

  loadSurvey: (survey: Survey) => void;
  setSurveyTitle: (title: string) => void;
  setSurveyType: (type: string) => void;
  setViewMode: (mode: BuilderViewMode) => void;

  addPage: () => void;
  duplicatePage: (pageId: string) => void;
  removePage: (pageId: string) => void;
  reorderPage: (fromIndex: number, toIndex: number) => void;
  setStartPage: (pageId: string) => void;
  selectPage: (pageId: string) => void;
  clearSelectedPage: () => void;
  setPageTitle: (pageId: string, title: string) => void;
  setPageBlocksSubmission: (pageId: string, blocksSubmission: boolean) => void;
  setDefaultNextPage: (pageId: string, nextPageId: string | 'end') => void;
  setBranchRules: (pageId: string, branch: SurveyPage['branch']) => void;
  addBranchRule: (pageId: string, rule: BranchRule) => void;
  updateBranchRule: (pageId: string, ruleId: string, patch: Partial<BranchRule>) => void;
  removeBranchRule: (pageId: string, ruleId: string) => void;
  // Evaluation order for a page's conditioned rules IS their array order
  // (see resolveNextPage: first match wins, top to bottom) -- this is the
  // only way that order is ever changed, distinct from reorderPage, which is
  // deliberately cosmetic-only.
  reorderBranchRule: (pageId: string, fromIndex: number, toIndex: number) => void;

  addQuestion: (pageId: string, type: QuestionType, atIndex?: number) => void;
  duplicateQuestion: (questionId: string) => void;
  removeQuestion: (questionId: string) => void;
  reorderQuestion: (pageId: string, fromIndex: number, toIndex: number) => void;
  selectQuestion: (questionId: string | null) => void;
  // `id` deliberately excluded from the patch shape -- a question's id is
  // only ever auto-derived from its title once, right after creation (see
  // addQuestion/finalizeQuestionId); editing the title afterward must never
  // change it (branch/visibility conditions, scoringMap keys, and already-
  // saved responses all embed the id as a plain string, not a live
  // reference -- see finalizeQuestionId's own comment).
  updateQuestion: (questionId: string, patch: Partial<Omit<QuestionDef, 'id'>>) => void;
  // Call once the author is done naming a just-created question (e.g. the
  // title field's onBlur) -- replaces its placeholder id with a slug of its
  // current title, deduped survey-wide, but ONLY if this is still the
  // question addQuestion most recently created and nothing has finalized it
  // yet. A no-op every time after the first (including for every other,
  // already-locked question), by design -- see the field's own comment.
  finalizeQuestionId: (questionId: string) => void;
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

export interface BuilderStoreDeps {
  flowLayoutStore: FlowLayoutStoreApi;
  snackbarStore: SnackbarStoreApi;
}

// One store per mounted Builder instance (see BuilderStoreContext below),
// not a shared module-level singleton -- two instances editing different
// surveys (or the same survey in two tabs) must never share or clobber each
// other's survey/selection/undo-history state.
//
// `deps` wires in the sibling per-instance stores this one needs to call
// into directly: removePage() clears that page's saved canvas position in
// flowLayoutStore, and the no-fallback-branch warning goes through
// snackbarStore. Both must be the SAME instance's stores, not a different
// mounted Builder's -- the caller (BuilderProvider) is responsible for
// passing the co-created siblings, never a shared/global one.
export function createBuilderStore(deps: BuilderStoreDeps, initialSurvey: Survey = newSurvey()) {
  const { flowLayoutStore, snackbarStore } = deps;

  // Called after every branch-topology mutation (see setBranchRules /
  // setDefaultNextPage below) so the warning fires identically no matter
  // which UI surface triggered the change -- the flow map's popover or the
  // sidebar's Branching tab both funnel through these same two setters.
  function warnIfNoFallback(page: SurveyPage): void {
    if (pageHasNoFallbackRisk(page)) {
      snackbarStore
        .getState()
        .showWarning(
          `"${page.title}" has ${page.branch.length} conditions but no fallback -- a respondent who matches none of them would have nowhere to go.`,
        );
    }
  }

  // Records a history entry whenever `survey` changes for any reason other
  // than undo/redo itself (which flips this to skip re-recording the state
  // it's restoring). Per-instance closure state, not module-level -- each
  // store instance needs its own undo/redo bookkeeping, independent of any
  // other mounted instance's.
  let isTimeTraveling = false;
  let previousSurveyForHistory = initialSurvey;

  const store = createStore<BuilderState>((set, get) => ({
    survey: initialSurvey,
    selectedPageId: initialSurvey.pages[0]?.id ?? null,
    selectedQuestionId: null,
    freshQuestionId: null,
    viewMode: 'builder',
    history: { past: [], future: [] },

    loadSurvey: (survey) => {
      // Marked as a time-travel event (even though it isn't undo/redo) so
      // the history subscriber doesn't record a transition *into* this
      // survey from whatever was previously loaded -- that would let undo
      // cross between unrelated surveys after the host swaps the `survey`
      // prop.
      isTimeTraveling = true;
      set({
        survey,
        selectedPageId: survey.pages[0]?.id ?? null,
        selectedQuestionId: null,
        freshQuestionId: null,
        history: { past: [], future: [] },
      });
      isTimeTraveling = false;
    },

    setSurveyTitle: (title) =>
      set((s) => ({ survey: { ...s.survey, title, updatedAt: new Date().toISOString() } })),

    // The host/UI is responsible for passing already-sanitized input (see
    // BuilderHeader's Type field) -- this setter doesn't re-sanitize so
    // hand-authored/imported survey JSON isn't silently rewritten just by
    // loading it into the store.
    setSurveyType: (type) =>
      set((s) => ({ survey: { ...s.survey, type, updatedAt: new Date().toISOString() } })),

    setViewMode: (mode) => set({ viewMode: mode }),

    addPage: () =>
      set((s) => {
        // Deliberately NOT wired into the default flow: a page added this
        // way (from the sidebar or the flow map -- one action, so both stay
        // consistent) starts standalone and unreachable until the author
        // explicitly drags a connection to or from it. Auto-chaining it in
        // would silently commit the author to a flow order they never
        // chose.
        const page = emptyPage(`Page ${s.survey.pages.length + 1}`);
        const pages = [...s.survey.pages, page];
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
        // The deleted page's saved canvas position (if any) is meaningless
        // now; lives in a separate (this same instance's) store/Dexie
        // table, so it needs its own cleanup.
        flowLayoutStore.getState().clearOverride(pageId);
        return {
          survey: { ...s.survey, pages: fixed, startPageId, updatedAt: new Date().toISOString() },
          selectedPageId: s.selectedPageId === pageId ? fixed[0].id : s.selectedPageId,
        };
      }),

    reorderPage: (fromIndex, toIndex) =>
      set((s) => {
        const pages = [...s.survey.pages];
        const [moved] = pages.splice(fromIndex, 1);
        pages.splice(toIndex, 0, moved);
        return { survey: { ...s.survey, pages, updatedAt: new Date().toISOString() } };
      }),

    // Copies a page's questions (with fresh ids, since fields are unique
    // survey-wide) and any scoring configured for them, inserted right after
    // the original. Like addPage, the copy starts unconnected -- deliberately
    // NOT wired into the flow here, so this stays the one place a page gets
    // created; whoever calls this (e.g. a dot's "Duplicate page" menu item)
    // wires it in afterward through the same connect logic as a fresh page.
    duplicatePage: (pageId) =>
      set((s) => {
        const original = s.survey.pages.find((p) => p.id === pageId);
        if (!original) return s;
        const usedFieldIds = allFieldIds(s.survey);
        const scoringMap = { ...(s.survey.scoringMap ?? {}) };
        const questions = original.questions.map((q) => {
          const copyId = newFieldId(usedFieldIds, q.type);
          usedFieldIds.add(copyId);
          // scoringMap is keyed by JSON Schema scope ("#/properties/<id>"),
          // not the raw question id -- see setScoringForQuestion.
          const existingScoring = s.survey.scoringMap?.[`#/properties/${q.id}`];
          if (existingScoring) scoringMap[`#/properties/${copyId}`] = existingScoring;
          return { ...q, id: copyId, slug: copyId };
        });
        const copy = recompilePage({
          ...original,
          id: newId('page'),
          title: `${original.title} (copy)`,
          questions,
          branch: [],
          defaultNextPageId: 'end',
        });
        const index = s.survey.pages.findIndex((p) => p.id === pageId);
        const pages = [...s.survey.pages];
        pages.splice(index + 1, 0, copy);
        return {
          survey: { ...s.survey, pages, scoringMap, updatedAt: new Date().toISOString() },
          selectedPageId: copy.id,
          selectedQuestionId: null,
        };
      }),

    // The only intentional way to change where the survey begins --
    // reordering the list is deliberately cosmetic-only (see reorderPage)
    // and never touches this, so without an explicit action startPageId
    // could otherwise only ever change as a side effect of deleting the
    // current start page.
    setStartPage: (pageId) =>
      set((s) => ({
        survey: { ...s.survey, startPageId: pageId, updatedAt: new Date().toISOString() },
      })),

    selectPage: (pageId) => set({ selectedPageId: pageId, selectedQuestionId: null }),

    clearSelectedPage: () => set({ selectedPageId: null, selectedQuestionId: null }),

    setPageTitle: (pageId, title) =>
      set((s) => ({
        survey: {
          ...s.survey,
          updatedAt: new Date().toISOString(),
          pages: s.survey.pages.map((p) => (p.id === pageId ? { ...p, title } : p)),
        },
      })),

    // Checking "this page blocks submission" needs to actually stop the
    // flow here, not just change the page's icon/badge -- so turning it on
    // also routes the page's own default ("Otherwise") edge to End of
    // survey, the same real stop condition resolveNextPage already honors.
    // A branch rule on this page (routing some OTHER answer elsewhere) is
    // untouched -- a blocking page can still conditionally continue for an
    // answer that isn't the disqualifying one. Turning it back off leaves
    // defaultNextPageId as-is; re-wiring it is a manual "Otherwise, go to"
    // choice, same as for any other page.
    setPageBlocksSubmission: (pageId, blocksSubmission) =>
      set((s) => ({
        survey: {
          ...s.survey,
          updatedAt: new Date().toISOString(),
          pages: s.survey.pages.map((p) =>
            p.id === pageId
              ? { ...p, blocksSubmission, defaultNextPageId: blocksSubmission ? 'end' : p.defaultNextPageId }
              : p,
          ),
        },
      })),

    // The one place a page's default ("Otherwise") edge is written. Runs
    // the same collapse-to-one-edge invariant as removeBranchRule: clearing
    // the default can leave a single conditioned branch rule as the page's
    // only outgoing edge, which must revert to being plain/condition-free
    // too.
    setDefaultNextPage: (pageId, nextPageId) =>
      set((s) => {
        const page = s.survey.pages.find((p) => p.id === pageId);
        if (!page) return s;
        const updated = collapseSingleEdge({ ...page, defaultNextPageId: nextPageId });
        warnIfNoFallback(updated);
        return {
          survey: {
            ...s.survey,
            updatedAt: new Date().toISOString(),
            pages: s.survey.pages.map((p) => (p.id === pageId ? updated : p)),
          },
        };
      }),

    // Shared by addBranchRule/updateBranchRule/removeBranchRule below.
    // Deliberately does NOT run collapseSingleEdge itself -- adding a rule
    // can legitimately bring a page to exactly one (conditioned) edge, and
    // that must stay editable rather than being silently absorbed into
    // "Otherwise" the instant it's created (see collapseSingleEdge's own
    // comment). removeBranchRule calls collapseSingleEdge itself,
    // separately, since only removal should trigger that reversion.
    setBranchRules: (pageId, branch) =>
      set((s) => {
        const page = s.survey.pages.find((p) => p.id === pageId);
        if (!page) return s;
        const updated = { ...page, branch };
        warnIfNoFallback(updated);
        return {
          survey: {
            ...s.survey,
            updatedAt: new Date().toISOString(),
            pages: s.survey.pages.map((p) => (p.id === pageId ? updated : p)),
          },
        };
      }),

    addBranchRule: (pageId, rule) => {
      const page = get().survey.pages.find((p) => p.id === pageId);
      if (!page) return;
      get().setBranchRules(pageId, [...page.branch, rule]);
    },

    updateBranchRule: (pageId, ruleId, patch) => {
      const page = get().survey.pages.find((p) => p.id === pageId);
      if (!page) return;
      get().setBranchRules(
        pageId,
        page.branch.map((r) => (r.id === ruleId ? { ...r, ...patch } : r)),
      );
    },

    // The only mutator that can bring edge count DOWN to one -- so this is
    // the one that needs to check whether the sole remaining edge should
    // revert to being the plain, condition-free default (see
    // collapseSingleEdge).
    removeBranchRule: (pageId, ruleId) => {
      const page = get().survey.pages.find((p) => p.id === pageId);
      if (!page) return;
      const filtered = page.branch.filter((r) => r.id !== ruleId);
      const updated = collapseSingleEdge({ ...page, branch: filtered });
      warnIfNoFallback(updated);
      set((s) => ({
        survey: {
          ...s.survey,
          updatedAt: new Date().toISOString(),
          pages: s.survey.pages.map((p) => (p.id === pageId ? updated : p)),
        },
      }));
    },

    reorderBranchRule: (pageId, fromIndex, toIndex) =>
      set((s) => ({
        survey: {
          ...s.survey,
          updatedAt: new Date().toISOString(),
          pages: s.survey.pages.map((p) => {
            if (p.id !== pageId) return p;
            const branch = [...p.branch];
            const [moved] = branch.splice(fromIndex, 1);
            branch.splice(toIndex, 0, moved);
            return { ...p, branch };
          }),
        },
      })),

    addQuestion: (pageId, type, atIndex) =>
      set((s) => {
        const meta = questionTypeMeta(type);
        const id = newFieldId(allFieldIds(s.survey), type);
        const question: QuestionDef = {
          id,
          slug: id,
          title: meta.defaultLabel,
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
          // Starts fresh -- its placeholder id (e.g. "shortText3") is
          // eligible to be replaced by a slug of the title once the author
          // types one in and finishes (finalizeQuestionId).
          freshQuestionId: id,
        };
      }),

    duplicateQuestion: (questionId) =>
      set((s) => {
        const page = findPageContainingQuestion(s.survey, questionId);
        const original = page?.questions.find((q) => q.id === questionId);
        if (!page || !original) return s;
        const copyId = newFieldId(allFieldIds(s.survey), original.type);
        const copy: QuestionDef = {
          ...original,
          id: copyId,
          slug: copyId,
          title: `${original.title} (copy)`,
          label: `${original.label} (copy)`,
        };
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
          freshQuestionId: copyId,
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
          freshQuestionId: s.freshQuestionId === questionId ? null : s.freshQuestionId,
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

    // One-shot: only does anything the FIRST time it's called for whichever
    // question addQuestion/duplicateQuestion most recently created (tracked
    // by freshQuestionId) -- every later call, for this question or any
    // other, is a no-op. This is deliberately NOT a general-purpose
    // "rename id" action: it only ever fires once, right after creation,
    // before a brand-new question's id could plausibly be referenced
    // anywhere else (a branch/visibility condition, a scoringMap entry, a
    // saved response) -- those all embed the id as a plain string, not a
    // live reference, so renaming an id already in use elsewhere would
    // silently orphan those references. Renaming an *older* question's id
    // is intentionally not supported at all.
    finalizeQuestionId: (questionId) =>
      set((s) => {
        if (s.freshQuestionId !== questionId) return {};
        const page = findPageContainingQuestion(s.survey, questionId);
        const question = page?.questions.find((q) => q.id === questionId);
        if (!page || !question) return { freshQuestionId: null };

        const otherIds = allFieldIds(s.survey);
        otherIds.delete(questionId);
        const newId = slugifyUnique(question.title, otherIds, questionId);
        if (newId === questionId) return { freshQuestionId: null };

        const pages = s.survey.pages.map((p) => {
          if (p.id !== page.id) return p;
          const questions = p.questions.map((q) => (q.id === questionId ? { ...q, id: newId, slug: newId } : q));
          return recompilePage({ ...p, questions });
        });
        return {
          survey: { ...s.survey, pages, updatedAt: new Date().toISOString() },
          selectedQuestionId: s.selectedQuestionId === questionId ? newId : s.selectedQuestionId,
          freshQuestionId: null,
        };
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

  // Records a history entry whenever `survey` changes for any reason other
  // than undo/redo itself (which sets `isTimeTraveling` to skip re-recording
  // the state it's restoring). Kept outside the action definitions above so
  // none of the ~15 survey-mutating actions need to be rewritten to opt in
  // individually.
  store.subscribe((state) => {
    if (isTimeTraveling) {
      previousSurveyForHistory = state.survey;
      return;
    }
    if (state.survey === previousSurveyForHistory) return;
    const justRecorded = previousSurveyForHistory;
    previousSurveyForHistory = state.survey;
    store.setState((s) => ({
      history: {
        past: [...s.history.past, justRecorded].slice(-HISTORY_LIMIT),
        future: [],
      },
    }));
  });

  return store;
}

export type BuilderStoreApi = ReturnType<typeof createBuilderStore>;

const { Context: BuilderStoreContext, useBoundStore: useBuilderStore, useStoreApi: useBuilderStoreApi } =
  createStoreContext<BuilderState>('useBuilderStore');

export { BuilderStoreContext, useBuilderStore, useBuilderStoreApi };

export function selectedQuestion(state: BuilderState): QuestionDef | null {
  if (!state.selectedQuestionId) return null;
  const page = findPageContainingQuestion(state.survey, state.selectedQuestionId);
  return page?.questions.find((q) => q.id === state.selectedQuestionId) ?? null;
}

export function selectedPage(state: BuilderState): SurveyPage | undefined {
  return state.survey.pages.find((p) => p.id === state.selectedPageId);
}
