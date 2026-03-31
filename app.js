// ╔══════════════════════════════════════════════════════════╗
// ║  LotoDía — Kiosk TV Mode  |  app.js                     ║
// ║  skill.json: Vue+Vite, light theme, kiosk carousel       ║
// ╚══════════════════════════════════════════════════════════╝

const CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRy8_sTXB8AQ9BwHR_G1ZQPaoBZ-woa4I1XdCZLapf4HsyQaubride3npFnXhDN_P85dizphkccFcfh/pub?gid=0&single=true&output=csv";

// ─── Config ───────────────────────────────────────────────
const CARDS_PER_PAGE  = 15;    // 5 cols × 3 rows
const AUTO_ADVANCE_MS = 8000;  // ms entre páginas de carrusel
const DATA_REFRESH_MS = 20000; // 20 segundos — refresco de datos

// ─── Animal Emoji Map (Venezuelan lottery animals) ────────
const ANIMAL_EMOJI = {
  // ── Primates ──
  MONO:        "🐒",  MICO:        "🐒",  CHIMPANCE:   "🐒",
  GORILA:      "🦍",
  // ── Felinos ──
  GATO:        "🐱",  LEON:        "🦁",  TIGRE:       "🐯",
  TIGRITA:     "🐯",  LEOPARDO:    "🐆",  CUNAGUARO:   "🐆",
  PANTERA:     "🐆",  JAGUAR:      "🐆",
  // ── Cánidos ──
  PERRO:       "🐕",  ZORRO:       "🦊",  LOBO:        "🐺",
  // ── Équidos ──
  CABALLO:     "🐴",  BURRO:       "🫏",  ASNO:        "🫏",
  MULO:        "🐴",  CEBRA:       "🦓",
  // ── Bovinos / Herbívoros ──
  TORO:        "🐂",  VACA:        "🐄",  BECERRO:     "🐄",
  VENADO:      "🦌",  ANTA:        "🦌",  CHIGÜIRE:    "🐹",
  // ── Roedores ──
  RATON:       "🐭",  RATÓN:       "🐭",  CONEJO:      "🐰",
  ARDILLA:     "🐿️",
  // ── Aves ──
  GALLINA:     "🐔",  POLLO:       "🐣",  PATO:        "🦆",
  PAVO:        "🦃",  AGUILA:      "🦅",  ÁGILA:       "🦅",
  GAVILÁN:     "🦅",  GAVILAN:     "🦅",  LORO:        "🦜",
  LORA:        "🦜",  PALOMA:      "🕊️",  CANARIO:     "🐦",
  ZUNZUN:      "🐦",  COLIBRÍ:     "🐦",  COLIBRI:     "🐦",
  GUACHARACO:  "🐦",  GUACHARO:    "🐦",  TURPIAL:     "🐦",
  FLAMENCO:    "🦩",  GARZA:       "🦢",  PELICANO:    "🦭",
  BUHO:        "🦉",  BÚHO:        "🦉",  LECHUZA:     "🦉",
  MURCIELAGO:  "🦇",  MURCIÉLAGO:  "🦇",
  // ── Reptiles / Anfibios ──
  IGUANA:      "🦎",  LAGARTO:     "🦎",  CAIMAN:      "🐊",
  COCODRILO:   "🐊",  TORTUGA:     "🐢",  CULEBRA:     "🐍",
  SERPIENTE:   "🐍",  ANACONDA:    "🐍",  RANA:        "🐸",
  SAPO:        "🐸",
  // ── Peces / Acuáticos ──
  PESCADO:     "🐟",  PEZ:         "🐟",  TIBURON:     "🦈",
  TIBURÓN:     "🦈",  DELFIN:      "🐬",  DELFÍN:      "🐬",
  BALLENA:     "🐳",  PULPO:       "🐙",  CANGREJO:    "🦀",
  CAMARÓN:     "🦐",  CAMARON:     "🦐",
  // ── Insectos ──
  MARIPOSA:    "🦋",  ABEJA:       "🐝",  AVISPA:      "🐝",
  ARAÑA:       "🕷️",  CIEMPIES:    "🐛",  CIEMPIÉS:    "🐛",
  GRILLO:      "🦗",  HORMIGA:     "🐜",  MOSCA:       "🪰",
  MOSQUITO:    "🦟",
  // ── Otros ──
  ELEFANTE:    "🐘",  HIPOPOTAMO:  "🦛",  JIRAFA:      "🦒",
  RINOCERONTE: "🦏",  OSO:         "🐻",  PUERCO:      "🐷",
  COCHINO:     "🐷",  CERDO:       "🐷",  CHIVO:       "🐐",
  OVEJA:       "🐑",  CARNERO:     "🐏",  MAPACHE:     "🦝",
  ZARIGÜEYA:   "🦨",  ZARIGUELLA:  "🦨",  NUTRIA:      "🦦",
  COATI:       "🦡",  CASTOR:      "🦫",  OSO_HORMIGUERO: "🐜",
};

