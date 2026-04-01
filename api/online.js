import { neon } from "@neondatabase/serverless";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const sql = neon(process.env.DATABASE_URL);

    // Users with heartbeat in last 30 seconds are considered online
    const rows = await sql`
      SELECT username, display_name
      FROM online_sessions
      WHERE last_heartbeat > NOW() - INTERVAL '30 seconds'
      ORDER BY display_name ASC
    `;

    return res.status(200).json({ users: rows });
  } catch (err) {
    console.error("Online users error:", err);
    return res.status(500).json({ users: [] });
  }
}
