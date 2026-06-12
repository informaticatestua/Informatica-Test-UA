// migrate-pgmeta.mjs
// Usa el API interno pg-meta de Supabase (disponible vía el endpoint de cada proyecto).
// Este endpoint acepta el service_role key y ejecuta SQL arbitrario.
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dir = dirname(fileURLToPath(import.meta.url));

const PROJECT_REF  = "lwtyzqemiipprusmdaor";
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_ROLE) {
  console.error("❌ SUPABASE_SERVICE_ROLE_KEY not set in .env");
  console.error("   Copy .env.example to .env and fill in your service role key");
  process.exit(1);
}

const sqlFile = join(__dir, "..", "supabase", "migrations", "008_forum_schema_update.sql");
const sql = readFileSync(sqlFile, "utf-8");

// Endpoints a probar en orden
const endpoints = [
  `https://${PROJECT_REF}.supabase.co/rest/v1/rpc/query`,
  `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
  `https://${PROJECT_REF}.supabase.co/pg/query`,
  `https://${PROJECT_REF}.supabase.co/pg`,
  `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/migrations`,
];

console.log("🔍 Buscando endpoint disponible para ejecutar SQL DDL…\n");

for (const url of endpoints) {
  console.log(`Probando: ${url}`);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SERVICE_ROLE,
        "Authorization": `Bearer ${SERVICE_ROLE}`,
      },
      body: JSON.stringify({ query: sql, sql }),
    });
    const text = await res.text();
    console.log(`  Status: ${res.status} → ${text.slice(0, 150)}\n`);
    
    if (res.status === 200 || res.status === 201) {
      console.log("✅ Endpoint encontrado y migración ejecutada!");
      process.exit(0);
    }
  } catch (e) {
    console.log(`  Error: ${e.message}\n`);
  }
}

console.log("\n❌ No se encontró endpoint disponible para DDL arbitrario.");
console.log("\n📋 INSTRUCCIÓN MANUAL:");
console.log("   1. Ve a: https://supabase.com/dashboard/project/lwtyzqemiipprusmdaor/sql/new");
console.log("   2. Pega el contenido de: supabase/migrations/008_forum_schema_update.sql");
console.log("   3. Pulsa Run\n");
