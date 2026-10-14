import { createContext, useContext } from 'react';
import { useStore, type StoreApi } from 'zustand';

// Shared plumbing for the store-per-instance pattern: every store that backs
// a public component (Builder, Runner) needs a fresh instance per mount, not
// one shared module-level singleton -- otherwise two mounted instances (or
// the same survey open in two tabs) would silently share and clobber each
// other's state. Each store file calls this once to get back a `useXStore`
// hook (preserving the exact `useXStore((s) => s.field)` call-site syntax
// every consumer already uses) and a `useXStoreApi` hook for the rarer case
// that needs imperative `.getState()`/`.setState()` access.
export function createStoreContext<State>(storeName: string) {
  const Context = createContext<StoreApi<State> | null>(null);

  function useBoundStore<T>(selector: (state: State) => T): T {
    const store = useContext(Context);
    if (!store) {
      throw new Error(`${storeName}: no store found in context. Make sure this is rendered inside its Provider.`);
    }
    return useStore(store, selector);
  }

  function useStoreApi(): StoreApi<State> {
    const store = useContext(Context);
    if (!store) {
      throw new Error(`${storeName}: no store found in context. Make sure this is rendered inside its Provider.`);
    }
    return store;
  }

  return { Context, useBoundStore, useStoreApi };
}
