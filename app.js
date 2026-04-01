// ╔══════════════════════════════════════════════════════════════╗
// ║  RESULTADO LOTERÍA LARA — Kiosk TV App                      ║
// ║  Login via Neon · Full-screen carousel · Marquee users      ║
// ╚══════════════════════════════════════════════════════════════╝

// ─── Config ───────────────────────────────────────────────
const CARDS_PER_PAGE  = 32;    // ~8 cols × 4 rows (200px cards)
const AUTO_ADVANCE_MS = 8000;
const DATA_REFRESH_MS = 20000;
const HEARTBEAT_MS    = 10000;
const ONLINE_POLL_MS  = 15000;

// ─── Animal Emoji Map ─────────────────────────────────────
const ANIMAL_EMOJI = {
  MONO:"🐒",MICO:"🐒",GORILA:"🦍",
  GATO:"🐱",LEON:"🦁",TIGRE:"🐯",TIGRITA:"🐯",LEOPARDO:"🐆",CUNAGUARO:"🐆",PANTERA:"🐆",JAGUAR:"🐆",
  PERRO:"🐕",ZORRO:"🦊",LOBO:"🐺",
  CABALLO:"🐴",BURRO:"🫏",ASNO:"🫏",MULO:"🐴",CEBRA:"🦓",
  TORO:"🐂",VACA:"🐄",BECERRO:"🐄",VENADO:"🦌",ANTA:"🦌",
  RATON:"🐭",CONEJO:"🐰",ARDILLA:"🐿️",
  GALLINA:"🐔",POLLO:"🐣",PATO:"🦆",PAVO:"🦃",AGUILA:"🦅",GAVILAN:"🦅",
  LORO:"🦜",LORA:"🦜",PALOMA:"🕊️",CANARIO:"🐦",TURPIAL:"🐦",
  GUACHARACO:"🐦",FLAMENCO:"🦩",BUHO:"🦉",LECHUZA:"🦉",MURCIELAGO:"🦇",
  IGUANA:"🦎",LAGARTO:"🦎",CAIMAN:"🐊",COCODRILO:"🐊",TORTUGA:"🐢",
  CULEBRA:"🐍",SERPIENTE:"🐍",ANACONDA:"🐍",RANA:"🐸",SAPO:"🐸",
  PESCADO:"🐟",PEZ:"🐟",TIBURON:"🦈",DELFIN:"🐬",BALLENA:"🐳",
  PULPO:"🐙",CANGREJO:"🦀",CAMARON:"🦐",
  MARIPOSA:"🦋",ABEJA:"🐝",GRILLO:"🦗",HORMIGA:"🐜",MOSQUITO:"🦟",
  ELEFANTE:"🐘",HIPOPOTAMO:"🦛",JIRAFA:"🦒",RINOCERONTE:"🦏",OSO:"🐻",
  COCHINO:"🐷",CERDO:"🐷",PUERCO:"🐷",CHIVO:"🐐",OVEJA:"🐑",CARNERO:"🐏",
  MAPACHE:"🦝",NUTRIA:"🦦",CASTOR:"🦫",
};

function getAnimalEmoji(name) {
  if (!name) return "🎲";
  const upper = name.toUpperCase().trim();
  if (ANIMAL_EMOJI[upper]) return ANIMAL_EMOJI[upper];
  const norm = upper.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (ANIMAL_EMOJI[norm]) return ANIMAL_EMOJI[norm];
  const found = Object.keys(ANIMAL_EMOJI).find((k) => norm.includes(k) || k.includes(norm));
  return found ? ANIMAL_EMOJI[found] : "🎲";
}

// ─── State ────────────────────────────────────────────────
let RAW = [];
let ALL_SLIDES = [];
let CURRENT_PAGE = 0;
let autoTimer = null;
let SESSION = null; // { username, display_name, token }

