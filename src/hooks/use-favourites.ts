import { useCallback, useEffect, useRef, useState } from "react";
import { loadState, updateState } from "@/lib/app-state";

/** Starred course uuids, persisted to state.json. */
export function useFavourites() {
  const [favourites, setFavourites] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  // Mirrors state so toggles compute from the latest value without a side-effecting updater.
  const latest = useRef(favourites);
  // A toggle before the saved list loads must not be overwritten by it.
  const touched = useRef(false);

  useEffect(() => {
    let cancelled = false;
    loadState()
      .then((state) => {
        if (cancelled || touched.current) return;
        latest.current = new Set(state.favourites ?? []);
        setFavourites(latest.current);
      })
      .catch((error) => console.error("Could not load favourites", error));
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleFavourite = useCallback((uuid: string) => {
    touched.current = true;
    const next = new Set(latest.current);
    if (!next.delete(uuid)) next.add(uuid);
    latest.current = next;
    setFavourites(next);
    updateState({ favourites: [...next] }).catch((error) =>
      console.error("Could not save favourites", error),
    );
  }, []);

  return { favourites, toggleFavourite };
}
