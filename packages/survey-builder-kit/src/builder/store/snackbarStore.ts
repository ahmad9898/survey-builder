import { createStore } from 'zustand/vanilla';
import { createStoreContext } from '../../lib/createStoreContext';

export type SnackbarSeverity = 'error' | 'warning' | 'info' | 'success';

export interface SnackbarState {
  message: string | null;
  severity: SnackbarSeverity;
  showError: (message: string) => void;
  showWarning: (message: string) => void;
  showInfo: (message: string) => void;
  clear: () => void;
}

// A single per-instance toast queue (one message at a time) so validation
// rejections from anywhere -- the flow map today, potentially other surfaces
// later -- surface visibly instead of failing as a silent no-op. One store
// per mounted Builder instance (see SnackbarStoreContext below), not a
// shared module-level singleton.
export function createSnackbarStore() {
  return createStore<SnackbarState>((set) => ({
    message: null,
    severity: 'info',
    showError: (message) => set({ message, severity: 'error' }),
    // For a risk worth flagging but not blocking (e.g. a branch page with no
    // fallback) -- distinct from showError, which is reserved for an action
    // that was actually rejected.
    showWarning: (message) => set({ message, severity: 'warning' }),
    showInfo: (message) => set({ message, severity: 'info' }),
    clear: () => set({ message: null }),
  }));
}

export type SnackbarStoreApi = ReturnType<typeof createSnackbarStore>;

const { Context: SnackbarStoreContext, useBoundStore: useSnackbarStore, useStoreApi: useSnackbarStoreApi } =
  createStoreContext<SnackbarState>('useSnackbarStore');

export { SnackbarStoreContext, useSnackbarStore, useSnackbarStoreApi };