function getAnimalEmoji(name) {
  if (!name) return "🎲";
  const key = name
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents for fallback
    .trim();
  // try exact match first
  if (ANIMAL_EMOJI[name.toUpperCase()]) return ANIMAL_EMOJI[name.toUpperCase()];
  // try normalized
  if (ANIMAL_EMOJI[key]) return ANIMAL_EMOJI[key];
  // partial match
  const found = Object.keys(ANIMAL_EMOJI).find((k) => key.includes(k) || k.includes(key));
  return found ? ANIMAL_EMOJI[found] : "🎲";
}

// ─── State ────────────────────────────────────────────────
let RAW        = [];
let FILTERED   = [];
let SLIDES     = [];   // array of arrays (each = one page)
let CURRENT_CAT = "loteria";
let CURRENT_PAGE = 0;
let autoTimer  = null;
let progressRaf = null;
let progressStart = null;

// ─── DOM refs ─────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
const el = {
  clock:       $("clock"),
  topDate:     $("topDate"),
  statTotal:   $("statTotal"),
  statLoterias:$("statLoterias"),
  refreshBtn:  $("refreshBtn"),
  lotSel:      $("lotSel"),
  q:           $("q"),
  tabLoteria:  $("tabLoteria"),
  tabAnimalitos:$("tabAnimalitos"),
  cntLoteria:  $("cntLoteria"),
  cntAnimalitos:$("cntAnimalitos"),
  s1:          $("s1"),
  s2:          $("s2"),
  s3:          $("s3"),
  s4:          $("s4"),
  lastTime:    $("lastTime"),
  sectionTitle:$("sectionTitle"),
  pageInfo:    $("pageInfo"),
  prevBtn:     $("prevBtn"),
  nextBtn:     $("nextBtn"),
  carousel:    $("carouselTrack"),
  dots:        $("carouselDots"),
  progress:    $("progressFill"),
  loading:     $("loadingOverlay"),
};

// ─── Clock ────────────────────────────────────────────────
function tickClock() {
  const now = new Date();
  el.clock.textContent = now.toLocaleTimeString("es-VE");
  el.topDate.textContent = now.toLocaleDateString("es-VE", {
    weekday: "long", day: "2-digit", month: "long", year: "numeric"
  });
}
tickClock();
setInterval(tickClock, 1000);

// ─── CSV Parser ───────────────────────────────────────────
function parseCSV(text) {
  const rows = text
    .trim()
    .split("\n")
    .map((r) =>
      r.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map((v) =>
        v.replace(/^"|"$/g, "").trim()
      )
    );
  const headers = rows.shift().map((h) => h.toLowerCase());
  return rows.map((r) => {
    const o = {};
    headers.forEach((h, i) => (o[h] = r[i] || ""));
    return {
      categoria:   o.categoria   || "loteria",
      fecha:       o.fecha       || "",
      loteria:     o.loteria     || "",
      horario:     o.horario     || "",
      triple:      o.triple      || "",
      terminal_a_b:o.terminal_a_b|| "",
      terminal_c:  o.terminal_c  || "",
      numero:      o.numero      || "",
      signo:       o.signo       || "",
      cacho:       o.cacho       || "",
      animal:      o.animal      || "",
    };
  });
}

// ─── Helpers ──────────────────────────────────────────────
function uniq(arr) { return [...new Set(arr)].filter(Boolean); }

