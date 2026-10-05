import { create } from 'zustand';
import { flowLayoutRepository } from '../../storage/flowLayoutRepository';

export interface FlowPosition {
  x: number;
  y: number;
}

interface FlowLayoutState {
  surveyId: string | null;
  // Manually-dragged positions the author has set, overlaid on the
  // auto-layout result. A page with no entry here just uses auto-layout.
  overrides: Record<string, FlowPosition>;

  loadForSurvey: (surveyId: string) => Promise<void>;
  setOverride: (pageId: string, position: FlowPosition) => void;
  clearOverride: (pageId: string) => void;
}

let latestRequestId = 0;

export const useFlowLayoutStore = create<FlowLayoutState>((set, get) => ({
  surveyId: null,
  overrides: {},

  loadForSurvey: async (surveyId) => {
    const requestId = ++latestRequestId;
    const record = await flowLayoutRepository.get(surveyId);
    // Guard against a slow load resolving after the user has already
    // navigated to a different survey (a newer call has since started).
    if (requestId !== latestRequestId) return;
    set({ surveyId, overrides: record?.positions ?? {} });
  },

  setOverride: (pageId, position) => {
    const { surveyId } = get();
    set((s) => ({ overrides: { ...s.overrides, [pageId]: position } }));
    if (surveyId) void flowLayoutRepository.savePosition(surveyId, pageId, position);
  },

  clearOverride: (pageId) => {
    const { surveyId } = get();
    set((s) => {
      const { [pageId]: _removed, ...overrides } = s.overrides;
      return { overrides };
    });
    if (surveyId) void flowLayoutRepository.removePosition(surveyId, pageId);
  },
}));
