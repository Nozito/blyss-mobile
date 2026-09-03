import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * État de préférence UI persisté dans AsyncStorage (non sensible — pas
 * SecureStore). Rend `initial` immédiatement puis réhydrate la valeur
 * stockée si elle existe : jamais d'écran vide au démarrage.
 *
 * `hydrated` passe à true une fois la lecture AsyncStorage terminée.
 */
export function usePersistedState<T extends string>(
  key: string,
  initial: T
): [T, (value: T) => void, boolean] {
  const [value, setValue] = useState<T>(initial);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(key)
      .then((raw) => {
        if (alive && raw != null) setValue(raw as T);
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setHydrated(true);
      });
    return () => {
      alive = false;
    };
  }, [key]);

  const set = (next: T) => {
    setValue(next);
    AsyncStorage.setItem(key, next).catch(() => {});
  };

  return [value, set, hydrated];
}
