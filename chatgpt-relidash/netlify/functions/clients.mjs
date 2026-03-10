import { neon } from "@netlify/neon";

const sql = neon();

// Auto-create table if it doesn't exist
async function init() {
  await sql`
    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY,
      name TEXT,
      biz TEXT,
      niche TEXT,
      tier TEXT,
      fee INTEGER,
      phone TEXT,
      email TEXT,
      start_date TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
}

export default async (req) => {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  try {
    await init();

    if (req.method === "GET") {
      const rows = await sql`SELECT * FROM clients ORDER BY created_at ASC`;
      const clients = rows.map(r => ({
        id: r.id, name: r.name, biz: r.biz, niche: r.niche,
        tier: r.tier, fee: r.fee, phone: r.phone, email: r.email,
        startDate: r.start_date
      }));
      return new Response(JSON.stringify({ clients }), { status: 200, headers });
    }

    if (req.method === "POST") {
      const c = await req.json();
      await sql`
        INSERT INTO clients (id, name, biz, niche, tier, fee, phone, email, start_date)
        VALUES (${c.id}, ${c.name}, ${c.biz}, ${c.niche}, ${c.tier}, ${c.fee}, ${c.phone}, ${c.email}, ${c.startDate})
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name, biz = EXCLUDED.biz, niche = EXCLUDED.niche,
          tier = EXCLUDED.tier, fee = EXCLUDED.fee, phone = EXCLUDED.phone,
          email = EXCLUDED.email, start_date = EXCLUDED.start_date
      `;
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
    }

    if (req.method === "DELETE") {
      const { id } = await req.json();
      await sql`DELETE FROM clients WHERE id = ${id}`;
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });

  } catch (err) {
    console.error("clients fn error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
  }
};

export const config = { path: "/api/clients" };
