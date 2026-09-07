/* Control de Etapas · Ciclismo
   Federación Costarricense de Ciclismo
   App estática: HTML + CSS + JS, persistencia en localStorage.
*/

const STORAGE_KEY = "controlEtapas_v1";

/* ---------- Estado ---------- */
// Tablas de puntos por defecto (según las planillas de la Federación).
const PUNTUACION_DEFECTO = {
  // Metas volantes: posición -> puntos
  metasVolantes: { 1: 5, 2: 3, 3: 1 },
  // Top 10 de etapa: posición -> puntos
  top10: { 1: 15, 2: 12, 3: 10, 4: 7, 5: 6, 6: 5, 7: 4, 8: 3, 9: 2, 10: 1 },
  // Premios de montaña: por categoría -> { posición: puntos }
  // Valores oficiales (Guía Técnica FECOCI): 3ª cat = 6/4/2/1, 4ª cat = 4/2/1.
  montana: {
    3: { 1: 6, 2: 4, 3: 2, 4: 1 },
    4: { 1: 4, 2: 2, 3: 1 }
  }
};

let estado = {
  evento: { nombre: "", organiza: "", comisario: "", tipo: "tiempo", esquemaPuntos: "" },
  puntuacion: JSON.parse(JSON.stringify(PUNTUACION_DEFECTO)),
  corredores: [], // { id, dorsal, nombre, categoria, equipo }
  // etapa: { id, numero, nombre, fecha, salida, recorrido, km,
  //          resultados: { [corredorId]: { estado, tiempo, puntos } },
  //          metas: [ { id, nombre, ganadores: { pos -> corredorId } } ],
  //          montana: [ { id, nombre, categoria, ganadores: { pos -> corredorId } } ] }
  etapas: [],
  seleccion: { etapaId: null, etapaEq: null }
};

/* ---------- Utilidades ---------- */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

function guardar() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(estado));
  marcarGuardado();
}
function cargar() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      const data = JSON.parse(raw);
      estado = Object.assign(estado, data);
    } catch (e) { console.warn("No se pudo cargar", e); }
  }
  migrar();
}

// Rellena campos que puedan faltar en datos guardados antes de esta versión.
function migrar() {
  if (!estado.puntuacion) estado.puntuacion = JSON.parse(JSON.stringify(PUNTUACION_DEFECTO));
  ["metasVolantes", "top10"].forEach((k) => { if (!estado.puntuacion[k]) estado.puntuacion[k] = {}; });
  if (!estado.puntuacion.montana) estado.puntuacion.montana = {};
  if (!estado.seleccion) estado.seleccion = {};
  if (!estado.caravana) estado.caravana = [];
  (estado.corredores || []).forEach((c) => {
    if (c.uciid === undefined) c.uciid = "";
    if (c.nac === undefined) c.nac = "";
  });
  (estado.etapas || []).forEach((e) => {
    if (!e.metas) e.metas = [];
    if (!e.montana) e.montana = [];
    if (e.salida === undefined) e.salida = "";
    if (e.recorrido === undefined) e.recorrido = "";
    if (e.km === undefined) e.km = "";
    // Migración a Opción B: convertir ganadores {pos:id} en ganadoresPorCat {categoria:{pos:id}}
    e.metas.forEach((m) => migrarGanadores(m));
    e.montana.forEach((pm) => migrarGanadores(pm));
  });
}

// Convierte el formato viejo (ganadores por orden general) al nuevo (por categoría de corredor).
function migrarGanadores(item) {
  if (!item.ganadoresPorCat) item.ganadoresPorCat = {};
  if (item.ganadores && Object.keys(item.ganadores).length) {
    Object.keys(item.ganadores).forEach((pos) => {
      const cid = item.ganadores[pos];
      const c = corredorPorId(cid);
      const cat = c ? (c.categoria || "").trim() : "";
      if (cat) {
        if (!item.ganadoresPorCat[cat]) item.ganadoresPorCat[cat] = {};
        // no piso una asignación existente de la misma posición/categoría
        if (!item.ganadoresPorCat[cat][pos]) item.ganadoresPorCat[cat][pos] = cid;
      }
    });
  }
  delete item.ganadores; // ya no se usa
}
let saveTimer;
function marcarGuardado() {
  const el = $("#save-status");
  if (!el) return;
  el.textContent = "✓ Guardado " + new Date().toLocaleTimeString("es-CR");
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { el.textContent = "Guardado automático activo"; }, 2500);
}

/* Tiempo en formato h:mm:ss(.ms) -> segundos */
function tiempoASegundos(str) {
  if (!str) return null;
  str = str.trim();
  if (!str) return null;
  const partes = str.split(":").map((p) => p.trim());
  let seg = 0;
  try {
    if (partes.length === 3) {
      seg = (+partes[0]) * 3600 + (+partes[1]) * 60 + parseFloat(partes[2]);
    } else if (partes.length === 2) {
      seg = (+partes[0]) * 60 + parseFloat(partes[1]);
    } else {
      seg = parseFloat(partes[0]);
    }
  } catch (e) { return null; }
  return isNaN(seg) ? null : seg;
}
function segundosATiempo(seg) {
  if (seg == null || isNaN(seg)) return "";
  const neg = seg < 0;
  seg = Math.abs(seg);
  const h = Math.floor(seg / 3600);
  const m = Math.floor((seg % 3600) / 60);
  const s = seg % 60;
  const ss = (s < 10 ? "0" : "") + (Number.isInteger(s) ? s : s.toFixed(1));
  const mm = (m < 10 ? "0" : "") + m;
  const str = h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
  return (neg ? "+" : "") + str;
}

function esquemaPuntosArray() {
  return (estado.evento.esquemaPuntos || "")
    .split(",")
    .map((x) => parseFloat(x.trim()))
    .filter((x) => !isNaN(x));
}

/* ---------- Corredores ---------- */
function corredorPorId(id) { return estado.corredores.find((c) => c.id === id); }

function agregarCorredor() {
  const dorsal = $("#c-dorsal").value.trim();
  const nombre = $("#c-nombre").value.trim();
  const uciid = $("#c-uciid").value.trim();
  const categoria = $("#c-categoria").value.trim();
  const nac = $("#c-nac").value.trim();
  const equipo = $("#c-equipo").value.trim();
  if (!nombre) { alert("El nombre es obligatorio."); return; }
  if (dorsal && estado.corredores.some((c) => String(c.dorsal) === String(dorsal))) {
    if (!confirm("Ya existe un corredor con ese dorsal. ¿Agregar de todos modos?")) return;
  }
  estado.corredores.push({ id: uid(), dorsal, nombre, uciid, categoria, nac, equipo });
  ["#c-dorsal", "#c-nombre", "#c-uciid", "#c-categoria", "#c-nac", "#c-equipo"].forEach((s) => ($(s).value = ""));
  $("#c-dorsal").focus();
  guardar();
  renderTodo();
}

