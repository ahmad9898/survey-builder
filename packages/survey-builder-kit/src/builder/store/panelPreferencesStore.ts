import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Editor-tool preferences (panel widths), not survey data -- deliberately
// kept out of the Zustand survey store / Dexie survey tables and persisted
// to localStorage instead, so they survive reloads without being part of
// any survey's saved document, and apply the same regardless of which
// survey is open.

export interface PanelSizing {
  default: number;
  min: number;
  max: number;
}

// The left "Pages" sidebar: a row is icon + drag handle + title + up to one
// status chip + count + expand chevron. The fixed elements alone (handle,
// icon, a chip like "Start", count, chevron) already run ~205-210px, so
// anything much below 260 squeezes the title down to a single truncated
// character -- unreadable, not just tight. Verified visually at 220 vs 260.
export const SIDEBAR_WIDTH: PanelSizing = { default: 280, min: 260, max: 480 };

// The right-hand panel: shared by Builder's Inspector, the flow map's
// overview, and the flow map's page panel (one width, not one per view).
// A branch rule's condition row (field + operator + value selects) is the
// tightest content; below ~300px those start crowding into each other.
export const RIGHT_PANEL_WIDTH: PanelSizing = { default: 340, min: 300, max: 600 };

interface PanelPreferencesState {
  sidebarWidth: number;
  rightPanelWidth: number;
  setSidebarWidth: (width: number) => void;
  setRightPanelWidth: (width: number) => void;
}

function clamp(value: number, sizing: PanelSizing): number {
  return Math.min(sizing.max, Math.max(sizing.min, value));
}

export const usePanelPreferencesStore = create<PanelPreferencesState>()(
  persist(
    (set) => ({
      sidebarWidth: SIDEBAR_WIDTH.default,
      rightPanelWidth: RIGHT_PANEL_WIDTH.default,
      setSidebarWidth: (width) => set({ sidebarWidth: clamp(width, SIDEBAR_WIDTH) }),
      setRightPanelWidth: (width) => set({ rightPanelWidth: clamp(width, RIGHT_PANEL_WIDTH) }),
    }),
    {
      name: 'survey-builder:panel-widths',
      version: 1,
    },
  ),
);
