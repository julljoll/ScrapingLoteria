import { neon } from "@neondatabase/serverless";

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({ ok: false, error: "Usuario y contraseña son requeridos" });
  }

  try {
    const sql = neon(process.env.DATABASE_URL);

    const rows = await sql`
      SELECT id, username, display_name
      FROM users
      WHERE username = ${username}
        AND password_hash = ${password}
        AND active = true
    `;

    if (!rows.length) {
      return res.status(401).json({ ok: false, error: "Credenciales invalidas" });
    }

    const user = rows[0];

    return res.status(200).json({
      ok: true,
      user: {
        username: user.username,
        display_name: user.display_name,
      },
    });
  } catch (err) {
    console.error("Login DB error:", err);
    return res.status(500).json({ ok: false, error: "Error interno del servidor" });
  }
}