function esc(s) {
  return String(s).replace(/[&<>"']/g, (m) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m])
  );
}

function chunkArray(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// ─── Build Cards ──────────────────────────────────────────
function cardHtml(r) {
  const isAnim = r.categoria === "animalitos";

  let mainBlock;
  if (isAnim) {
    const emoji = getAnimalEmoji(r.animal);
    mainBlock = `
      <div class="card-animal-wrap">
        <span class="card-emoji" role="img" aria-label="${esc(r.animal)}">${emoji}</span>
        <div class="card-animal">${esc(r.animal || "—")}</div>
      </div>`;
  } else {
    mainBlock = `<div class="card-number">${esc(r.triple || r.numero || "—")}</div>`;
  }

  const tags = !isAnim ? `
    <div class="card-tags">
      ${r.terminal_a_b ? `<span class="ctag hl">${esc(r.terminal_a_b)}</span>` : ""}
      ${r.terminal_c   ? `<span class="ctag">${esc(r.terminal_c)}</span>` : ""}
      ${r.signo        ? `<span class="ctag">${esc(r.signo)}</span>` : ""}
      ${r.cacho        ? `<span class="ctag">${esc(r.cacho)}</span>` : ""}
    </div>` : "";

  return `
    <div class="result-card${isAnim ? " card-anim" : ""}">
      <div class="card-lottery">${esc(r.loteria || "—")}</div>
      <div class="card-time">${esc(r.horario || r.fecha || "—")}</div>
      ${mainBlock}
      ${tags}
    </div>`;
}

// ─── Render Carousel ──────────────────────────────────────
function buildCarousel() {
  SLIDES = chunkArray(FILTERED, CARDS_PER_PAGE);
  CURRENT_PAGE = 0;

  if (SLIDES.length === 0) {
    el.carousel.innerHTML = `
      <div class="carousel-slide">
        <div class="state-box">
          <div class="state-icon">📋</div>
          <div class="state-msg">Sin resultados con esos filtros</div>
          <div class="state-sub">Prueba ajustando los filtros del panel izquierdo</div>
        </div>
      </div>`;
    el.dots.innerHTML = "";
    el.pageInfo.textContent = "Sin resultados";
    stopAutoAdvance();
    return;
  }

  // Build slides HTML
  el.carousel.innerHTML = SLIDES.map((page, idx) => `
    <div class="carousel-slide" data-idx="${idx}">
      <div class="results-grid">
        ${page.map(cardHtml).join("")}
      </div>
    </div>
  `).join("");

  // Build dots
  el.dots.innerHTML = SLIDES.map((_, i) =>
    `<div class="dot-item${i === 0 ? " active" : ""}" data-dot="${i}"></div>`
  ).join("");

  el.dots.querySelectorAll(".dot-item").forEach((dot) => {
    dot.addEventListener("click", () => goToPage(+dot.dataset.dot));
  });

  goToPage(0, false);
  startAutoAdvance();
}

function goToPage(idx, animate = true) {
  if (!SLIDES.length) return;
  CURRENT_PAGE = (idx + SLIDES.length) % SLIDES.length;

  // Slide the track
  if (!animate) el.carousel.style.transition = "none";
  el.carousel.style.transform = `translateX(-${CURRENT_PAGE * 100}%)`;
  if (!animate) requestAnimationFrame(() => { el.carousel.style.transition = ""; });

  // Update dots
  el.dots.querySelectorAll(".dot-item").forEach((d, i) =>
    d.classList.toggle("active", i === CURRENT_PAGE)
  );

  // Update page info
  el.pageInfo.textContent = `Pág. ${CURRENT_PAGE + 1} / ${SLIDES.length}`;

  // Restart progress
  if (animate) resetProgress();
}

// ─── Navigation buttons ───────────────────────────────────
el.prevBtn.addEventListener("click", () => { goToPage(CURRENT_PAGE - 1); resetAutoAdvance(); });
el.nextBtn.addEventListener("click", () => { goToPage(CURRENT_PAGE + 1); resetAutoAdvance(); });

// Keyboard nav
document.addEventListener("keydown", (e) => {
  if (e.key === "ArrowRight" || e.key === "ArrowDown") { goToPage(CURRENT_PAGE + 1); resetAutoAdvance(); }
  if (e.key === "ArrowLeft"  || e.key === "ArrowUp")   { goToPage(CURRENT_PAGE - 1); resetAutoAdvance(); }
});

// ─── Auto-advance ─────────────────────────────────────────
function startAutoAdvance() {
  stopAutoAdvance();
  resetProgress();
  autoTimer = setInterval(() => {
    goToPage(CURRENT_PAGE + 1);
  }, AUTO_ADVANCE_MS);
}

function stopAutoAdvance() {
  if (autoTimer) { clearInterval(autoTimer); autoTimer = null; }
  if (progressRaf) { cancelAnimationFrame(progressRaf); progressRaf = null; }
}

function resetAutoAdvance() {
  startAutoAdvance();
}

function resetProgress() {
  if (progressRaf) cancelAnimationFrame(progressRaf);
  progressStart = null;
  el.progress.style.transition = "none";
  el.progress.style.width = "0%";
  requestAnimationFrame(() => {
    el.progress.style.transition = `width ${AUTO_ADVANCE_MS}ms linear`;
    el.progress.style.width = "100%";
  });
}

// ─── Filters ──────────────────────────────────────────────
function applyFilters() {
  const lot = el.lotSel.value;
  const q   = el.q.value.toLowerCase();
  const base = RAW.filter((r) => (r.categoria || "loteria") === CURRENT_CAT);

  FILTERED = base.filter((r) => {
    if (lot && r.loteria !== lot) return false;
    if (!q) return true;
    return Object.values(r).join(" ").toLowerCase().includes(q);
  });

  buildCarousel();
  updateStats();
}

el.lotSel.addEventListener("change", applyFilters);
el.q.addEventListener("input", applyFilters);

// ─── Category tabs ────────────────────────────────────────
[el.tabLoteria, el.tabAnimalitos].forEach((btn) => {
  btn.addEventListener("click", () => {
    CURRENT_CAT = btn.dataset.cat || btn.id.replace("tab", "").toLowerCase();
    [el.tabLoteria, el.tabAnimalitos].forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");

    // Update section title
    el.sectionTitle.innerHTML = CURRENT_CAT === "animalitos"
      ? `Resultados de <span class="hl">Animalitos</span>`
      : `Resultados de <span class="hl">Loterías</span>`;

    // Refresh lottery selector
    const catRows = RAW.filter((r) => (r.categoria || "loteria") === CURRENT_CAT);
    populateSelect(catRows);
    el.q.value = "";
    applyFilters();
  });
});

el.tabLoteria.dataset.cat   = "loteria";
el.tabAnimalitos.dataset.cat = "animalitos";

// ─── Populate select ──────────────────────────────────────
function populateSelect(rows) {
  const lots = uniq(rows.map((r) => r.loteria)).sort((a, b) => a.localeCompare(b));
  el.lotSel.innerHTML =
    `<option value="">Todas las loterías</option>` +
    lots.map((l) => `<option value="${esc(l)}">${esc(l)}</option>`).join("");
}

// ─── Stats ────────────────────────────────────────────────
function updateStats() {
  const lots = RAW.filter((r) => (r.categoria || "loteria") === "loteria");
  const anim = RAW.filter((r) => r.categoria === "animalitos");

  el.statTotal.textContent    = String(RAW.length);
  el.statLoterias.textContent = String(uniq(lots.map((r) => r.loteria)).length);
  el.s1.textContent           = String(lots.length);
  el.s2.textContent           = String(anim.length);

  const pages = Math.ceil(FILTERED.length / CARDS_PER_PAGE);
  el.s3.textContent = String(pages || 0);

  el.cntLoteria.textContent   = String(lots.length);
  el.cntAnimalitos.textContent= String(anim.length);
}

// ─── Load data ────────────────────────────────────────────
async function loadData() {
  el.loading.classList.remove("hidden");
  el.refreshBtn.disabled = true;
  stopAutoAdvance();

  try {
    const res = await fetch(CSV_URL, { cache: "no-store" });
    if (!res.ok) throw new Error("No se pudo cargar el CSV");

    const text = await res.text();
    RAW = parseCSV(text);

    el.lastTime.textContent = new Date().toLocaleTimeString("es-VE");

    const catRows = RAW.filter((r) => (r.categoria || "loteria") === CURRENT_CAT);
    populateSelect(catRows);
    el.q.value = "";
    applyFilters();
  } catch (err) {
    el.carousel.innerHTML = `
      <div class="carousel-slide">
        <div class="state-box">
          <div class="state-icon">⚠️</div>
          <div class="state-msg">Error cargando datos</div>
          <div class="state-sub">${esc(err.message)}</div>
        </div>
      </div>`;
    el.dots.innerHTML = "";
  } finally {
    el.refreshBtn.disabled = false;
    el.loading.classList.add("hidden");
  }
}

el.refreshBtn.addEventListener("click", loadData);

// ─── Auto-refresh every 20 seconds ───────────────────────
const REFRESH_SECS = DATA_REFRESH_MS / 1000;
let countdown = REFRESH_SECS;
const countdownEl = document.getElementById("countdownTxt");

function resetCountdown() {
  countdown = REFRESH_SECS;
}

// Countdown ticker (updates every second)
setInterval(() => {
  countdown = Math.max(0, countdown - 1);
  if (countdownEl) countdownEl.textContent = `${countdown}s`;
}, 1000);

// Data refresh interval
let dataRefreshTimer = setInterval(() => {
  loadData();
  resetCountdown();
}, DATA_REFRESH_MS);

// Reiniciar timer al hacer click manual
el.refreshBtn.addEventListener("click", () => {
  clearInterval(dataRefreshTimer);
  resetCountdown();
  dataRefreshTimer = setInterval(() => {
    loadData();
    resetCountdown();
  }, DATA_REFRESH_MS);
}, { capture: true });

// ─── Init ─────────────────────────────────────────────────
loadData();
