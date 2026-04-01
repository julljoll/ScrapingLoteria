import { neon } from "@neondatabase/serverless";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const sql = neon(process.env.DATABASE_URL);

    // Fetch the results updated recently. We will just fetch everything 
    // from today (based on string matching or limit).
    // Let's get today's date in 'dd/mm/yyyy' format
    const d = new Date();
    const today = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;

    // Get all results that have today's date
    const rows = await sql`
      SELECT 
        categoria, fecha, loteria, horario, triple, terminal_a_b, terminal_c, 
        numero, signo, cacho, animal, frecuencia
      FROM results 
      WHERE fecha = ${today}
    `;

    return res.status(200).json(rows);
  } catch (err) {
    console.error("Fetch results error:", err);
    return res.status(500).json({ error: "Server error retrieving results" });
  }
}