// ─── DOM refs ─────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
const el = {
  // Login
  loginScreen:  $("loginScreen"),
  loginForm:    $("loginForm"),
  loginUser:    $("loginUser"),
  loginPass:    $("loginPass"),
  loginError:   $("loginError"),
  loginBtn:     $("loginBtn"),
  loginBtnText: $("loginBtnText"),
  loginSpinner: $("loginSpinner"),
  // App
  appWrap:      $("appWrap"),
  loadingOverlay: $("loadingOverlay"),
  clock:        $("clock"),
  topDate:      $("topDate"),
  statTotal:    $("statTotal"),
  statLoterias: $("statLoterias"),
  countdownTxt: $("countdownTxt"),
  userNameDisplay: $("userNameDisplay"),
  logoutBtn:    $("logoutBtn"),
  catLabel:     $("catLabel"),
  catPage:      $("catPage"),
  progressFill: $("progressFill"),
  carousel:     $("carouselTrack"),
  dots:         $("carouselDots"),
  marquee:      $("marqueeContent"),
};

// ═══════════════════════════════════════════════════════════
//  CLOCK
// ═══════════════════════════════════════════════════════════
function tickClock() {
  const now = new Date();
  el.clock.textContent = now.toLocaleTimeString("es-VE");
  el.topDate.textContent = now.toLocaleDateString("es-VE", {
    weekday: "short", day: "2-digit", month: "short", year: "numeric"
  });
}
tickClock();
setInterval(tickClock, 1000);

// ═══════════════════════════════════════════════════════════
//  LOGIN SYSTEM (Neon serverless)
// ═══════════════════════════════════════════════════════════
function checkSession() {
  try {
    const saved = localStorage.getItem("rll_session");
    if (!saved) return false;
    const data = JSON.parse(saved);
    // Expire after 24h
    if (Date.now() - data.ts > 24 * 60 * 60 * 1000) {
      localStorage.removeItem("rll_session");
      return false;
    }
    SESSION = data;
    return true;
  } catch { return false; }
}

function saveSession(user) {
  SESSION = { ...user, ts: Date.now() };
  localStorage.setItem("rll_session", JSON.stringify(SESSION));
}

function logout() {
  SESSION = null;
  localStorage.removeItem("rll_session");
  el.appWrap.style.display = "none";
  el.loginScreen.classList.remove("hidden");
  el.loginUser.value = "";
  el.loginPass.value = "";
  el.loginError.textContent = "";
  stopAutoAdvance();
}

el.logoutBtn.addEventListener("click", logout);

el.loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const username = el.loginUser.value.trim();
  const password = el.loginPass.value;

  if (!username || !password) {
    el.loginError.textContent = "Complete todos los campos";
    return;
  }

  el.loginBtn.disabled = true;
  el.loginBtnText.textContent = "Verificando...";
  el.loginSpinner.style.display = "inline-block";
  el.loginError.textContent = "";

  try {
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    const data = await res.json();

    if (!res.ok || !data.ok) {
      el.loginError.textContent = data.error || "Credenciales invalidas";
      return;
    }

    saveSession(data.user);
    showApp();
  } catch (err) {
    el.loginError.textContent = "Error de conexion. Intente de nuevo.";
    console.error("Login error:", err);
  } finally {
    el.loginBtn.disabled = false;
    el.loginBtnText.textContent = "Iniciar Sesion";
    el.loginSpinner.style.display = "none";
  }
});

function showApp() {
  el.loginScreen.classList.add("hidden");
  el.appWrap.style.display = "flex";
  if (SESSION) {
    el.userNameDisplay.textContent = SESSION.display_name || SESSION.username;
  }
  loadData(true);
  startHeartbeat();
  startOnlinePolling();
}

// ═══════════════════════════════════════════════════════════
//  HEARTBEAT & ONLINE USERS
// ═══════════════════════════════════════════════════════════
let heartbeatTimer = null;
let onlineTimer = null;

function startHeartbeat() {
  sendHeartbeat();
  heartbeatTimer = setInterval(sendHeartbeat, HEARTBEAT_MS);
}

