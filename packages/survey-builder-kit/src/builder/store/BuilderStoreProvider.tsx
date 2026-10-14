import { useRef, type ReactNode } from 'react';
import type { Survey } from '../../types/survey';
import { createBuilderStore, newSurvey, BuilderStoreContext, type BuilderStoreApi } from './builderStore';
import { createFlowLayoutStore, FlowLayoutStoreContext, type FlowLayoutStoreApi } from './flowLayoutStore';
import { createSnackbarStore, SnackbarStoreContext, type SnackbarStoreApi } from './snackbarStore';

interface InstanceStores {
  builder: BuilderStoreApi;
  flowLayout: FlowLayoutStoreApi;
  snackbar: SnackbarStoreApi;
}

// Creates one fresh set of stores for one mounted Builder instance and
// provides them to everything below it. `useRef` + a manual "already
// created" guard (not `useState(() => ...)`) is the pattern Zustand's own
// docs recommend for this: it guarantees exactly one store per mount even
// under StrictMode's double-invoked render in development.
export function BuilderStoreProvider({ initialSurvey, children }: { initialSurvey?: Survey; children: ReactNode }) {
  const storesRef = useRef<InstanceStores | null>(null);
  if (!storesRef.current) {
    const flowLayout = createFlowLayoutStore();
    const snackbar = createSnackbarStore();
    const builder = createBuilderStore({ flowLayoutStore: flowLayout, snackbarStore: snackbar }, initialSurvey ?? newSurvey());
    storesRef.current = { builder, flowLayout, snackbar };
  }
  const { builder, flowLayout, snackbar } = storesRef.current;

  return (
    <SnackbarStoreContext.Provider value={snackbar}>
      <FlowLayoutStoreContext.Provider value={flowLayout}>
        <BuilderStoreContext.Provider value={builder}>{children}</BuilderStoreContext.Provider>
      </FlowLayoutStoreContext.Provider>
    </SnackbarStoreContext.Provider>
  );
}
