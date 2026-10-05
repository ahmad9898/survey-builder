import { describe, expect, it } from 'vitest';
import { usePanelPreferencesStore, SIDEBAR_WIDTH, RIGHT_PANEL_WIDTH } from '../../src/builder/store/panelPreferencesStore';

describe('panelPreferencesStore', () => {
  it('starts at the documented default widths', () => {
    expect(usePanelPreferencesStore.getState().sidebarWidth).toBe(SIDEBAR_WIDTH.default);
    expect(usePanelPreferencesStore.getState().rightPanelWidth).toBe(RIGHT_PANEL_WIDTH.default);
  });

  it('clamps sidebar width to [min, max]', () => {
    usePanelPreferencesStore.getState().setSidebarWidth(1);
    expect(usePanelPreferencesStore.getState().sidebarWidth).toBe(SIDEBAR_WIDTH.min);

    usePanelPreferencesStore.getState().setSidebarWidth(99999);
    expect(usePanelPreferencesStore.getState().sidebarWidth).toBe(SIDEBAR_WIDTH.max);

    usePanelPreferencesStore.getState().setSidebarWidth(300);
    expect(usePanelPreferencesStore.getState().sidebarWidth).toBe(300);
  });

  it('clamps right panel width to [min, max]', () => {
    usePanelPreferencesStore.getState().setRightPanelWidth(1);
    expect(usePanelPreferencesStore.getState().rightPanelWidth).toBe(RIGHT_PANEL_WIDTH.min);

    usePanelPreferencesStore.getState().setRightPanelWidth(99999);
    expect(usePanelPreferencesStore.getState().rightPanelWidth).toBe(RIGHT_PANEL_WIDTH.max);

    usePanelPreferencesStore.getState().setRightPanelWidth(400);
    expect(usePanelPreferencesStore.getState().rightPanelWidth).toBe(400);
  });

  it('setting one panel width does not affect the other', () => {
    usePanelPreferencesStore.getState().setSidebarWidth(SIDEBAR_WIDTH.default);
    usePanelPreferencesStore.getState().setRightPanelWidth(RIGHT_PANEL_WIDTH.default);

    usePanelPreferencesStore.getState().setSidebarWidth(350);
    expect(usePanelPreferencesStore.getState().rightPanelWidth).toBe(RIGHT_PANEL_WIDTH.default);
  });
});
