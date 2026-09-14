import { useEffect, useState } from "react";
import { geoApi, type CitySuggestion } from "@/lib/api";
import { cityMatchesSuggestion } from "@/lib/validation";
import { useDebounce } from "@/hooks/useDebounce";

export type CityValidation = "unchecked" | "valid" | "invalid" | "unknown";

/**
 * Autocomplete + vérification d'une ville française réelle, partagé entre
 * `CityAutocomplete` (paramètres pro) et l'étape ville de l'inscription
 * (poster UI différente, pas le même composant d'input).
 *
 * La route backend inclut `type=arrondissement-municipal` : "Paris 15",
 * "Lyon 3" font remonter directement "Paris 15e Arrondissement" / "Lyon 3e
 * Arrondissement" comme suggestions — pas besoin de tronquer la requête.
 * `cityMatchesSuggestion` reste tolérante par préfixe en repli (précisions
 * de quartier non numérotées type "Bordeaux Chartrons", non couvertes par
 * l'API communes).
 */
export function useCitySearch(value: string, active: boolean) {
  const debouncedQuery = useDebounce(value.trim(), 250);
  const [suggestions, setSuggestions] = useState<CitySuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [validation, setValidation] = useState<CityValidation>("unchecked");

  useEffect(() => {
    if (!active || debouncedQuery.length < 2) {
      setSuggestions([]);
      setValidation("unchecked");
      return;
    }
    let cancelled = false;
    setLoading(true);
    geoApi
      .searchCities(debouncedQuery)
      .then((res) => {
        if (cancelled) return;
        const data = res.success && res.data ? res.data : [];
        setSuggestions(data);
        if (res.degraded) {
          setValidation("unknown");
          return;
        }
        setValidation(cityMatchesSuggestion(debouncedQuery, data) ? "valid" : "invalid");
      })
      .catch(() => {
        if (!cancelled) {
          setSuggestions([]);
          setValidation("unknown");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [active, debouncedQuery]);

  return { debouncedQuery, suggestions, loading, validation, setSuggestions, setValidation };
}
