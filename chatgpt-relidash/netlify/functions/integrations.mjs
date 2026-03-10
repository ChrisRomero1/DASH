import { neon } from "@netlify/neon";

const sql = neon();

async function init() {
  await sql`
    CREATE TABLE IF NOT EXISTS integrations (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
}

export default async (req) => {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  try {
    await init();

    if (req.method === "GET") {
      const rows = await sql`SELECT key, value FROM integrations`;
      const integrations = {};
      rows.forEach(r => { integrations[r.key] = r.value; });
      return new Response(JSON.stringify({ integrations }), { status: 200, headers });
    }

    if (req.method === "POST") {
      const { key, value } = await req.json();
      await sql`
        INSERT INTO integrations (key, value, updated_at)
        VALUES (${key}, ${value}, NOW())
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
      `;
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });

  } catch (err) {
    console.error("integrations fn error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
  }
};

export const config = { path: "/api/integrations" };
