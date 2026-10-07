import { create } from 'zustand';

export type SnackbarSeverity = 'error' | 'warning' | 'info' | 'success';

interface SnackbarState {
  message: string | null;
  severity: SnackbarSeverity;
  showError: (message: string) => void;
  showWarning: (message: string) => void;
  showInfo: (message: string) => void;
  clear: () => void;
}

// A single app-wide toast queue (one message at a time) so validation
// rejections from anywhere -- the flow map today, potentially other surfaces
// later -- surface visibly instead of failing as a silent no-op.
export const useSnackbarStore = create<SnackbarState>((set) => ({
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