async function sendHeartbeat() {
  if (!SESSION) return;
  try {
    await fetch("/api/heartbeat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: SESSION.username, display_name: SESSION.display_name || SESSION.username }),
    });
  } catch { /* silent */ }
}

function startOnlinePolling() {
  fetchOnlineUsers();
  onlineTimer = setInterval(fetchOnlineUsers, ONLINE_POLL_MS);
}

async function fetchOnlineUsers() {
  try {
    const res = await fetch("/api/online");
    const data = await res.json();
    if (data.users && data.users.length) {
      const names = data.users.map((u) => u.display_name || u.username);
      // Duplicate for smooth continuous scroll
      const txt = names.join("  •  ");
      el.marquee.textContent = txt + "  •  " + txt;
    } else {
      el.marquee.textContent = SESSION ? (SESSION.display_name || SESSION.username) : "Sin usuarios conectados";
    }
  } catch {
    el.marquee.textContent = SESSION ? (SESSION.display_name || SESSION.username) : "Conectando...";
  }
}


// ─── Helpers ──────────────────────────────────────────────
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

function uniq(arr) { return [...new Set(arr)].filter(Boolean); }

// ═══════════════════════════════════════════════════════════
//  CARD HTML
// ═══════════════════════════════════════════════════════════
function cardHtml(r) {
  const isAnim = r.categoria === "animalitos";

  let mainBlock;
  if (isAnim) {
    const emoji = getAnimalEmoji(r.animal);
    mainBlock = `
      <div class="card-animal-wrap">
        <span class="card-emoji">${emoji}</span>
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

// ═══════════════════════════════════════════════════════════
//  SLIDE BUILDER — Category-based carousel
// ═══════════════════════════════════════════════════════════
const CATEGORY_TITLES = {
  loteria:    "Resultados de Loterias",
  animalitos: "Resultados de Animalitos",
};

function buildAllSlides() {
  const categories = uniq(RAW.map((r) => r.categoria || "loteria"));
  ALL_SLIDES = [];

  categories.forEach((cat) => {
    const rows = RAW.filter((r) => (r.categoria || "loteria") === cat);
    if (!rows.length) return;

    const title = CATEGORY_TITLES[cat] || cat.charAt(0).toUpperCase() + cat.slice(1);
    const pages = chunkArray(rows, CARDS_PER_PAGE);

    pages.forEach((page, idx) => {
      ALL_SLIDES.push({
        title,
        pageLabel: pages.length > 1 ? `Pagina ${idx + 1} de ${pages.length}` : "",
        cards: page,
      });
    });
  });

  CURRENT_PAGE = 0;
  renderCarousel();
}

function renderCarousel() {
  if (!ALL_SLIDES.length) {
    el.carousel.innerHTML = `
      <div class="carousel-slide">
        <div class="state-box">
          <div class="state-msg">Sin resultados disponibles</div>
          <div class="state-sub">Los datos se actualizaran automaticamente</div>
        </div>
      </div>`;
    el.dots.innerHTML = "";
    el.catLabel.textContent = "Sin datos";
    el.catPage.textContent = "";
    return;
  }

  // Build slide HTML
  el.carousel.innerHTML = ALL_SLIDES.map((slide, idx) => `
    <div class="carousel-slide" data-idx="${idx}">
      <div class="slide-header">${esc(slide.title)}${slide.pageLabel ? " — " + esc(slide.pageLabel) : ""}</div>
      <div class="results-grid">
        ${slide.cards.map(cardHtml).join("")}
      </div>
    </div>
  `).join("");

  // Build dots
  el.dots.innerHTML = ALL_SLIDES.map((_, i) =>
    `<div class="dot-item${i === 0 ? " active" : ""}" data-dot="${i}"></div>`
  ).join("");

  el.dots.querySelectorAll(".dot-item").forEach((d) =>
    d.addEventListener("click", () => goToPage(+d.dataset.dot))
  );

  goToPage(0, false);
  startAutoAdvance();
}

function goToPage(idx, animate = true) {
  if (!ALL_SLIDES.length) return;
  CURRENT_PAGE = ((idx % ALL_SLIDES.length) + ALL_SLIDES.length) % ALL_SLIDES.length;

  if (!animate) el.carousel.style.transition = "none";
  el.carousel.style.transform = `translateX(-${CURRENT_PAGE * 100}%)`;
  if (!animate) requestAnimationFrame(() => { el.carousel.style.transition = ""; });

  // Update dots
  el.dots.querySelectorAll(".dot-item").forEach((d, i) =>
    d.classList.toggle("active", i === CURRENT_PAGE)
  );

  // Update category bar
  const slide = ALL_SLIDES[CURRENT_PAGE];
  el.catLabel.textContent = slide.title;
  el.catPage.textContent = slide.pageLabel || `${CURRENT_PAGE + 1} / ${ALL_SLIDES.length}`;

  if (animate) resetProgress();
}

// ─── Carousel navigation ─────────────────────────────────
document.addEventListener("keydown", (e) => {
  if (e.key === "ArrowRight" || e.key === "ArrowDown") { goToPage(CURRENT_PAGE + 1); resetAutoAdvance(); }
  if (e.key === "ArrowLeft"  || e.key === "ArrowUp")   { goToPage(CURRENT_PAGE - 1); resetAutoAdvance(); }
});

// ─── Auto-advance ─────────────────────────────────────────
function startAutoAdvance() {
  stopAutoAdvance();
  resetProgress();
  autoTimer = setInterval(() => goToPage(CURRENT_PAGE + 1), AUTO_ADVANCE_MS);
}

function stopAutoAdvance() {
  if (autoTimer) { clearInterval(autoTimer); autoTimer = null; }
}

function resetAutoAdvance() { startAutoAdvance(); }

function resetProgress() {
  el.progressFill.style.transition = "none";
  el.progressFill.style.width = "0%";
  requestAnimationFrame(() => {
    el.progressFill.style.transition = `width ${AUTO_ADVANCE_MS}ms linear`;
    el.progressFill.style.width = "100%";
  });
}

// ═══════════════════════════════════════════════════════════
//  STATS UPDATE
// ═══════════════════════════════════════════════════════════
function updateStats() {
  el.statTotal.textContent = String(RAW.length);
  const lots = uniq(RAW.filter((r) => (r.categoria || "loteria") === "loteria").map((r) => r.loteria));
  el.statLoterias.textContent = String(lots.length);
}

// ═══════════════════════════════════════════════════════════
//  DATA LOADING
// ═══════════════════════════════════════════════════════════
let isFirstLoad = true;

async function loadData(showOverlay = false) {
  if (showOverlay || isFirstLoad) {
    el.loadingOverlay.classList.remove("hidden");
  }

  try {
    const res = await fetch("/api/results", { cache: "no-store" });
    if (!res.ok) throw new Error("No se pudo cargar los datos desde la DB");
    RAW = await res.json();

    buildAllSlides();
    updateStats();
  } catch (err) {
    if (isFirstLoad) {
      el.carousel.innerHTML = `
        <div class="carousel-slide">
          <div class="state-box">
            <div class="state-msg">Error al cargar datos</div>
            <div class="state-sub">${esc(err.message)}</div>
          </div>
        </div>`;
    }
  } finally {
    el.loadingOverlay.classList.add("hidden");
    isFirstLoad = false;
  }
}

// ─── Auto-refresh every 20 seconds ───────────────────────
const REFRESH_SECS = DATA_REFRESH_MS / 1000;
let countdown = REFRESH_SECS;

setInterval(() => {
  countdown = Math.max(0, countdown - 1);
  if (el.countdownTxt) el.countdownTxt.textContent = `${countdown}s`;
}, 1000);

let dataRefreshTimer = setInterval(() => {
  loadData(false);
  countdown = REFRESH_SECS;
}, DATA_REFRESH_MS);

// ═══════════════════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════════════════
if (checkSession()) {
  showApp();
} else {
  el.loginScreen.classList.remove("hidden");
  el.appWrap.style.display = "none";
}
