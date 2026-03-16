const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRy8_sTXB8AQ9BwHR_G1ZQPaoBZ-woa4I1XdCZLapf4HsyQaubride3npFnXhDN_P85dizphkccFcfh/pub?gid=0&single=true&output=csv";

let DATA = [];

async function loadData() {
  const res = await fetch(CSV_URL + "&t=" + Date.now());
  const text = await res.text();
  const rows = text.split("\n").slice(1);

  DATA = rows
    .map(r => r.split(","))
    .map(c => {
      // Tomamos el Triple (c[4]) o el Animal (c[10]) dependiendo de si hay datos
      let resultado_final = c[4]?.trim() ? c[4].trim() : c[10]?.trim();
      
      return {
        categoria: c[0]?.trim(),
        fecha: c[1]?.trim(),
        loteria: c[2]?.trim(),
        horario: c[3]?.trim(),
        resultado: resultado_final // Aquí unificamos la lectura
      };
    })
    .filter(r => {
      if (!r.categoria) return false;
      if (!r.fecha) return false;
      if (!r.loteria) return false;
      if (!r.horario) return false;
      if (!r.resultado) return false;

      if (/TERMINALES/i.test(r.resultado)) return false;
      if (/Horario/i.test(r.resultado)) return false;

      return true;
    });

  updateCount();
  renderResultados();
  renderAnimalitos();
}

function updateCount() {
  const count = document.getElementById("count");
  if (count) count.innerText = DATA.length;
}

function renderResultados() {
  const container = document.getElementById("results");
  if (!container) return;
  container.innerHTML = "";

  const resultados = DATA.filter(d => d.categoria === "loteria");
  resultados.forEach(r => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <div class="lottery">${r.loteria}</div>
      <div class="date">${r.fecha}</div>
      <div class="time">${r.horario}</div>
      <div class="number">Triple: ${r.resultado}</div>
    `;
    container.appendChild(card);
  });
}

function renderAnimalitos() {
  const container = document.getElementById("animalitos");
  if (!container) return;
  container.innerHTML = "";

  // CORRECCIÓN: Agregada la 's' para que coincida con el scraper
  const resultados = DATA.filter(d => d.categoria === "animalitos");
  
  resultados.forEach(r => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <div class="lottery">${r.loteria}</div>
      <div class="date">${r.fecha}</div>
      <div class="time">${r.horario}</div>
      <div class="number">${r.resultado}</div>
    `;
    container.appendChild(card);
  });
}

document.getElementById("refresh")?.addEventListener("click", loadData);

loadData();
setInterval(loadData, 60000);