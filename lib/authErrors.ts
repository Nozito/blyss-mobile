/**
 * Traduction des erreurs d'authentification en messages clients.
 * Règle : jamais de code technique brut à l'écran (« invalid_credentials »,
 * « server_error »…). Un code inconnu retombe sur un message générique.
 */
const MESSAGES: Record<string, string> = {
  invalid_credentials: "Email ou mot de passe incorrect",
  invalid_login: "Email ou mot de passe incorrect",
  invalid_grant: "Email ou mot de passe incorrect",
  email_not_confirmed: "Email non confirmé — vérifie ta boîte mail",
  account_disabled: "Ce compte a été désactivé",
  user_not_found: "Aucun compte n'est associé à cet email",
  too_many_requests: "Trop de tentatives — réessaie dans quelques minutes",
  rate_limited: "Trop de tentatives — réessaie dans quelques minutes",
  server_error: "Connexion impossible — vérifie ton réseau et réessaie",
  network_error: "Connexion impossible — vérifie ton réseau et réessaie",
  email_exists: "Cet email est déjà utilisé",
  phone_exists: "Ce numéro de téléphone est déjà utilisé",
  weak_password: "Mot de passe trop faible (8 car., 1 majuscule, 1 chiffre, 1 caractère spécial)",
  invalid_password: "Mot de passe trop long (128 caractères max.)",
  age_restriction: "Tu dois avoir au moins 16 ans",
  invalid_phone: "Numéro de téléphone invalide",
  invalid_email: "Email invalide",
  missing_fields: "Il manque des informations",
  data_too_long: "Un champ est trop long",
  invalid_token: "Lien invalide ou expiré, demande un nouveau lien",
  token_expired: "Lien invalide ou expiré, demande un nouveau lien",
};

/** « invalid_credentials », « rate.limit », « token-expired »… */
const looksLikeCode = (s: string) => /^[a-z][a-z0-9]*([_.-][a-z0-9]+)+$/.test(s.trim());

export function authErrorMessage(
  raw: string | undefined | null,
  fallback = "Une erreur est survenue, réessaie"
): string {
  if (!raw) return fallback;
  const trimmed = raw.trim();
  const key = trimmed.toLowerCase().replace(/[\s-]+/g, "_");
  if (MESSAGES[key]) return MESSAGES[key];

  const r = trimmed.toLowerCase();
  if (r.includes("invalid login") || r.includes("invalid credential") || r.includes("incorrect"))
    return MESSAGES.invalid_credentials;
  if (r.includes("not confirmed")) return MESSAGES.email_not_confirmed;
  if (r.includes("too many") || r.includes("rate limit")) return MESSAGES.too_many_requests;
  if (r.includes("network") || r.includes("réseau") || r.includes("internet")) return MESSAGES.server_error;

  // Phrase déjà rédigée pour l'utilisateur → on la garde ; un code → générique.
  return looksLikeCode(trimmed) ? fallback : trimmed;
}
