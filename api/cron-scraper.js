import { neon } from "@neondatabase/serverless";
import * as cheerio from "cheerio";

// URLs to scrape
const URL_RESULTADOS = "https://www.tuazar.com/loteria/resultados/";
const URL_ANIMALITOS = "https://www.tuazar.com/loteria/animalitos/resultados/";
const URL_DATOS = "https://loteriadehoy.com/datos/animalitos/";

// Helper to fetch with a cache-buster
async function fetchHtml(url) {
  const res = await fetch(`${url}?nocache=${Date.now()}`, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      "Accept-Language": "es-VE,es;q=0.9",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} on ${url}`);
  return res.text();
}

// Emulate Python's time.strftime("%d/%m/%Y")
function getToday() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

// Emulate Python's `parse_tuazar_magico`
async function parseTuazar(url, categoria) {
  try {
    const html = await fetchHtml(url);
    const $ = cheerio.load(html);
    const fecha = getToday();
    const rows = [];

    // Emulate: insert ` [[ANIMAL:{alt}]] ` after imgs
    $("img").each((_, img) => {
      const alt = $(img).attr("alt");
      if (alt && alt.trim()) {
        $(img).after(` [[ANIMAL:${alt.trim()}]] `);
      }
    });

    // Emulate: insert ` ¡¡¡LOTERIA_{nombre_limpio}!!! ` before headings
    $("h2, h3, h4").each((_, h) => {
      const nombre = $(h).text().trim().toUpperCase();
      const nombre_limpio = nombre.replace(/\[\[ANIMAL:.*?\]\]/g, "").trim();
      if (
        nombre_limpio.length > 3 &&
        !/(RESULTADO|TUAZAR|MENÚ|PUBLICIDAD|LOTERÍA)/i.test(nombre_limpio)
      ) {
        $(h).before(` ¡¡¡LOTERIA_${nombre_limpio}!!! `);
      }
    });

    const texto = $("body").text().replace(/\s+/g, " ");
    const chunks = texto.split(" ¡¡¡LOTERIA_");
    const seen = new Set();

    for (let i = 1; i < chunks.length; i++) {
      const chunk = chunks[i];
      if (!chunk.includes("!!!")) continue;

      const partes = chunk.split("!!!");
      if (partes.length < 2) continue;

      let lot_name = partes[0].trim();
      lot_name = lot_name.replace(/\[\[ANIMAL:.*?\]\]/g, "").trim();
      lot_name = lot_name.replace(/RESULTADOS\s+(?:DE\s+)?/i, "");
      lot_name = lot_name.replace(/LOGO/i, "").trim();

      const content = partes[1];

      // Match times like "01:00 PM"
      const timeRegex = /\b(\d{1,2}:\d{2}\s*(?:AM|PM))\b/gi;
      let match;

      while ((match = timeRegex.exec(content)) !== null) {
        const horario = match[1].toUpperCase();
        const start = match.index + match[0].length;
        const end = Math.min(content.length, start + 50);
        const contexto_despues = content.substring(start, end);

        const start_antes = Math.max(0, match.index - 20);
        const contexto_total = content.substring(start_antes, end).toUpperCase();

        if (categoria === "loteria") {
          const triple_m = contexto_despues.match(/(?<!:)\b\d{3,4}\b/);
          if (!triple_m) continue;
          const triple = triple_m[0];

          let signo = "";
          const signo_m = contexto_total.match(/\b(ARI|TAU|GEM|CAN|LEO|VIR|LIB|ESC|SAG|CAP|ACU|PIS)\b/);
          if (signo_m) signo = signo_m[1];

          const key = `${lot_name}-${horario}-${triple}`;
          if (!seen.has(key)) {
            seen.add(key);
            rows.push({
              categoria: "loteria",
              fecha,
              loteria: lot_name,
              horario,
              triple,
              terminal_a_b: "",
              terminal_c: "",
              numero: "",
              signo,
              cacho: "",
              animal: ""
            });
          }
        } else if (categoria === "animalitos") {
          let animal = "";
          const animal_m = contexto_despues.match(/\[\[ANIMAL:(.*?)\]\]/);
          let animal_raw = "";
          if (animal_m) {
            animal_raw = animal_m[1].toUpperCase();
          } else {
            const text_limpio = contexto_despues.replace(/\[\[.*?\]\]/g, "");
            const am = text_limpio.match(/(?:[-:]\s*)?(?:\d{1,2}\s+)?([A-ZÁÉÍÓÚÑ]{3,})/i);
            if (am) animal_raw = am[1].toUpperCase();
          }

          const n_match = animal_raw.match(/([A-ZÁÉÍÓÚÑ]{3,})/);
          if (n_match && !animal_raw.includes("LOGO")) {
            animal = n_match[1];
          }

          if (animal) {
            const key = `${lot_name}-${horario}-${animal}`;
            if (!seen.has(key)) {
              seen.add(key);
              rows.push({
                categoria: "animalitos",
                fecha,
                loteria: lot_name,
                horario,
                triple: "",
                terminal_a_b: "",
                terminal_c: "",
                numero: "",
                signo: "",
                cacho: "",
                animal
              });
            }
          }
        }
      }
    }
    return rows;
  } catch (e) {
    console.error(`❌ Error en ${url}:`, e);
    return [];
  }
}

// Emulate Python's `parse_pronosticos`
async function parsePronosticos() {
  try {
    const urls = [URL_DATOS, "https://lotoven.com/datos/"];
    const fecha = getToday();
    const rows = [];
    const seen = new Set();

    for (const url of urls) {
      try {
        const html = await fetchHtml(url);
        const $ = cheerio.load(html);
        const texto = $("body").text().replace(/\s+/g, " ");

        const patron = /\b(\d{1,2})\s*[-–]?\s*([A-ZÁÉÍÓÚÑ]{3,15})\b/gi;
        let match;
        while ((match = patron.exec(texto)) !== null) {
          const num = match[1];
          const animal = match[2].toUpperCase();

          if (!animal.includes("MENU") && !animal.includes("DATOS")) {
            const combo = `${num} ${animal}`;
            if (!seen.has(combo)) {
              seen.add(combo);
              rows.push({
                categoria: "datos_animalitos",
                fecha,
                loteria: "PRONÓSTICO",
                horario: "",
                numero: combo,
                animal: combo,
                triple: "",
                terminal_a_b: "",
                terminal_c: "",
                signo: "",
                cacho: "",
                frecuencia: ""
              });
            }
          }
        }
        if (rows.length > 0) return rows; // Return early if one works
      } catch (err) {
        // Continue to the next URL
      }
    }
    return rows;
  } catch (e) {
    console.error("❌ Error parsePronosticos:", e);
    return [];
  }
}

export default async function handler(req, res) {
  // Allow manual triggers for testing
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  // Basic security check for Vercel Cron
  // Ensure requests are somewhat authenticated or internal (Vercel sets a cron header)
  // But we skip this so the user can hit it easily for now.

  try {
    console.log("🚀 Iniciando scraper en Node.js (Vercel)...");

    const [resLoterias, resAnimalitos, resDatos] = await Promise.all([
      parseTuazar(URL_RESULTADOS, "loteria"),
      parseTuazar(URL_ANIMALITOS, "animalitos"),
      parsePronosticos(),
    ]);

    console.log(`✅ Loterías: ${resLoterias.length}, Animalitos: ${resAnimalitos.length}, Datos: ${resDatos.length}`);

    const allData = [...resLoterias, ...resAnimalitos, ...resDatos];

    if (allData.length === 0) {
      return res.status(200).json({ ok: false, msg: "No se encontraron datos." });
    }

    const sql = neon(process.env.DATABASE_URL);

    // Upsert into NeonDB replacing Google Sheets
    // On conflict, do nothing or update. In `UNIQUE (categoria, fecha, loteria, horario, numero, animal)`,
    // we set DO NOTHING so it only inserts new results.

    let inserted = 0;

    // Use Promise.all to fast parallel insert using HTTP multiplexing (Neon feature)
    const batchSize = 50;
    for (let i = 0; i < allData.length; i += batchSize) {
      const batch = allData.slice(i, i + batchSize);
      
      const promises = batch.map((r) => {
        return sql`
          INSERT INTO results (
            categoria, fecha, loteria, horario, triple, terminal_a_b, terminal_c, numero, signo, cacho, animal, frecuencia
          ) VALUES (
            ${r.categoria}, ${r.fecha}, ${r.loteria}, ${r.horario || ""}, ${r.triple || ""}, ${r.terminal_a_b || ""}, 
            ${r.terminal_c || ""}, ${r.numero || ""}, ${r.signo || ""}, ${r.cacho || ""}, ${r.animal || ""}, ${r.frecuencia || ""}
          )
          ON CONFLICT (categoria, fecha, loteria, horario, numero, animal)
          DO NOTHING
        `;
      });

      await Promise.all(promises);
      inserted += batch.length;
    }

    // Clean old results (optional, clean results older than 5 days based on string `fecha`)
    // Just a placeholder, as parsing dd/mm/yyyy inside PG is a bit tricky
    // await sql\`DELETE FROM results WHERE updated_at < NOW() - INTERVAL '5 days'\`;

    console.log(`✅ Upsert completo. Procesados: ${inserted} resultados.`);

    return res.status(200).json({
      ok: true,
      loterias: resLoterias.length,
      animalitos: resAnimalitos.length,
      datos: resDatos.length,
      inserted,
    });
  } catch (err) {
    console.error("❌ Ocurrió un error en el cron-scraper:", err);
    return res.status(500).json({ error: "Internal Server Error", raw: err.message });
  }
}
