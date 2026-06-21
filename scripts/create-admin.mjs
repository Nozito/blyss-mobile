// scripts/create-admin.mjs
// Usage : API_URL=https://app.blyssapp.fr DB_URL=postgresql://... NOAH_PASSWORD=xxx node scripts/create-admin.mjs
// ⚠️ À exécuter UNE SEULE FOIS en environnement de production — ne pas committer avec de vrais secrets

const API_URL = process.env.API_URL;
const DB_URL  = process.env.DB_URL;

if (!API_URL) { console.error("❌ API_URL manquant"); process.exit(1); }
if (!process.env.NOAH_PASSWORD) { console.error("❌ NOAH_PASSWORD manquant"); process.exit(1); }

const NOAH = {
  first_name:     "Noah",
  last_name:      "DEKEYZER",
  email:          "noah@blyss.fr",
  password:       process.env.NOAH_PASSWORD,
  phone_number:   process.env.NOAH_PHONE ?? "0600000000",  // override via NOAH_PHONE
  birth_date:     process.env.NOAH_BIRTH ?? "1995-01-01",  // override via NOAH_BIRTH
  role:           "pro",
  accepted_terms: true,
};

console.log(`📡 Création du compte ${NOAH.first_name} ${NOAH.last_name} sur ${API_URL}...`);

const signupRes = await fetch(`${API_URL}/api/auth/signup`, {
  method:  "POST",
  headers: { "Content-Type": "application/json" },
  body:    JSON.stringify(NOAH),
});

const signupJson = await signupRes.json();
if (!signupJson.success) {
  console.error("❌ Signup échoué :", signupJson.message ?? signupJson.error);
  process.exit(1);
}
console.log("✅ Compte créé — récupération de l'ID via login...");

const loginRes = await fetch(`${API_URL}/api/auth/login`, {
  method:  "POST",
  headers: { "Content-Type": "application/json" },
  body:    JSON.stringify({ email: NOAH.email, password: NOAH.password }),
});
const loginJson = await loginRes.json();
const userId = loginJson?.data?.user?.id;

if (!userId) {
  console.error("❌ Impossible de récupérer l'ID utilisateur :", JSON.stringify(loginJson));
  process.exit(1);
}
console.log(`✅ ID utilisateur : ${userId}`);

if (DB_URL) {
  const { default: pg } = await import("pg");
  const client = new pg.Client({ connectionString: DB_URL });
  await client.connect();
  const result = await client.query(
    "UPDATE users SET is_admin = true WHERE id = $1 RETURNING id, email, is_admin",
    [userId]
  );
  await client.end();

  if (result.rowCount === 0) {
    console.error(`❌ Aucun utilisateur trouvé avec id=${userId}`);
    process.exit(1);
  }
  console.log(`✅ Compte promu admin :`, result.rows[0]);
} else {
  console.warn("\n⚠️  DB_URL non fourni — promotion admin à faire manuellement :");
  console.warn(`   UPDATE users SET is_admin = true WHERE id = ${userId};`);
}

console.log("\n✅ Done. Infos de connexion :");
console.log(`   Email       : ${NOAH.email}`);
console.log(`   Mot de passe: (celui fourni via NOAH_PASSWORD)`);
console.log(`   is_admin    : true`);