let ordenCorredores = { campo: "dorsal", asc: true };
function renderCorredores() {
  const tbody = $("#tabla-corredores tbody");
  const filtro = ($("#buscar-corredor").value || "").toLowerCase();
  const filtroCat = ($("#filtro-cat-corredor") && $("#filtro-cat-corredor").value) || "";
  const filtroEq = ($("#filtro-eq-corredor") && $("#filtro-eq-corredor").value) || "";
  actualizarFiltrosCorredor();
  let lista = estado.corredores.slice();

  const { campo, asc } = ordenCorredores;
  lista.sort((a, b) => {
    let va = a[campo], vb = b[campo];
    if (campo === "dorsal") { va = parseFloat(va) || 1e9; vb = parseFloat(vb) || 1e9; }
    else { va = (va || "").toLowerCase(); vb = (vb || "").toLowerCase(); }
    if (va < vb) return asc ? -1 : 1;
    if (va > vb) return asc ? 1 : -1;
    return 0;
  });

  if (filtro) {
    lista = lista.filter((c) =>
      [c.dorsal, c.nombre, c.uciid, c.categoria, c.nac, c.equipo].join(" ").toLowerCase().includes(filtro));
  }
  if (filtroCat) lista = lista.filter((c) => (c.categoria || "").trim() === filtroCat);
  if (filtroEq) lista = lista.filter((c) => (c.equipo || "").trim() === filtroEq);

  tbody.innerHTML = "";
  lista.forEach((c) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(c.dorsal)}</td>
      <td>${escapeHtml(c.nombre)}</td>
      <td>${escapeHtml(c.uciid)}</td>
      <td>${escapeHtml(c.categoria)}</td>
      <td>${escapeHtml(c.nac)}</td>
      <td>${escapeHtml(c.equipo)}</td>
      <td class="no-print">
        <span class="link-action" data-edit="${c.id}">✏️</span>
        <span class="link-action" data-del="${c.id}">🗑️</span>
      </td>`;
    tbody.appendChild(tr);
  });
  // Muestra "N de M" cuando hay filtro activo
  const mostrados = lista.length, total = estado.corredores.length;
  $("#count-corredores").textContent = (mostrados !== total) ? `${mostrados} de ${total}` : total;

  tbody.querySelectorAll("[data-del]").forEach((el) =>
    el.addEventListener("click", () => eliminarCorredor(el.dataset.del)));
  tbody.querySelectorAll("[data-edit]").forEach((el) =>
    el.addEventListener("click", () => editarCorredor(el.dataset.edit)));

  actualizarDatalistCategorias();
}

function eliminarCorredor(id) {
  const c = corredorPorId(id);
  if (!c) return;
  if (!confirm(`¿Eliminar a ${c.nombre}? También se borrarán sus resultados en todas las etapas.`)) return;
  estado.corredores = estado.corredores.filter((x) => x.id !== id);
  estado.etapas.forEach((e) => { delete e.resultados[id]; });
  guardar();
  renderTodo();
}

function editarCorredor(id) {
  const c = corredorPorId(id);
  if (!c) return;
  const dorsal = prompt("Dorsal:", c.dorsal); if (dorsal === null) return;
  const nombre = prompt("Nombre:", c.nombre); if (nombre === null) return;
  const uciid = prompt("UCI ID:", c.uciid || ""); if (uciid === null) return;
  const categoria = prompt("Categoría:", c.categoria); if (categoria === null) return;
  const nac = prompt("Nacionalidad:", c.nac || ""); if (nac === null) return;
  const equipo = prompt("Equipo:", c.equipo); if (equipo === null) return;
  Object.assign(c, {
    dorsal: dorsal.trim(), nombre: nombre.trim(), uciid: uciid.trim(),
    categoria: categoria.trim(), nac: nac.trim(), equipo: equipo.trim()
  });
  guardar();
  renderTodo();
}

function actualizarDatalistCategorias() {
  const cats = [...new Set(estado.corredores.map((c) => c.categoria).filter(Boolean))].sort();
  const dl = $("#cats");
  if (dl) dl.innerHTML = cats.map((c) => `<option value="${escapeHtml(c)}">`).join("");
  const filtro = $("#filtro-categoria");
  if (filtro) {
    const actual = filtro.value;
    filtro.innerHTML = '<option value="">Todas</option>' +
      cats.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
    filtro.value = actual;
  }
}

// Rellena los selects de filtro (categoría y equipo) de la pestaña Corredores.
function actualizarFiltrosCorredor() {
  const selCat = $("#filtro-cat-corredor");
  const selEq = $("#filtro-eq-corredor");
  if (selCat) {
    const cats = [...new Set(estado.corredores.map((c) => (c.categoria || "").trim()).filter(Boolean))].sort();
    const actual = selCat.value;
    selCat.innerHTML = '<option value="">Todas las categorías</option>' +
      cats.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
    if (cats.includes(actual)) selCat.value = actual;
  }
  if (selEq) {
    const eqs = [...new Set(estado.corredores.map((c) => (c.equipo || "").trim()).filter(Boolean))].sort();
    const actual = selEq.value;
    selEq.innerHTML = '<option value="">Todos los equipos</option>' +
      eqs.map((e) => `<option value="${escapeHtml(e)}">${escapeHtml(e)}</option>`).join("");
    if (eqs.includes(actual)) selEq.value = actual;
  }
}

/* ---------- Etapas ---------- */
function etapaPorId(id) { return estado.etapas.find((e) => e.id === id); }
function etapaActual() { return etapaPorId(estado.seleccion.etapaId); }

function nuevaEtapa() {
  const numero = estado.etapas.length + 1;
  const etapa = {
    id: uid(), numero,
    nombre: `Etapa ${numero}`,
    fecha: new Date().toISOString().slice(0, 10),
    salida: "", recorrido: "", km: "",
    resultados: {}, metas: [], montana: []
  };
  estado.etapas.push(etapa);
  estado.seleccion.etapaId = etapa.id;
  guardar();
  renderTodo();
}

function eliminarEtapa(id) {
  const e = etapaPorId(id) || etapaActual();
  if (!e) return;
  if (!confirm(`¿Eliminar "${e.nombre}" con todos sus datos (tiempos, metas y premios)?`)) return;
  estado.etapas = estado.etapas.filter((x) => x.id !== e.id);
  estado.etapas.forEach((et, i) => (et.numero = i + 1));
  if (estado.seleccion.etapaId === e.id) {
    estado.seleccion.etapaId = estado.etapas.length ? estado.etapas[0].id : null;
  }
  guardar();
  renderTodo();
}

function renderSelectEtapas() {
  const sel = $("#sel-etapa");
  if (!sel) return;
  sel.innerHTML = estado.etapas
    .map((e) => `<option value="${e.id}">${escapeHtml(e.nombre)}${e.fecha ? " · " + e.fecha : ""}</option>`)
    .join("");
  if (!estado.seleccion.etapaId && estado.etapas.length) estado.seleccion.etapaId = estado.etapas[0].id;
  if (estado.seleccion.etapaId) sel.value = estado.seleccion.etapaId;
}

function resultadoDe(etapa, corredorId) {
  if (!etapa.resultados[corredorId]) {
    etapa.resultados[corredorId] = { estado: "ok", tiempo: "", puntos: "" };
  }
  return etapa.resultados[corredorId];
}

/* ================================================================
   DATOS DE COMPETENCIA (definir etapas + metas + premios)
   ================================================================ */
function renderCompetencia() {
  const cont = $("#competencia-lista");
  const vacia = $("#competencia-vacia");
  if (!cont) return;

  if (!estado.etapas.length) {
    cont.innerHTML = "";
    if (vacia) vacia.classList.remove("hidden");
    return;
  }
  if (vacia) vacia.classList.add("hidden");

  const catsPremio = Object.keys(estado.puntuacion.montana).sort((a, b) => +a - +b);

  cont.innerHTML = estado.etapas.map((e) => {
    const nMetas = (e.metas || []).length;
    const nPremios = (e.montana || []).length;

    const metasHTML = (e.metas || []).map((m, i) => `
      <tr>
        <td class="col-num">${i + 1}</td>
        <td><input type="text" class="comp-input comp-nombre" value="${escapeHtml(m.nombre)}" placeholder="Lugar (ej: Rest. California Km 25)" data-cmeta="${e.id}:${m.id}" /></td>
        <td class="no-print"><span class="link-action" data-cmeta-del="${e.id}:${m.id}">🗑️</span></td>
      </tr>`).join("") || `<tr><td colspan="3" class="muted">Sin metas volantes.</td></tr>`;

    const premiosHTML = (e.montana || []).map((pm, i) => {
      const opsCat = catsPremio.map((c) => `<option value="${c}" ${c === String(pm.categoria) ? "selected" : ""}>Cat ${c}</option>`).join("");
      return `
      <tr>
        <td class="col-num">${i + 1}</td>
        <td><input type="text" class="comp-input comp-nombre" value="${escapeHtml(pm.nombre)}" placeholder="Lugar (ej: Bahía Carey Km 63)" data-cpm="${e.id}:${pm.id}" /></td>
        <td><select data-cpm-cat="${e.id}:${pm.id}">${opsCat}</select></td>
        <td class="no-print"><span class="link-action" data-cpm-del="${e.id}:${pm.id}">🗑️</span></td>
      </tr>`;
    }).join("") || `<tr><td colspan="4" class="muted">Sin premios de montaña.</td></tr>`;

    return `
      <div class="card comp-etapa">
        <div class="comp-etapa-datos">
          <div class="grid">
            <label>Nombre <input type="text" class="comp-input" value="${escapeHtml(e.nombre)}" data-eta="${e.id}:nombre" /></label>
            <label>Fecha <input type="date" class="comp-input" value="${escapeHtml(e.fecha)}" data-eta="${e.id}:fecha" /></label>
            <label>Hora de salida <input type="time" step="1" class="comp-input" value="${escapeHtml(e.salida)}" data-eta="${e.id}:salida" /></label>
            <label>Distancia (km) <input type="text" class="comp-input" value="${escapeHtml(e.km)}" placeholder="Ej: 102,0" data-eta="${e.id}:km" /></label>
          </div>
          <label class="inline" style="max-width:none">Recorrido
            <input type="text" class="comp-input" value="${escapeHtml(e.recorrido)}" placeholder="Ej: Quepos-Dominical-Ciudad Cortés-Palmar Norte" data-eta="${e.id}:recorrido" />
          </label>
          <div class="comp-listas">
            <div class="comp-sublista">
              <h4 class="sub-h">🟢 Metas Volantes <span class="contador">${nMetas}</span></h4>
              <table class="tabla-pts comp-tabla"><tbody>${metasHTML}</tbody></table>
              <button class="btn small no-print" data-add-meta="${e.id}">+ meta volante</button>
            </div>
            <div class="comp-sublista">
              <h4 class="sub-h">🔴 Premios de Montaña <span class="contador">${nPremios}</span></h4>
              <table class="tabla-pts comp-tabla"><tbody>${premiosHTML}</tbody></table>
              <button class="btn small no-print" data-add-premio="${e.id}">+ premio de montaña</button>
            </div>
          </div>
          <div class="btn-row no-print" style="margin-top:10px">
            <button class="btn danger small" data-del-etapa="${e.id}">🗑️ Eliminar etapa</button>
          </div>
        </div>
      </div>`;
  }).join("");

  // Listeners de datos de etapa
  cont.querySelectorAll("[data-eta]").forEach((el) =>
    el.addEventListener("change", () => {
      const [id, campo] = el.dataset.eta.split(":");
      const e = etapaPorId(id);
      if (!e) return;
      e[campo] = el.value.trim();
      guardar();
      if (campo === "nombre" || campo === "fecha") { renderSelectEtapas(); renderEquipos(); }
    }));

  // Metas
  cont.querySelectorAll("[data-cmeta]").forEach((el) =>
    el.addEventListener("change", () => {
      const [eid, mid] = el.dataset.cmeta.split(":");
      const e = etapaPorId(eid); if (!e) return;
      const m = e.metas.find((x) => x.id === mid);
      if (m) { m.nombre = el.value.trim(); guardar(); }
    }));
  cont.querySelectorAll("[data-cmeta-del]").forEach((el) =>
    el.addEventListener("click", () => {
      const [eid, mid] = el.dataset.cmetaDel.split(":");
      const e = etapaPorId(eid); if (!e) return;
      if (!confirm("¿Eliminar esta meta volante de la etapa?")) return;
      e.metas = e.metas.filter((x) => x.id !== mid);
      guardar(); renderCompetencia(); renderMetasVolantes();
    }));
  cont.querySelectorAll("[data-add-meta]").forEach((el) =>
    el.addEventListener("click", () => {
      const e = etapaPorId(el.dataset.addMeta); if (!e) return;
      if (!e.metas) e.metas = [];
      e.metas.push({ id: uid(), nombre: "", ganadoresPorCat: {} });
      guardar(); renderCompetencia(); renderMetasVolantes();
    }));

  // Premios
  cont.querySelectorAll("[data-cpm]").forEach((el) =>
    el.addEventListener("change", () => {
      const [eid, pid] = el.dataset.cpm.split(":");
      const e = etapaPorId(eid); if (!e) return;
      const pm = e.montana.find((x) => x.id === pid);
      if (pm) { pm.nombre = el.value.trim(); guardar(); }
    }));
  cont.querySelectorAll("[data-cpm-cat]").forEach((el) =>
    el.addEventListener("change", () => {
      const [eid, pid] = el.dataset.cpmCat.split(":");
      const e = etapaPorId(eid); if (!e) return;
      const pm = e.montana.find((x) => x.id === pid);
      if (pm) { pm.categoria = el.value; pm.ganadoresPorCat = {}; guardar(); renderPremiosMontana(); }
    }));
  cont.querySelectorAll("[data-cpm-del]").forEach((el) =>
    el.addEventListener("click", () => {
      const [eid, pid] = el.dataset.cpmDel.split(":");
      const e = etapaPorId(eid); if (!e) return;
      if (!confirm("¿Eliminar este premio de montaña de la etapa?")) return;
      e.montana = e.montana.filter((x) => x.id !== pid);
      guardar(); renderCompetencia(); renderPremiosMontana();
    }));
  cont.querySelectorAll("[data-add-premio]").forEach((el) =>
    el.addEventListener("click", () => {
      const e = etapaPorId(el.dataset.addPremio); if (!e) return;
      const cats = Object.keys(estado.puntuacion.montana).sort((a, b) => +a - +b);
      if (!cats.length) { alert("Primero configurá al menos una categoría de montaña en la pestaña Puntuación."); return; }
      if (!e.montana) e.montana = [];
      e.montana.push({ id: uid(), nombre: "", categoria: cats[0], ganadoresPorCat: {} });
      guardar(); renderCompetencia(); renderPremiosMontana();
    }));

  // Eliminar etapa
  cont.querySelectorAll("[data-del-etapa]").forEach((el) =>
    el.addEventListener("click", () => eliminarEtapa(el.dataset.delEtapa)));
}

function imprimirCompetencia() {
  mostrarSoloTab("competencia");
  prepararEncabezadoImpresion("Datos de competencia · Hoja de ruta");
  window.print();
}

/* Calcula posiciones de una etapa según tipo */
function calcularPosicionesEtapa(etapa) {
  const tipo = estado.evento.tipo;
  const activos = estado.corredores.filter((c) => {
    const r = etapa.resultados[c.id];
    return r && r.estado === "ok" && (tipo === "tiempo" ? tiempoASegundos(r.tiempo) != null : true);
  });

  if (tipo === "tiempo") {
    activos.sort((a, b) => tiempoASegundos(etapa.resultados[a.id].tiempo) - tiempoASegundos(etapa.resultados[b.id].tiempo));
  } else {
    // por puntos manuales: si el usuario ingresa puntos directamente, ordena por puntos desc;
    // si usa esquema, se asigna por orden de "posicion" manual. Aquí ordenamos por puntos ingresados.
    activos.sort((a, b) => (parseFloat(etapa.resultados[b.id].puntos) || 0) - (parseFloat(etapa.resultados[a.id].puntos) || 0));
  }
  const posiciones = {};
  activos.forEach((c, i) => (posiciones[c.id] = i + 1));
  return posiciones;
}

function renderEtapa() {
  renderSelectEtapas();
  const tipo = estado.evento.tipo;
  const e = etapaActual();
  const vacia = $("#etapa-vacia-msg");
  const detalle = $("#etapa-detalle");

  if (!e) { vacia.classList.remove("hidden"); detalle.classList.add("hidden"); return; }
  vacia.classList.add("hidden"); detalle.classList.remove("hidden");

  $("#etapa-titulo").textContent = e.nombre;
  const partesInfo = [];
  if (e.fecha) partesInfo.push("Fecha: " + e.fecha);
  if (e.salida) partesInfo.push("Salida: " + e.salida);
  if (e.km) partesInfo.push("Distancia: " + e.km + " km");
  partesInfo.push(tipo === "tiempo" ? "Clasificación por tiempo" : "Clasificación por puntos");
  $("#etapa-info").textContent = partesInfo.join(" · ");
  $("#etapa-recorrido").textContent = e.recorrido ? "Recorrido: " + e.recorrido : "";
  $("#etapa-recorrido").classList.toggle("hidden", !e.recorrido);
  $("#th-resultado").textContent = tipo === "tiempo" ? "Tiempo (h:mm:ss)" : "Puntos";

  // El cronómetro solo tiene sentido cuando se clasifica por tiempo
  const cronoBox = $("#crono-box");
  if (cronoBox) cronoBox.classList.toggle("hidden", tipo !== "tiempo");

  const posiciones = calcularPosicionesEtapa(e);
  const tbody = $("#tabla-etapa tbody");
  tbody.innerHTML = "";

  // ordena filas: primero por posición calculada, luego por dorsal
  const corredoresOrden = estado.corredores.slice().sort((a, b) => {
    const pa = posiciones[a.id] || 9999, pb = posiciones[b.id] || 9999;
    if (pa !== pb) return pa - pb;
    return (parseFloat(a.dorsal) || 1e9) - (parseFloat(b.dorsal) || 1e9);
  });

  corredoresOrden.forEach((c) => {
    const r = resultadoDe(e, c.id);
    const pos = posiciones[c.id] || "";
    const tr = document.createElement("tr");
    if (pos && pos <= 3) tr.className = "pos-" + pos;

    const inputResultado = tipo === "tiempo"
      ? `<input type="text" placeholder="h:mm:ss" value="${escapeHtml(r.tiempo || "")}" data-tiempo="${c.id}" />`
      : `<input type="number" step="any" placeholder="pts" value="${escapeHtml(r.puntos || "")}" data-puntos="${c.id}" />`;

    tr.innerHTML = `
      <td>${pos}</td>
      <td>${escapeHtml(c.dorsal)}</td>
      <td>${escapeHtml(c.nombre)}</td>
      <td>${escapeHtml(c.categoria)}</td>
      <td>${escapeHtml(c.equipo)}</td>
      <td>${inputResultado}</td>
      <td>
        <select data-estado="${c.id}">
          <option value="ok" ${r.estado === "ok" ? "selected" : ""}>OK</option>
          <option value="DNF" ${r.estado === "DNF" ? "selected" : ""}>DNF</option>
          <option value="DNS" ${r.estado === "DNS" ? "selected" : ""}>DNS</option>
          <option value="DSQ" ${r.estado === "DSQ" ? "selected" : ""}>DSQ</option>
        </select>
      </td>
      <td class="no-print">${badgeEstado(r.estado)}</td>`;
    tbody.appendChild(tr);
  });

  // listeners
  tbody.querySelectorAll("[data-tiempo]").forEach((el) =>
    el.addEventListener("change", () => { resultadoDe(e, el.dataset.tiempo).tiempo = el.value; guardar(); renderEtapa(); }));
  tbody.querySelectorAll("[data-puntos]").forEach((el) =>
    el.addEventListener("change", () => { resultadoDe(e, el.dataset.puntos).puntos = el.value; guardar(); renderEtapa(); }));
  tbody.querySelectorAll("[data-estado]").forEach((el) =>
    el.addEventListener("change", () => { resultadoDe(e, el.dataset.estado).estado = el.value; guardar(); renderEtapa(); }));
}

function badgeEstado(est) {
  const map = { ok: '<span class="badge ok">OK</span>', DNF: '<span class="badge dnf">DNF</span>',
    DNS: '<span class="badge dns">DNS</span>', DSQ: '<span class="badge dsq">DSQ</span>' };
  return map[est] || "";
}

/* ---------- Clasificación general ---------- */
function calcularGeneral() {
  const tipo = estado.evento.tipo;
  const esquema = esquemaPuntosArray();

  const filas = estado.corredores.map((c) => {
    let totalSeg = 0, totalPuntos = 0, etapasValidas = 0, penalizado = false;
    let estadoFinal = "ok";

    estado.etapas.forEach((e) => {
      const r = e.resultados[c.id];
      if (!r) { estadoFinal = marcarNoFinaliza(estadoFinal, "DNS"); return; }
      if (r.estado !== "ok") { estadoFinal = marcarNoFinaliza(estadoFinal, r.estado); return; }

      if (tipo === "tiempo") {
        const s = tiempoASegundos(r.tiempo);
        if (s == null) { estadoFinal = marcarNoFinaliza(estadoFinal, "DNS"); return; }
        totalSeg += s;
        etapasValidas++;
      } else {
        let pts = parseFloat(r.puntos);
        if (isNaN(pts) && esquema.length) {
          const pos = calcularPosicionesEtapa(e)[c.id];
          if (pos && esquema[pos - 1] != null) pts = esquema[pos - 1];
        }
        if (!isNaN(pts)) { totalPuntos += pts; etapasValidas++; }
      }
    });

    return {
      corredor: c,
      totalSeg,
      totalPuntos,
      etapasValidas,
      estadoFinal,
      finalizoTodas: estadoFinal === "ok" && etapasValidas === estado.etapas.length && estado.etapas.length > 0
    };
  });

  // ordenar
  if (tipo === "tiempo") {
    filas.sort((a, b) => {
      if (a.finalizoTodas !== b.finalizoTodas) return a.finalizoTodas ? -1 : 1;
      return a.totalSeg - b.totalSeg;
    });
  } else {
    filas.sort((a, b) => b.totalPuntos - a.totalPuntos);
  }

  // asignar posiciones (solo a quienes clasifican)
  let pos = 0;
  filas.forEach((f) => {
    const clasifica = tipo === "tiempo" ? f.finalizoTodas : (f.totalPuntos > 0 || f.estadoFinal === "ok");
    f.posicion = clasifica ? ++pos : "";
  });

  return filas;
}

function marcarNoFinaliza(actual, nuevo) {
  // prioridad DSQ > DNF > DNS
  const prioridad = { ok: 0, DNS: 1, DNF: 2, DSQ: 3 };
  return prioridad[nuevo] > prioridad[actual] ? nuevo : actual;
}

// Mapa corredorId -> posición en la general individual por tiempos.
// Se usa como último criterio de desempate en metas volantes y montaña.
function posicionesGeneralTiempos() {
  const mapa = {};
  // Fuerza el cálculo por tiempo aunque el evento esté en modo puntos
  const tipoPrev = estado.evento.tipo;
  estado.evento.tipo = "tiempo";
  try {
    calcularGeneral().forEach((f) => { if (f.posicion) mapa[f.corredor.id] = f.posicion; });
  } finally {
    estado.evento.tipo = tipoPrev;
  }
  return mapa;
}

// Compara dos corredores por conteo de posiciones (más 1os, luego 2os, etc.).
// conteoA/conteoB: objeto { pos: cantidad }. Devuelve negativo si A va antes.
function compararPorConteoPosiciones(conteoA, conteoB, maxPos) {
  for (let p = 1; p <= maxPos; p++) {
    const a = conteoA[p] || 0, b = conteoB[p] || 0;
    if (a !== b) return b - a; // más cantidad = mejor
  }
  return 0;
}

function renderGeneral() {
  const tipo = estado.evento.tipo;
  const filtroCat = $("#filtro-categoria").value;
  let filas = calcularGeneral();
  if (filtroCat) filas = filas.filter((f) => f.corredor.categoria === filtroCat);

  $("#general-info").textContent =
    `${estado.etapas.length} etapa(s) · ${tipo === "tiempo" ? "Menor tiempo acumulado" : "Mayor puntaje acumulado"}` +
    (filtroCat ? ` · Categoría: ${filtroCat}` : "");

  const thead = $("#tabla-general thead");
  const tbody = $("#tabla-general tbody");

  const lider = filas.find((f) => f.posicion === 1);

  thead.innerHTML = tipo === "tiempo"
    ? `<tr><th>Pos.</th><th>Dorsal</th><th>Nombre</th><th>Categoría</th><th>Equipo</th><th>Tiempo total</th><th>Diferencia</th><th>Etapas</th></tr>`
    : `<tr><th>Pos.</th><th>Dorsal</th><th>Nombre</th><th>Categoría</th><th>Equipo</th><th>Puntos</th><th>Etapas</th></tr>`;

  tbody.innerHTML = "";
  filas.forEach((f) => {
    const c = f.corredor;
    const tr = document.createElement("tr");
    if (f.posicion && f.posicion <= 3) tr.className = "pos-" + f.posicion;

    if (tipo === "tiempo") {
      const dif = (f.posicion && lider && f.posicion !== 1)
        ? "+" + segundosATiempo(f.totalSeg - lider.totalSeg)
        : (f.posicion === 1 ? "—" : "");
      tr.innerHTML = `
        <td>${f.posicion || badgeEstado(f.estadoFinal)}</td>
        <td>${escapeHtml(c.dorsal)}</td>
        <td>${escapeHtml(c.nombre)}</td>
        <td>${escapeHtml(c.categoria)}</td>
        <td>${escapeHtml(c.equipo)}</td>
        <td>${f.finalizoTodas ? segundosATiempo(f.totalSeg) : segundosATiempo(f.totalSeg) + " *"}</td>
        <td>${dif}</td>
        <td>${f.etapasValidas}/${estado.etapas.length}</td>`;
    } else {
      tr.innerHTML = `
        <td>${f.posicion || badgeEstado(f.estadoFinal)}</td>
        <td>${escapeHtml(c.dorsal)}</td>
        <td>${escapeHtml(c.nombre)}</td>
        <td>${escapeHtml(c.categoria)}</td>
        <td>${escapeHtml(c.equipo)}</td>
        <td>${f.totalPuntos}</td>
        <td>${f.etapasValidas}/${estado.etapas.length}</td>`;
    }
    tbody.appendChild(tr);
  });
}

/* ---------- Cronómetro ---------- */
const crono = { inicio: 0, acumulado: 0, corriendo: false, raf: null };

function cronoFormato(ms) {
  const totalSeg = ms / 1000;
  const h = Math.floor(totalSeg / 3600);
  const m = Math.floor((totalSeg % 3600) / 60);
  const s = Math.floor(totalSeg % 60);
  const d = Math.floor((ms % 1000) / 100); // décimas
  const mm = (m < 10 ? "0" : "") + m;
  const ss = (s < 10 ? "0" : "") + s;
  return `${h}:${mm}:${ss}.${d}`;
}

function cronoTranscurrido() {
  return crono.acumulado + (crono.corriendo ? (performance.now() - crono.inicio) : 0);
}

function cronoTick() {
  $("#crono-display").textContent = cronoFormato(cronoTranscurrido());
  if (crono.corriendo) crono.raf = requestAnimationFrame(cronoTick);
}

function cronoStart() {
  if (crono.corriendo) return;
  crono.inicio = performance.now();
  crono.corriendo = true;
  $("#crono-display").classList.add("corriendo");
  cronoTick();
}
function cronoPausa() {
  if (!crono.corriendo) return;
  crono.acumulado = cronoTranscurrido();
  crono.corriendo = false;
  cancelAnimationFrame(crono.raf);
  $("#crono-display").classList.remove("corriendo");
  $("#crono-display").textContent = cronoFormato(crono.acumulado);
}
function cronoReset() {
  if (crono.corriendo || crono.acumulado > 0) {
    if (!confirm("¿Reiniciar el cronómetro a cero?")) return;
  }
  crono.corriendo = false;
  cancelAnimationFrame(crono.raf);
  crono.acumulado = 0;
  crono.inicio = 0;
  $("#crono-display").classList.remove("corriendo");
  $("#crono-display").textContent = cronoFormato(0);
  $("#crono-ultimo").textContent = "";
}

function cronoMarcar() {
  const e = etapaActual();
  if (!e) return;
  if (!crono.corriendo && crono.acumulado === 0) {
    alert("Primero iniciá el cronómetro (▶️ Iniciar).");
    return;
  }
  const dorsalInput = $("#crono-dorsal");
  const dorsal = dorsalInput.value.trim();
  if (!dorsal) { alert("Escribí el dorsal del corredor que llegó."); dorsalInput.focus(); return; }

  const c = estado.corredores.find((x) => String(x.dorsal) === String(dorsal));
  if (!c) { alert(`No hay ningún corredor con el dorsal ${dorsal}.`); dorsalInput.select(); return; }

  const ms = cronoTranscurrido();
  const r = resultadoDe(e, c.id);
  const tiempoStr = segundosATiempoCrono(ms / 1000);

  if (r.tiempo) {
    if (!confirm(`${c.nombre} (dorsal ${dorsal}) ya tenía el tiempo ${r.tiempo}. ¿Reemplazar por ${tiempoStr}?`)) return;
  }
  r.tiempo = tiempoStr;
  r.estado = "ok";
  guardar();

  $("#crono-ultimo").textContent = `✓ ${c.nombre} (dorsal ${dorsal}) → ${tiempoStr}`;
  dorsalInput.value = "";
  dorsalInput.focus();
  renderEtapa();

  // destello en la fila marcada
  const fila = document.querySelector(`#tabla-etapa [data-tiempo="${c.id}"]`);
  if (fila) { const tr = fila.closest("tr"); if (tr) { tr.classList.add("fila-marcada"); setTimeout(() => tr.classList.remove("fila-marcada"), 1000); } }
}

