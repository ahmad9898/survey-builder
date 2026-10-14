import { useRef, type ReactNode } from 'react';
import { createPlayerStore, PlayerStoreContext, type PlayerStoreApi } from './playerStore';

// Creates one fresh player store for one mounted Runner instance. See
// BuilderStoreProvider's comment for why this uses a `useRef` guard instead
// of `useState(() => ...)`.
export function PlayerStoreProvider({ children }: { children: ReactNode }) {
  const storeRef = useRef<PlayerStoreApi | null>(null);
  if (!storeRef.current) storeRef.current = createPlayerStore();

  return <PlayerStoreContext.Provider value={storeRef.current}>{children}</PlayerStoreContext.Provider>;
}
