import { neon } from "@neondatabase/serverless";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { username, display_name } = req.body || {};
  if (!username) return res.status(400).json({ error: "Missing username" });

  try {
    const sql = neon(process.env.DATABASE_URL);

    // Upsert: update last_heartbeat if exists, insert if not
    await sql`
      INSERT INTO online_sessions (username, display_name, last_heartbeat)
      VALUES (${username}, ${display_name || username}, NOW())
      ON CONFLICT (username)
      DO UPDATE SET last_heartbeat = NOW(), display_name = ${display_name || username}
    `;

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Heartbeat error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