// Formato de tiempo desde el crono con décimas (h:mm:ss.d)
function segundosATiempoCrono(seg) {
  const h = Math.floor(seg / 3600);
  const m = Math.floor((seg % 3600) / 60);
  const s = seg % 60;
  const mm = (m < 10 ? "0" : "") + m;
  const ss = (s < 10 ? "0" : "") + s.toFixed(1);
  return `${h}:${mm}:${ss}`;
}

/* ---------- Impresión ---------- */
function prepararEncabezadoImpresion(subtitulo) {
  const ev = estado.evento;
  $("#print-header").innerHTML = `
    <h1>${escapeHtml(ev.nombre || "Evento de ciclismo")}</h1>
    ${ev.organiza ? `<p>${escapeHtml(ev.organiza)}</p>` : ""}
    <p><strong>${escapeHtml(subtitulo).replace(/\n/g, "<br>")}</strong></p>
    ${ev.comisario ? `<p>Comisario: ${escapeHtml(ev.comisario)}</p>` : ""}
    <p>Impreso: ${new Date().toLocaleString("es-CR")}</p>`;
}

function imprimirEtapa() {
  const e = etapaActual();
  if (!e) return;
  mostrarSoloTab("registro");
  const detalles = [];
  if (e.salida) detalles.push("Salida: " + e.salida);
  if (e.km) detalles.push(e.km + " km");
  let sub = `Resultados ${e.nombre}${e.fecha ? " · " + e.fecha : ""}`;
  if (detalles.length) sub += " · " + detalles.join(" · ");
  if (e.recorrido) sub += "\n" + e.recorrido;
  prepararEncabezadoImpresion(sub);
  window.print();
}
function imprimirGeneral() {
  mostrarSoloTab("general");
  prepararEncabezadoImpresion("Clasificación general");
  window.print();
}

