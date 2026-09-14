import { useEffect, useState } from "react";
import { geoApi, type AddressSuggestion } from "@/lib/api";
import { cityMatchesSuggestion } from "@/lib/validation";
import { useDebounce } from "@/hooks/useDebounce";
import type { CityValidation as AddressValidation } from "@/hooks/useCitySearch";

export type { AddressValidation };

/**
 * Autocomplete + vérification d'une adresse française réelle (numéro + voie,
 * code postal), même principe que useCitySearch mais sur la Base Adresse
 * Nationale (api-adresse.data.gouv.fr) — utilisée par le profil public pro.
 *
 * La validation compare "<addressLine> <postalCode>" au `fullLabel` de
 * chaque suggestion ("12 Rue de la Paix 75002 Paris") via le même matcher
 * bidirectionnel que les villes (cityMatchesSuggestion, générique malgré son
 * nom) : le code postal doit correspondre à l'adresse tapée, pas juste être
 * 5 chiffres valides.
 */
export function useAddressSearch(addressLine: string, postalCode: string, active: boolean) {
  const debouncedQuery = useDebounce(addressLine.trim(), 250);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [validation, setValidation] = useState<AddressValidation>("unchecked");

  useEffect(() => {
    if (!active || debouncedQuery.length < 3) {
      setSuggestions([]);
      setValidation("unchecked");
      return;
    }
    let cancelled = false;
    setLoading(true);
    geoApi
      .searchAddresses(debouncedQuery)
      .then((res) => {
        if (cancelled) return;
        const data = res.success && res.data ? res.data : [];
        setSuggestions(data);
        if (res.degraded) {
          setValidation("unknown");
          return;
        }
        if (!postalCode.trim()) {
          setValidation("unchecked"); // code postal pas encore renseigné, rien à valider
          return;
        }
        const value = `${debouncedQuery} ${postalCode.trim()}`;
        setValidation(
          cityMatchesSuggestion(value, data.map((s) => ({ nom: s.fullLabel }))) ? "valid" : "invalid"
        );
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
  }, [active, debouncedQuery, postalCode]);

  return { debouncedQuery, suggestions, loading, validation, setSuggestions, setValidation };
}