/* ---------- Respaldo ---------- */
function exportar() {
  const blob = new Blob([JSON.stringify(estado, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  const nombre = (estado.evento.nombre || "control-etapas").replace(/[^\w\-]+/g, "-").toLowerCase();
  a.download = `${nombre}-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}
function importar(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!data.corredores || !data.etapas) throw new Error("Formato no válido");
      if (!confirm("Esto reemplazará todos los datos de este dispositivo. ¿Continuar?")) return;
      estado = Object.assign({ evento: {}, corredores: [], etapas: [], seleccion: {} }, data);
      migrar();
      guardar();
      cargarConfigEnUI();
      renderTodo();
      alert("Respaldo importado correctamente.");
    } catch (e) {
      alert("No se pudo importar: " + e.message);
    }
  };
  reader.readAsText(file);
}
function borrarTodo() {
  if (!confirm("¿Borrar TODOS los datos de este dispositivo? Esta acción no se puede deshacer.")) return;
  localStorage.removeItem(STORAGE_KEY);
  location.reload();
}

/* ---------- Importar corredores desde CSV ---------- */
// Parser de CSV que soporta comillas, comas/;/tab dentro de campos y saltos de línea escapados.
function parseCSV(texto) {
  // Detecta separador: coma, punto y coma o tabulación (el más frecuente en la 1ª línea)
  const primera = texto.split(/\r?\n/)[0] || "";
  const conteo = { ",": (primera.match(/,/g) || []).length,
                   ";": (primera.match(/;/g) || []).length,
                   "\t": (primera.match(/\t/g) || []).length };
  const sep = Object.keys(conteo).reduce((a, b) => (conteo[b] > conteo[a] ? b : a), ",");

  const filas = [];
  let campo = "", fila = [], enComillas = false;
  for (let i = 0; i < texto.length; i++) {
    const ch = texto[i];
    if (enComillas) {
      if (ch === '"') {
        if (texto[i + 1] === '"') { campo += '"'; i++; }
        else enComillas = false;
      } else campo += ch;
    } else {
      if (ch === '"') enComillas = true;
      else if (ch === sep) { fila.push(campo); campo = ""; }
      else if (ch === "\n") { fila.push(campo); filas.push(fila); fila = []; campo = ""; }
      else if (ch === "\r") { /* ignora */ }
      else campo += ch;
    }
  }
  if (campo !== "" || fila.length) { fila.push(campo); filas.push(fila); }
  return filas.filter((f) => f.some((c) => (c || "").trim() !== ""));
}

function normalizar(s) {
  return (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function importarCSV(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const filas = parseCSV(reader.result);
      if (!filas.length) { setCsvMsg("El archivo está vacío.", true); return; }

      // Detecta si la primera fila es encabezado
      const cabecerasConocidas = ["dorsal", "nombre", "uciid", "uci id", "uci", "categoria", "nac", "nacionalidad", "pais", "equipo", "numero", "nro", "#"];
      const primera = filas[0].map(normalizar);
      const esEncabezado = primera.some((c) => cabecerasConocidas.includes(c));

      // Mapa de columnas: por defecto orden dorsal,nombre,uciid,categoria,nac,equipo
      const ordenDefecto = { dorsal: 0, nombre: 1, uciid: 2, categoria: 3, nac: 4, equipo: 5 };
      let idx = Object.assign({}, ordenDefecto);
      let inicio = 0;
      if (esEncabezado) {
        inicio = 1;
        idx = { dorsal: -1, nombre: -1, uciid: -1, categoria: -1, nac: -1, equipo: -1 };
        primera.forEach((c, i) => {
          if (["dorsal", "numero", "nro", "#", "num"].includes(c)) idx.dorsal = i;
          else if (["nombre", "corredor", "atleta", "nombres"].includes(c)) idx.nombre = i;
          else if (["uciid", "uci id", "uci", "id uci", "uci_id"].includes(c)) idx.uciid = i;
          else if (["categoria", "cat", "categoría"].includes(c)) idx.categoria = i;
          else if (["nac", "nacionalidad", "pais", "país", "nacion"].includes(c)) idx.nac = i;
          else if (["equipo", "club", "team"].includes(c)) idx.equipo = i;
        });
        // Si no se reconoció "nombre", cae al orden por posición
        if (idx.nombre === -1) idx = Object.assign({}, ordenDefecto);
      }

      const nuevos = [];
      for (let r = inicio; r < filas.length; r++) {
        const f = filas[r];
        const get = (k) => (idx[k] >= 0 && idx[k] < f.length ? (f[idx[k]] || "").trim() : "");
        const nombre = get("nombre");
        if (!nombre) continue; // se salta filas sin nombre
        nuevos.push({
          id: uid(),
          dorsal: get("dorsal"),
          nombre,
          uciid: get("uciid"),
          categoria: get("categoria"),
          nac: get("nac"),
          equipo: get("equipo")
        });
      }

      if (!nuevos.length) {
        setCsvMsg("No se encontraron corredores válidos (revisá que haya una columna de nombre).", true);
        return;
      }

      const reemplazar = $("#csv-reemplazar").checked;
      const accion = reemplazar
        ? `REEMPLAZAR la lista actual (${estado.corredores.length}) por ${nuevos.length} corredores`
        : `AGREGAR ${nuevos.length} corredores a los ${estado.corredores.length} existentes`;
      if (!confirm(`Se van a importar ${nuevos.length} corredores.\n\nAcción: ${accion}.\n\n¿Continuar?`)) return;

      if (reemplazar) {
        estado.corredores = nuevos;
        // limpia resultados que apuntaban a corredores viejos
        estado.etapas.forEach((e) => (e.resultados = {}));
      } else {
        estado.corredores = estado.corredores.concat(nuevos);
      }
      guardar();
      renderTodo();
      setCsvMsg(`✓ Importados ${nuevos.length} corredores correctamente.`, false);
    } catch (e) {
      setCsvMsg("No se pudo leer el CSV: " + e.message, true);
    }
  };
  reader.readAsText(file, "UTF-8");
}

function setCsvMsg(txt, error) {
  const el = $("#csv-msg");
  el.textContent = txt;
  el.style.color = error ? "var(--rojo)" : "var(--verde)";
}

function descargarPlantillaCSV() {
  const contenido = "dorsal,nombre,uci id,categoria,nac,equipo\n" +
    "1,Juan Pérez,10012345678,Elite,CRC,Club Ciclista San José\n" +
    "2,María Rodríguez,10087654321,Máster A,CRC,Team Cartago\n" +
    "3,Carlos Mora,,Sub-23,MEX,\n";
  // BOM para que Excel abra bien los acentos
  const blob = new Blob(["\uFEFF" + contenido], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "plantilla-corredores.csv";
  a.click();
  URL.revokeObjectURL(a.href);
}

/* ================================================================
   PUNTUACIÓN (tablas configurables)
   ================================================================ */
function objABuffer(obj) {
  // convierte {1:5,2:3} en filas ordenadas [{pos:1,pts:5},...]
  return Object.keys(obj).map((k) => ({ pos: +k, pts: obj[k] }))
    .sort((a, b) => a.pos - b.pos);
}

function renderPuntuacion() {
  const p = estado.puntuacion;

  // Metas volantes
  renderTablaSimple("#tabla-pts-mv tbody", p.metasVolantes, "mv");
  // Top 10
  renderTablaSimple("#tabla-pts-top tbody", p.top10, "top");

  // Montaña: una tabla por categoría
  const cont = $("#montana-cats");
  cont.innerHTML = "";
  Object.keys(p.montana).sort((a, b) => +a - +b).forEach((cat) => {
    const div = document.createElement("div");
    div.className = "mini-tabla";
    let filas = objABuffer(p.montana[cat]).map((r) => `
      <tr>
        <td>${r.pos}</td>
        <td><input type="number" step="any" value="${r.pts}" data-pm-cat="${cat}" data-pm-pos="${r.pos}" /></td>
        <td class="no-print"><span class="link-action" data-pm-del="${cat}:${r.pos}">🗑️</span></td>
      </tr>`).join("");
    div.innerHTML = `
      <h4>Categoría ${cat}</h4>
      <table class="tabla-pts">
        <thead><tr><th>Pos.</th><th>Puntos</th><th class="no-print"></th></tr></thead>
        <tbody>${filas}</tbody>
      </table>
      <div class="btn-row no-print">
        <button class="btn small" data-pm-addpos="${cat}">+ posición</button>
        <button class="btn small danger" data-pm-delcat="${cat}">Eliminar categoría ${cat}</button>
      </div>`;
    cont.appendChild(div);
  });

  // listeners montaña
  cont.querySelectorAll("[data-pm-cat]").forEach((el) =>
    el.addEventListener("change", () => {
      estado.puntuacion.montana[el.dataset.pmCat][el.dataset.pmPos] = parseFloat(el.value) || 0;
      guardar(); renderMV_PM();
    }));
  cont.querySelectorAll("[data-pm-del]").forEach((el) =>
    el.addEventListener("click", () => {
      const [cat, pos] = el.dataset.pmDel.split(":");
      delete estado.puntuacion.montana[cat][pos];
      guardar(); renderPuntuacion(); renderMV_PM();
    }));
  cont.querySelectorAll("[data-pm-addpos]").forEach((el) =>
    el.addEventListener("click", () => {
      const cat = el.dataset.pmAddpos;
      const posiciones = Object.keys(estado.puntuacion.montana[cat]).map(Number);
      const nueva = (posiciones.length ? Math.max(...posiciones) : 0) + 1;
      estado.puntuacion.montana[cat][nueva] = 0;
      guardar(); renderPuntuacion();
    }));
  cont.querySelectorAll("[data-pm-delcat]").forEach((el) =>
    el.addEventListener("click", () => {
      const cat = el.dataset.pmDelcat;
      if (!confirm(`¿Eliminar la categoría de montaña ${cat} y sus puntos?`)) return;
      delete estado.puntuacion.montana[cat];
      guardar(); renderPuntuacion(); renderMV_PM();
    }));
}

function renderTablaSimple(sel, obj, tipo) {
  const tbody = $(sel);
  tbody.innerHTML = objABuffer(obj).map((r) => `
    <tr>
      <td>${r.pos}</td>
      <td><input type="number" step="any" value="${r.pts}" data-${tipo}-pos="${r.pos}" /></td>
      <td class="no-print"><span class="link-action" data-${tipo}-del="${r.pos}">🗑️</span></td>
    </tr>`).join("");

  const objetivo = tipo === "mv" ? estado.puntuacion.metasVolantes : estado.puntuacion.top10;
  tbody.querySelectorAll(`[data-${tipo}-pos]`).forEach((el) =>
    el.addEventListener("change", () => {
      objetivo[el.dataset[tipo + "Pos"]] = parseFloat(el.value) || 0;
      guardar(); renderMV_PM();
    }));
  tbody.querySelectorAll(`[data-${tipo}-del]`).forEach((el) =>
    el.addEventListener("click", () => {
      delete objetivo[el.dataset[tipo + "Del"]];
      guardar(); renderPuntuacion(); renderMV_PM();
    }));
}

function agregarPosicionSimple(cual) {
  const obj = cual === "mv" ? estado.puntuacion.metasVolantes : estado.puntuacion.top10;
  const posiciones = Object.keys(obj).map(Number);
  const nueva = (posiciones.length ? Math.max(...posiciones) : 0) + 1;
  obj[nueva] = 0;
  guardar(); renderPuntuacion();
}

function agregarCategoriaMontana() {
  const cat = prompt("Número/nombre de la categoría (ej: 1, 2, 3, 4):");
  if (!cat) return;
  if (estado.puntuacion.montana[cat]) { alert("Esa categoría ya existe."); return; }
  estado.puntuacion.montana[cat] = { 1: 4, 2: 2, 3: 1 };
  guardar(); renderPuntuacion(); renderMV_PM();
}

function restaurarPuntuacion() {
  if (!confirm("¿Restaurar las tablas de puntos a los valores por defecto?")) return;
  estado.puntuacion = JSON.parse(JSON.stringify(PUNTUACION_DEFECTO));
  guardar(); renderPuntuacion(); renderMV_PM();
}

/* ================================================================
   METAS VOLANTES y PREMIOS DE MONTAÑA (registro por etapa)
   ================================================================ */
// (opcionesCorredores fue reemplazada por entrada de dorsal con celdaDorsal)
function corredorPorDorsal(dorsal) {
  const d = String(dorsal).trim();
  if (!d) return null;
  return estado.corredores.find((c) => String(c.dorsal).trim() === d) || null;
}

// Lista ordenada de las categorías de corredor presentes en la inscripción.
function categoriasCorredores() {
  return [...new Set(estado.corredores.map((c) => (c.categoria || "").trim()).filter(Boolean))].sort();
}

// HTML de la info del corredor según su dorsal, validando que pertenezca a la categoría esperada.
function infoDorsalHTML(corredorId, dorsal, categoriaEsperada) {
  const d = String(dorsal == null ? "" : dorsal).trim();
  if (!d && !corredorId) return `<span class="corredor-info muted">—</span>`;
  const c = corredorId ? corredorPorId(corredorId) : corredorPorDorsal(d);
  if (!c) return `<span class="corredor-info error">⚠️ dorsal no encontrado</span>`;
  const cat = (c.categoria || "").trim();
  if (categoriaEsperada && cat !== categoriaEsperada) {
    return `<span class="corredor-info error">⚠️ ${escapeHtml(c.nombre)} es de ${escapeHtml(cat || "sin categoría")}, no de ${escapeHtml(categoriaEsperada)}</span>`;
  }
  return `<span class="corredor-info ok">${escapeHtml(c.nombre)}${c.equipo ? " · " + escapeHtml(c.equipo) : ""}</span>`;
}

// Celda de entrada por dorsal (Opción B): valida contra la categoría del bloque.
// tipoData: "mv" o "pm"; clave: identificador único del campo; corredorId guardado; catEsperada.
function celdaDorsal(tipoData, clave, corredorId, catEsperada) {
  const c = corredorId ? corredorPorId(corredorId) : null;
  const dorsalVal = c ? escapeHtml(c.dorsal) : "";
  return `
    <td><input type="number" class="dorsal-input" min="1" placeholder="Dorsal"
        value="${dorsalVal}" data-${tipoData}-gan="${clave}" /></td>
    <td class="corredor-cel" data-${tipoData}-info="${clave}">${infoDorsalHTML(corredorId, dorsalVal, catEsperada)}</td>`;
}

// Actualiza la celda de info sin re-renderizar toda la tabla (para no perder el foco).
function actualizarInfoDorsal(tipoData, clave, dorsal, catEsperada) {
  const cel = document.querySelector(`[data-${tipoData}-info="${CSS.escape(clave)}"]`);
  if (!cel) return;
  cel.innerHTML = infoDorsalHTML(null, dorsal, catEsperada);
}

// Devuelve el corredor válido para asignar en un bloque de categoría, o null.
// Si el dorsal existe pero es de otra categoría, NO lo asigna (retorna null).
function resolverDorsalEnCategoria(dorsal, catEsperada) {
  const c = corredorPorDorsal(dorsal);
  if (!c) return null;
  if (catEsperada && (c.categoria || "").trim() !== catEsperada) return null;
  return c;
}

/* ---- Metas Volantes ---- */
// Registro de ganadores de metas volantes en el Registro del día (usa la etapa seleccionada única).
function renderMetasVolantes() {
  const e = etapaActual();
  const cont = $("#mv-lista");
  const vacio = $("#mv-vacio");
  if (!cont) return;
  if (!e) { cont.innerHTML = ""; if (vacio) vacio.classList.remove("hidden"); renderGeneralMV(); return; }

  const cats = categoriasCorredores();
  if (!cats.length) {
    cont.innerHTML = `<div class="card"><p class="empty">Primero agregá corredores con su categoría en la pestaña Corredores.</p></div>`;
    if (vacio) vacio.classList.add("hidden");
    renderGeneralMV(); return;
  }

  const metas = e.metas || [];
  if (!metas.length) {
    cont.innerHTML = "";
    if (vacio) vacio.classList.remove("hidden");
    renderGeneralMV(); return;
  }
  if (vacio) vacio.classList.add("hidden");

  const posMV = Object.keys(estado.puntuacion.metasVolantes).map(Number).sort((a, b) => a - b);

  cont.innerHTML = metas.map((m, i) => {
    if (!m.ganadoresPorCat) m.ganadoresPorCat = {};
    const bloques = cats.map((cat) => {
      const gan = m.ganadoresPorCat[cat] || {};
      const filas = posMV.map((pos) => {
        const pts = estado.puntuacion.metasVolantes[pos];
        const clave = `${m.id}|${cat}|${pos}`;
        return `<tr>
          <td>${pos}°</td>
          ${celdaDorsal("mv", clave, gan[pos] || "", cat)}
          <td>${pts} pts</td>
        </tr>`;
      }).join("");
      return `
        <div class="cat-bloque">
          <h5 class="cat-titulo">${escapeHtml(cat)}</h5>
          <table class="tabla-pts">
            <thead><tr><th>Pos.</th><th>Dorsal</th><th>Corredor</th><th>Puntos</th></tr></thead>
            <tbody>${filas}</tbody>
          </table>
        </div>`;
    }).join("");
    return `
      <div class="mini-tabla">
        <div class="meta-head">
          <h4 class="meta-titulo">🟢 Meta ${i + 1}: ${escapeHtml(m.nombre || "(sin nombre)")}</h4>
        </div>
        <div class="cat-grid">${bloques}</div>
      </div>`;
  }).join("");

  cont.querySelectorAll("[data-mv-gan]").forEach((el) =>
    el.addEventListener("input", () => {
      const [mid, cat, pos] = el.dataset.mvGan.split("|");
      const m = e.metas.find((x) => x.id === mid);
      if (!m) return;
      if (!m.ganadoresPorCat[cat]) m.ganadoresPorCat[cat] = {};
      const dorsal = el.value.trim();
      const c = dorsal ? resolverDorsalEnCategoria(dorsal, cat) : null;
      if (c) m.ganadoresPorCat[cat][pos] = c.id;
      else delete m.ganadoresPorCat[cat][pos];
      actualizarInfoDorsal("mv", `${mid}|${cat}|${pos}`, dorsal, cat);
      guardar(); renderGeneralMV();
    }));

  renderGeneralMV();
}

function calcularGeneralMV() {
  const puntos = {};  // corredorId -> total puntos
  const conteo = {};  // corredorId -> { pos: cantidad de veces }
  let maxPos = 1;

  estado.etapas.forEach((e) => {
    (e.metas || []).forEach((m) => {
      const porCat = m.ganadoresPorCat || {};
      Object.keys(porCat).forEach((cat) => {
        Object.keys(porCat[cat]).forEach((pos) => {
          const cid = porCat[cat][pos];
          if (!cid) return;
          const pts = estado.puntuacion.metasVolantes[pos] || 0;
          puntos[cid] = (puntos[cid] || 0) + pts;
          if (!conteo[cid]) conteo[cid] = {};
          conteo[cid][pos] = (conteo[cid][pos] || 0) + 1;
          maxPos = Math.max(maxPos, +pos);
        });
      });
    });
  });

  const posTiempos = posicionesGeneralTiempos();
  return estado.corredores
    .map((c) => ({ corredor: c, total: puntos[c.id] || 0, conteo: conteo[c.id] || {} }))
    .filter((f) => f.total > 0)
    .sort((a, b) => {
      // 1) más puntos
      if (b.total !== a.total) return b.total - a.total;
      // 2) desempate: más 1os, luego 2os, 3os...
      const cmp = compararPorConteoPosiciones(a.conteo, b.conteo, maxPos);
      if (cmp !== 0) return cmp;
      // 3) mejor en la general de tiempos
      const pa = posTiempos[a.corredor.id] || 9999, pb = posTiempos[b.corredor.id] || 9999;
      return pa - pb;
    });
}

function renderGeneralMV() {
  actualizarFiltroCat("#filtro-cat-mv");
  const filtro = ($("#filtro-cat-mv") && $("#filtro-cat-mv").value) || "";
  let filas = calcularGeneralMV();
  if (filtro) filas = filas.filter((f) => (f.corredor.categoria || "") === filtro);

  const info = $("#mv-general-info");
  if (info) info.textContent = filtro ? "Categoría: " + filtro : "Todas las categorías";

  const tbody = $("#tabla-general-mv tbody");
  tbody.innerHTML = filas.map((f, i) => {
    const c = f.corredor;
    return `<tr class="${i < 3 ? "pos-" + (i + 1) : ""}">
      <td>${i + 1}</td>
      <td>${escapeHtml(c.dorsal)}</td>
      <td>${escapeHtml(c.nombre)}</td>
      <td>${escapeHtml(c.categoria)}</td>
      <td>${escapeHtml(c.equipo)}</td>
      <td>${f.total}</td>
    </tr>`;
  }).join("") || `<tr><td colspan="6" class="empty">Aún no hay puntos registrados.</td></tr>`;
}

// Rellena un <select> de categorías (de corredores) conservando la selección.
function actualizarFiltroCat(sel) {
  const el = $(sel);
  if (!el) return;
  const cats = [...new Set(estado.corredores.map((c) => c.categoria).filter(Boolean))].sort();
  const actual = el.value;
  el.innerHTML = '<option value="">Todas las categorías</option>' +
    cats.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
  el.value = actual;
}

/* ---- Premios de Montaña (registro de ganadores) ---- */
// Usa la etapa seleccionada única (Registro del día). El lugar y la categoría de premio
// se definen en Datos de competencia; acá solo se ingresan los ganadores.
function renderPremiosMontana() {
  const e = etapaActual();
  const cont = $("#pm-lista");
  const vacio = $("#pm-vacio");
  if (!cont) return;
  if (!e) { cont.innerHTML = ""; if (vacio) vacio.classList.remove("hidden"); renderGeneralPM(); return; }

  const catsCorredor = categoriasCorredores();
  if (!catsCorredor.length) {
    cont.innerHTML = `<div class="card"><p class="empty">Primero agregá corredores con su categoría en la pestaña Corredores.</p></div>`;
    if (vacio) vacio.classList.add("hidden");
    renderGeneralPM(); return;
  }

  const premios = e.montana || [];
  if (!premios.length) {
    cont.innerHTML = "";
    if (vacio) vacio.classList.remove("hidden");
    renderGeneralPM(); return;
  }
  if (vacio) vacio.classList.add("hidden");

  cont.innerHTML = premios.map((pm, i) => {
    if (!pm.ganadoresPorCat) pm.ganadoresPorCat = {};
    const tablaPts = estado.puntuacion.montana[pm.categoria] || {};
    const posiciones = Object.keys(tablaPts).map(Number).sort((a, b) => a - b);

    const bloques = catsCorredor.map((cat) => {
      const gan = pm.ganadoresPorCat[cat] || {};
      const filas = posiciones.map((pos) => {
        const clave = `${pm.id}|${cat}|${pos}`;
        return `<tr>
          <td>${pos}°</td>
          ${celdaDorsal("pm", clave, gan[pos] || "", cat)}
          <td>${tablaPts[pos]} pts</td>
        </tr>`;
      }).join("") || `<tr><td colspan="4" class="muted">Categoría de premio sin puntos configurados.</td></tr>`;
      return `
        <div class="cat-bloque">
          <h5 class="cat-titulo">${escapeHtml(cat)}</h5>
          <table class="tabla-pts">
            <thead><tr><th>Pos.</th><th>Dorsal</th><th>Corredor</th><th>Puntos</th></tr></thead>
            <tbody>${filas}</tbody>
          </table>
        </div>`;
    }).join("");

    return `
      <div class="mini-tabla">
        <div class="meta-head">
          <h4 class="meta-titulo">🔴 Premio ${i + 1}: ${escapeHtml(pm.nombre || "(sin nombre)")} <span class="badge-cat">Cat ${escapeHtml(pm.categoria)}</span></h4>
        </div>
        <div class="cat-grid">${bloques}</div>
      </div>`;
  }).join("");

  cont.querySelectorAll("[data-pm-gan]").forEach((el) =>
    el.addEventListener("input", () => {
      const [pmid, cat, pos] = el.dataset.pmGan.split("|");
      const pm = e.montana.find((x) => x.id === pmid);
      if (!pm) return;
      if (!pm.ganadoresPorCat[cat]) pm.ganadoresPorCat[cat] = {};
      const dorsal = el.value.trim();
      const c = dorsal ? resolverDorsalEnCategoria(dorsal, cat) : null;
      if (c) pm.ganadoresPorCat[cat][pos] = c.id;
      else delete pm.ganadoresPorCat[cat][pos];
      actualizarInfoDorsal("pm", `${pmid}|${cat}|${pos}`, dorsal, cat);
      guardar(); renderGeneralPM();
    }));

  renderGeneralPM();
}

function calcularGeneralPM() {
  const puntos = {};
  // primerosPorCatPremio[corredorId][categoriaPremio] = cantidad de 1os puestos
  const primeros = {};

  estado.etapas.forEach((e) => {
    (e.montana || []).forEach((pm) => {
      const tablaCat = estado.puntuacion.montana[pm.categoria] || {};
      const porCat = pm.ganadoresPorCat || {};
      Object.keys(porCat).forEach((cat) => {
        Object.keys(porCat[cat]).forEach((pos) => {
          const cid = porCat[cat][pos];
          if (!cid) return;
          const pts = tablaCat[pos] || 0;
          puntos[cid] = (puntos[cid] || 0) + pts;
          if (+pos === 1) {
            if (!primeros[cid]) primeros[cid] = {};
            primeros[cid][pm.categoria] = (primeros[cid][pm.categoria] || 0) + 1;
          }
        });
      });
    });
  });

  // Categorías de premio ordenadas de la "más elevada" a la menor.
  // En ciclismo la 1ª es la más dura; con la config actual (3 y 4) equivale a
  // ordenar de menor número a mayor: 3 antes que 4.
  const catsPremioOrden = Object.keys(estado.puntuacion.montana).sort((a, b) => +a - +b);
  const posTiempos = posicionesGeneralTiempos();

  return estado.corredores
    .map((c) => ({ corredor: c, total: puntos[c.id] || 0, primeros: primeros[c.id] || {} }))
    .filter((f) => f.total > 0)
    .sort((a, b) => {
      // 1) más puntos
      if (b.total !== a.total) return b.total - a.total;
      // 2) desempate: más 1os en la categoría más elevada, luego la siguiente...
      for (const cat of catsPremioOrden) {
        const pa = a.primeros[cat] || 0, pb = b.primeros[cat] || 0;
        if (pa !== pb) return pb - pa;
      }
      // 3) mejor en la general de tiempos
      const ta = posTiempos[a.corredor.id] || 9999, tb = posTiempos[b.corredor.id] || 9999;
      return ta - tb;
    });
}

function renderGeneralPM() {
  actualizarFiltroCat("#filtro-cat-pm");
  const filtro = ($("#filtro-cat-pm") && $("#filtro-cat-pm").value) || "";
  let filas = calcularGeneralPM();
  if (filtro) filas = filas.filter((f) => (f.corredor.categoria || "") === filtro);

  const info = $("#pm-general-info");
  if (info) info.textContent = filtro ? "Categoría: " + filtro : "Todas las categorías";

  const tbody = $("#tabla-general-pm tbody");
  tbody.innerHTML = filas.map((f, i) => {
    const c = f.corredor;
    return `<tr class="${i < 3 ? "pos-" + (i + 1) : ""}">
      <td>${i + 1}</td>
      <td>${escapeHtml(c.dorsal)}</td>
      <td>${escapeHtml(c.nombre)}</td>
      <td>${escapeHtml(c.categoria)}</td>
      <td>${escapeHtml(c.equipo)}</td>
      <td>${f.total}</td>
    </tr>`;
  }).join("") || `<tr><td colspan="6" class="empty">Aún no hay puntos registrados.</td></tr>`;
}

function renderMV_PM() {
  renderMetasVolantes();
  renderPremiosMontana();
}

function imprimirGeneralMV() {
  mostrarSoloTab("metas");
  const cat = ($("#filtro-cat-mv") && $("#filtro-cat-mv").value) || "";
  prepararEncabezadoImpresion("Clasificación general · Metas Volantes" + (cat ? " · Categoría: " + cat : ""));
  window.print();
}
function imprimirGeneralPM() {
  mostrarSoloTab("montana");
  const cat = ($("#filtro-cat-pm") && $("#filtro-cat-pm").value) || "";
  prepararEncabezadoImpresion("Clasificación general · Premios de Montaña" + (cat ? " · Categoría: " + cat : ""));
  window.print();
}

/* ================================================================
   CLASIFICACIÓN POR EQUIPOS
   ================================================================ */

// Lista de equipos presentes en la inscripción (no vacíos).
function equiposLista() {
  return [...new Set(estado.corredores.map((c) => (c.equipo || "").trim()).filter(Boolean))].sort();
}

// Clasificación por equipos de UNA etapa.
// Cada equipo = suma de los 3 mejores tiempos (corredores con tiempo válido y estado ok).
// Devuelve filas ordenadas con: equipo, seg (suma), sumaPuestos, mejorPuesto, completos(bool).
function calcularEquiposEtapa(etapa) {
  const posiciones = calcularPosicionesEtapa(etapa); // corredorId -> puesto individual en la etapa
  const porEquipo = {};

  estado.corredores.forEach((c) => {
    const eq = (c.equipo || "").trim();
    if (!eq) return;
    const r = etapa.resultados[c.id];
    if (!r || r.estado !== "ok") return;
    const seg = tiempoASegundos(r.tiempo);
    if (seg == null) return;
    const puesto = posiciones[c.id] || 9999;
    if (!porEquipo[eq]) porEquipo[eq] = [];
    porEquipo[eq].push({ seg, puesto });
  });

  const filas = Object.keys(porEquipo).map((eq) => {
    const corredores = porEquipo[eq].sort((a, b) => a.seg - b.seg);
    const mejores3 = corredores.slice(0, 3);
    const completos = mejores3.length >= 3;
    const seg = mejores3.reduce((s, x) => s + x.seg, 0);
    const sumaPuestos = mejores3.reduce((s, x) => s + x.puesto, 0);
    const mejorPuesto = mejores3.length ? Math.min(...mejores3.map((x) => x.puesto)) : 9999;
    return { equipo: eq, seg, sumaPuestos, mejorPuesto, completos, cantidad: mejores3.length };
  }).filter((f) => f.completos); // se necesita al menos 3 tiempos

  // Orden diaria: menor tiempo; desempate suma de puestos; luego mejor corredor
  filas.sort((a, b) => {
    if (a.seg !== b.seg) return a.seg - b.seg;
    if (a.sumaPuestos !== b.sumaPuestos) return a.sumaPuestos - b.sumaPuestos;
    return a.mejorPuesto - b.mejorPuesto;
  });
  filas.forEach((f, i) => (f.posicion = i + 1));
  return filas;
}

// Clasificación general por equipos: suma de los 3 mejores tiempos de todas las etapas.
function calcularEquiposGeneral() {
  const acum = {}; // equipo -> { seg, etapasCompletas, primeros:{pos:cant} }
  const posEtapaPorEquipo = {}; // equipo -> [puestos en cada etapa]

  // recolectar puestos de la clasificación por equipos de cada etapa (para desempate)
  estado.etapas.forEach((e) => {
    const clasif = calcularEquiposEtapa(e);
    clasif.forEach((f) => {
      if (!posEtapaPorEquipo[f.equipo]) posEtapaPorEquipo[f.equipo] = {};
      posEtapaPorEquipo[f.equipo][f.posicion] = (posEtapaPorEquipo[f.equipo][f.posicion] || 0) + 1;
    });
  });

  const posIndiv = posicionesGeneralTiempos(); // corredorId -> pos general individual

  // suma de tiempos por equipo (3 mejores por etapa, sumados en todas las etapas)
  const equipos = equiposLista();
  const filas = equipos.map((eq) => {
    let seg = 0, etapasValidas = 0, completoTodas = true;
    estado.etapas.forEach((e) => {
      const clasif = calcularEquiposEtapa(e).find((f) => f.equipo === eq);
      if (clasif) { seg += clasif.seg; etapasValidas++; }
      else completoTodas = false;
    });
    // mejor corredor del equipo en la general individual (para último desempate)
    let mejorIndiv = 9999;
    estado.corredores.forEach((c) => {
      if ((c.equipo || "").trim() === eq && posIndiv[c.id]) mejorIndiv = Math.min(mejorIndiv, posIndiv[c.id]);
    });
    return {
      equipo: eq, seg, etapasValidas, completoTodas,
      primeros: posEtapaPorEquipo[eq] || {}, mejorIndiv
    };
  }).filter((f) => f.etapasValidas > 0);

  const maxPos = equipos.length || 1;
  filas.sort((a, b) => {
    // solo comparan directo si ambos completaron todas las etapas; los incompletos van al final
    if (a.completoTodas !== b.completoTodas) return a.completoTodas ? -1 : 1;
    if (a.seg !== b.seg) return a.seg - b.seg;
    // desempate: más 1os en la clasif por equipos de etapa, luego 2os...
    const cmp = compararPorConteoPosiciones(a.primeros, b.primeros, maxPos);
    if (cmp !== 0) return cmp;
    // luego mejor corredor en la general individual
    return a.mejorIndiv - b.mejorIndiv;
  });
  filas.forEach((f, i) => (f.posicion = i + 1));
  return filas;
}

function renderEquipos() {
  // Diaria (etapa seleccionada, reutiliza el selector propio de esta pestaña)
  const sel = $("#sel-etapa-eq");
  if (sel) {
    sel.innerHTML = estado.etapas.map((e) =>
      `<option value="${e.id}">${escapeHtml(e.nombre)}${e.fecha ? " · " + e.fecha : ""}</option>`).join("");
    if (!estado.seleccion.etapaEq && estado.etapas.length) estado.seleccion.etapaEq = estado.etapas[0].id;
    if (estado.seleccion.etapaEq) sel.value = estado.seleccion.etapaEq;
  }

  const e = etapaPorId(estado.seleccion.etapaEq);
  const tbodyD = $("#tabla-equipos-etapa tbody");
  if (e) {
    const filas = calcularEquiposEtapa(e);
    tbodyD.innerHTML = filas.map((f) => `
      <tr class="${f.posicion <= 3 ? "pos-" + f.posicion : ""}">
        <td>${f.posicion}</td>
        <td>${escapeHtml(f.equipo)}</td>
        <td>${segundosATiempo(f.seg)}</td>
      </tr>`).join("") || `<tr><td colspan="3" class="empty">No hay equipos con al menos 3 tiempos en esta etapa.</td></tr>`;
  } else {
    tbodyD.innerHTML = `<tr><td colspan="3" class="empty">No hay etapas.</td></tr>`;
  }

  // General
  const filasG = calcularEquiposGeneral();
  const lider = filasG.find((f) => f.posicion === 1);
  const tbodyG = $("#tabla-equipos-general tbody");
  tbodyG.innerHTML = filasG.map((f) => {
    const dif = (lider && f.completoTodas && f.posicion !== 1) ? "+" + segundosATiempo(f.seg - lider.seg)
      : (f.posicion === 1 ? "—" : "");
    return `<tr class="${f.posicion <= 3 ? "pos-" + f.posicion : ""}">
      <td>${f.posicion}</td>
      <td>${escapeHtml(f.equipo)}</td>
      <td>${segundosATiempo(f.seg)}${f.completoTodas ? "" : " *"}</td>
      <td>${dif}</td>
      <td>${f.etapasValidas}/${estado.etapas.length}</td>
    </tr>`;
  }).join("") || `<tr><td colspan="5" class="empty">Aún no hay datos suficientes.</td></tr>`;

  const info = $("#equipos-info");
  if (info) info.textContent = "Suma de los 3 mejores tiempos por equipo. (*) no completó todas las etapas.";
}

function imprimirEquipos() {
  mostrarSoloTab("equipos");
  prepararEncabezadoImpresion("Clasificación por Equipos");
  window.print();
}

/* ================================================================
   ORDEN DE CARAVANA (rifa por cantidad de integrantes)
   ================================================================ */
// Cantidad de corredores por equipo.
function integrantesPorEquipo() {
  const conteo = {};
  estado.corredores.forEach((c) => {
    const eq = (c.equipo || "").trim();
    if (!eq) return;
    conteo[eq] = (conteo[eq] || 0) + 1;
  });
  return conteo; // { equipo: cantidad }
}

// Grupo de rifa según cantidad: 1 = 5-6, 2 = 4-3, 3 = menos de 3.
function grupoCaravana(cant) {
  if (cant >= 5) return 1;
  if (cant >= 3) return 2;
  return 3;
}

const NOMBRE_GRUPO_CARAVANA = {
  1: "1° Equipos de 5 o 6 corredores",
  2: "2° Equipos de 4 y 3 corredores",
  3: "3° Equipos de menos de 3 corredores"
};

// Genera (rifa) un orden aleatorio dentro de cada grupo y lo guarda.
function rifarCaravana() {
  const conteo = integrantesPorEquipo();
  const grupos = { 1: [], 2: [], 3: [] };
  Object.keys(conteo).forEach((eq) => grupos[grupoCaravana(conteo[eq])].push(eq));

  // baraja cada grupo (Fisher–Yates)
  const orden = [];
  [1, 2, 3].forEach((g) => {
    const arr = grupos[g];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    arr.forEach((eq) => orden.push({ equipo: eq, grupo: g, integrantes: conteo[eq] }));
  });

  estado.caravana = orden;
  guardar();
  renderCaravana();
}

function renderCaravana() {
  const tbody = $("#tabla-caravana tbody");
  if (!tbody) return;
  const orden = estado.caravana || [];
  if (!orden.length) {
    tbody.innerHTML = `<tr><td colspan="4" class="empty">Presioná “🎲 Rifar orden” para generar el orden de caravana.</td></tr>`;
    return;
  }
  tbody.innerHTML = orden.map((o, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${escapeHtml(o.equipo)}</td>
      <td>${o.integrantes}</td>
      <td class="muted">${escapeHtml(NOMBRE_GRUPO_CARAVANA[o.grupo])}</td>
    </tr>`).join("");
}

function imprimirCaravana() {
  mostrarSoloTab("equipos");
  prepararEncabezadoImpresion("Orden de Caravana");
  window.print();
}

/* ---------- UI ---------- */
function escapeHtml(str) {
  return String(str == null ? "" : str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function mostrarSoloTab(tab) {
  $$(".tab-btn").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  $$(".tab-panel").forEach((p) => p.classList.toggle("hidden", p.id !== "tab-" + tab));
}

function cargarConfigEnUI() {
  const ev = estado.evento;
  $("#ev-nombre").value = ev.nombre || "";
  $("#ev-organiza").value = ev.organiza || "";
  $("#ev-comisario").value = ev.comisario || "";
  $("#ev-tipo").value = ev.tipo || "tiempo";
  $("#ev-esquema-puntos").value = ev.esquemaPuntos || "";
  $("#puntos-config").classList.toggle("hidden", ev.tipo !== "puntos");
}

function renderTodo() {
  renderCorredores();
  renderCompetencia();
  renderEtapa();
  renderGeneral();
  renderPuntuacion();
  renderMV_PM();
  renderEquipos();
  renderCaravana();
  actualizarDatalistCategorias();
}

// Sub-pestañas dentro de "Registro del día" (Tiempos / Metas / Montaña)
function mostrarSubtab(sub) {
  $$(".subtab-btn").forEach((b) => b.classList.toggle("active", b.dataset.subtab === sub));
  $$(".subpanel").forEach((p) => p.classList.toggle("hidden", p.id !== "subtab-" + sub));
}

/* ---------- Eventos ---------- */
function init() {
  cargar();
  cargarConfigEnUI();
  renderTodo();

  // Config evento
  $("#ev-nombre").addEventListener("input", (e) => { estado.evento.nombre = e.target.value; guardar(); });
  $("#ev-organiza").addEventListener("input", (e) => { estado.evento.organiza = e.target.value; guardar(); });
  $("#ev-comisario").addEventListener("input", (e) => { estado.evento.comisario = e.target.value; guardar(); });
  $("#ev-tipo").addEventListener("change", (e) => {
    estado.evento.tipo = e.target.value;
    $("#puntos-config").classList.toggle("hidden", e.target.value !== "puntos");
    guardar(); renderTodo();
  });
  $("#ev-esquema-puntos").addEventListener("input", (e) => { estado.evento.esquemaPuntos = e.target.value; guardar(); renderGeneral(); });

  // Tabs
  $$(".tab-btn").forEach((b) => b.addEventListener("click", () => mostrarSoloTab(b.dataset.tab)));

  // Corredores
  $("#btn-add-corredor").addEventListener("click", agregarCorredor);
  ["#c-dorsal", "#c-nombre", "#c-uciid", "#c-categoria", "#c-nac", "#c-equipo"].forEach((s) =>
    $(s).addEventListener("keydown", (e) => { if (e.key === "Enter") agregarCorredor(); }));
  $("#buscar-corredor").addEventListener("input", renderCorredores);
  $("#filtro-cat-corredor").addEventListener("change", renderCorredores);
  $("#filtro-eq-corredor").addEventListener("change", renderCorredores);
  $("#btn-importar-csv").addEventListener("click", () => $("#file-csv").click());
  $("#btn-plantilla-csv").addEventListener("click", descargarPlantillaCSV);
  $("#file-csv").addEventListener("change", (e) => { if (e.target.files[0]) importarCSV(e.target.files[0]); e.target.value = ""; });
  $$("#tabla-corredores th[data-sort]").forEach((th) =>
    th.addEventListener("click", () => {
      const campo = th.dataset.sort;
      ordenCorredores.asc = ordenCorredores.campo === campo ? !ordenCorredores.asc : true;
      ordenCorredores.campo = campo;
      renderCorredores();
    }));

  // Datos de competencia
  $("#btn-nueva-etapa").addEventListener("click", nuevaEtapa);
  $("#btn-imprimir-competencia").addEventListener("click", imprimirCompetencia);

  // Registro del día
  $("#sel-etapa").addEventListener("change", (e) => {
    estado.seleccion.etapaId = e.target.value; guardar();
    renderEtapa(); renderMetasVolantes(); renderPremiosMontana();
  });
  $("#btn-imprimir-etapa").addEventListener("click", imprimirEtapa);
  $$(".subtab-btn").forEach((b) => b.addEventListener("click", () => mostrarSubtab(b.dataset.subtab)));

  // Cronómetro
  $("#crono-start").addEventListener("click", cronoStart);
  $("#crono-pausa").addEventListener("click", cronoPausa);
  $("#crono-reset").addEventListener("click", cronoReset);
  $("#crono-marcar-btn").addEventListener("click", cronoMarcar);
  $("#crono-dorsal").addEventListener("keydown", (e) => { if (e.key === "Enter") cronoMarcar(); });

  // General
  $("#filtro-categoria").addEventListener("change", renderGeneral);
  $("#btn-imprimir-general").addEventListener("click", imprimirGeneral);

  // Puntuación
  $("#btn-pts-mv-add").addEventListener("click", () => agregarPosicionSimple("mv"));
  $("#btn-pts-top-add").addEventListener("click", () => agregarPosicionSimple("top"));
  $("#btn-pts-montana-add").addEventListener("click", agregarCategoriaMontana);
  $("#btn-pts-restaurar").addEventListener("click", restaurarPuntuacion);

  // Metas Volantes (general acumulada)
  $("#btn-imprimir-mv").addEventListener("click", imprimirGeneralMV);
  $("#filtro-cat-mv").addEventListener("change", renderGeneralMV);

  // Premios de Montaña (general acumulada)
  $("#btn-imprimir-pm").addEventListener("click", imprimirGeneralPM);
  $("#filtro-cat-pm").addEventListener("change", renderGeneralPM);

  // Equipos
  $("#sel-etapa-eq").addEventListener("change", (e) => { estado.seleccion.etapaEq = e.target.value; guardar(); renderEquipos(); });
  $("#btn-imprimir-equipos").addEventListener("click", imprimirEquipos);
  $("#btn-rifar-caravana").addEventListener("click", rifarCaravana);
  $("#btn-imprimir-caravana").addEventListener("click", imprimirCaravana);

  // Respaldo
  $("#btn-exportar").addEventListener("click", exportar);
  $("#btn-importar").addEventListener("click", () => $("#file-importar").click());
  $("#file-importar").addEventListener("change", (e) => { if (e.target.files[0]) importar(e.target.files[0]); e.target.value = ""; });
  $("#btn-borrar-todo").addEventListener("click", borrarTodo);
}

document.addEventListener("DOMContentLoaded", init);
