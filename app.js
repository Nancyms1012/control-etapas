/* Control de Etapas · Ciclismo
   Federación Costarricense de Ciclismo
   App estática: HTML + CSS + JS, persistencia en localStorage.
*/

const STORAGE_KEY = "controlEtapas_v1";

/* ---------- Estado ---------- */
let estado = {
  evento: { nombre: "", organiza: "", comisario: "", tipo: "tiempo", esquemaPuntos: "" },
  corredores: [], // { id, dorsal, nombre, categoria, equipo }
  etapas: [],     // { id, numero, nombre, fecha, resultados: { [corredorId]: { estado, tiempo, puntos, posicion } } }
  seleccion: { etapaId: null }
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
  const categoria = $("#c-categoria").value.trim();
  const equipo = $("#c-equipo").value.trim();
  if (!nombre) { alert("El nombre es obligatorio."); return; }
  if (dorsal && estado.corredores.some((c) => String(c.dorsal) === String(dorsal))) {
    if (!confirm("Ya existe un corredor con ese dorsal. ¿Agregar de todos modos?")) return;
  }
  estado.corredores.push({ id: uid(), dorsal, nombre, categoria, equipo });
  ["#c-dorsal", "#c-nombre", "#c-categoria", "#c-equipo"].forEach((s) => ($(s).value = ""));
  $("#c-dorsal").focus();
  guardar();
  renderTodo();
}

let ordenCorredores = { campo: "dorsal", asc: true };
function renderCorredores() {
  const tbody = $("#tabla-corredores tbody");
  const filtro = ($("#buscar-corredor").value || "").toLowerCase();
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
      [c.dorsal, c.nombre, c.categoria, c.equipo].join(" ").toLowerCase().includes(filtro));
  }

  tbody.innerHTML = "";
  lista.forEach((c) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(c.dorsal)}</td>
      <td>${escapeHtml(c.nombre)}</td>
      <td>${escapeHtml(c.categoria)}</td>
      <td>${escapeHtml(c.equipo)}</td>
      <td class="no-print">
        <span class="link-action" data-edit="${c.id}">✏️</span>
        <span class="link-action" data-del="${c.id}">🗑️</span>
      </td>`;
    tbody.appendChild(tr);
  });
  $("#count-corredores").textContent = estado.corredores.length;

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
  const categoria = prompt("Categoría:", c.categoria); if (categoria === null) return;
  const equipo = prompt("Equipo:", c.equipo); if (equipo === null) return;
  Object.assign(c, { dorsal: dorsal.trim(), nombre: nombre.trim(), categoria: categoria.trim(), equipo: equipo.trim() });
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

/* ---------- Etapas ---------- */
function etapaPorId(id) { return estado.etapas.find((e) => e.id === id); }
function etapaActual() { return etapaPorId(estado.seleccion.etapaId); }

function nuevaEtapa() {
  const numero = estado.etapas.length + 1;
  const nombre = prompt("Nombre de la etapa:", `Etapa ${numero}`);
  if (nombre === null) return;
  const fecha = prompt("Fecha (AAAA-MM-DD):", new Date().toISOString().slice(0, 10));
  if (fecha === null) return;
  const etapa = { id: uid(), numero, nombre: nombre.trim() || `Etapa ${numero}`, fecha: (fecha || "").trim(), resultados: {} };
  estado.etapas.push(etapa);
  estado.seleccion.etapaId = etapa.id;
  guardar();
  renderTodo();
}

function editarEtapa() {
  const e = etapaActual();
  if (!e) return;
  const nombre = prompt("Nombre de la etapa:", e.nombre); if (nombre === null) return;
  const fecha = prompt("Fecha (AAAA-MM-DD):", e.fecha); if (fecha === null) return;
  e.nombre = nombre.trim() || e.nombre;
  e.fecha = (fecha || "").trim();
  guardar();
  renderTodo();
}

function eliminarEtapa() {
  const e = etapaActual();
  if (!e) return;
  if (!confirm(`¿Eliminar "${e.nombre}" y todos sus resultados?`)) return;
  estado.etapas = estado.etapas.filter((x) => x.id !== e.id);
  estado.etapas.forEach((et, i) => (et.numero = i + 1));
  estado.seleccion.etapaId = estado.etapas.length ? estado.etapas[0].id : null;
  guardar();
  renderTodo();
}

function renderSelectEtapas() {
  const sel = $("#sel-etapa");
  sel.innerHTML = estado.etapas
    .map((e) => `<option value="${e.id}">${escapeHtml(e.nombre)}${e.fecha ? " · " + e.fecha : ""}</option>`)
    .join("");
  if (estado.seleccion.etapaId) sel.value = estado.seleccion.etapaId;
}

function resultadoDe(etapa, corredorId) {
  if (!etapa.resultados[corredorId]) {
    etapa.resultados[corredorId] = { estado: "ok", tiempo: "", puntos: "" };
  }
  return etapa.resultados[corredorId];
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
  $("#etapa-info").textContent = (e.fecha ? "Fecha: " + e.fecha + " · " : "") +
    (tipo === "tiempo" ? "Clasificación por tiempo" : "Clasificación por puntos");
  $("#th-resultado").textContent = tipo === "tiempo" ? "Tiempo (h:mm:ss)" : "Puntos";

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

/* ---------- Impresión ---------- */
function prepararEncabezadoImpresion(subtitulo) {
  const ev = estado.evento;
  $("#print-header").innerHTML = `
    <h1>${escapeHtml(ev.nombre || "Evento de ciclismo")}</h1>
    ${ev.organiza ? `<p>${escapeHtml(ev.organiza)}</p>` : ""}
    <p><strong>${escapeHtml(subtitulo)}</strong></p>
    ${ev.comisario ? `<p>Comisario: ${escapeHtml(ev.comisario)}</p>` : ""}
    <p>Impreso: ${new Date().toLocaleString("es-CR")}</p>`;
}

function imprimirEtapa() {
  const e = etapaActual();
  if (!e) return;
  mostrarSoloTab("etapas");
  prepararEncabezadoImpresion(`Resultados ${e.nombre}${e.fecha ? " · " + e.fecha : ""}`);
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
      const cabecerasConocidas = ["dorsal", "nombre", "categoria", "equipo", "numero", "nro", "#"];
      const primera = filas[0].map(normalizar);
      const esEncabezado = primera.some((c) => cabecerasConocidas.includes(c));

      // Mapa de columnas: por defecto orden dorsal,nombre,categoria,equipo
      let idx = { dorsal: 0, nombre: 1, categoria: 2, equipo: 3 };
      let inicio = 0;
      if (esEncabezado) {
        inicio = 1;
        idx = { dorsal: -1, nombre: -1, categoria: -1, equipo: -1 };
        primera.forEach((c, i) => {
          if (["dorsal", "numero", "nro", "#", "num"].includes(c)) idx.dorsal = i;
          else if (["nombre", "corredor", "atleta", "nombres"].includes(c)) idx.nombre = i;
          else if (["categoria", "cat", "categoría"].includes(c)) idx.categoria = i;
          else if (["equipo", "club", "team"].includes(c)) idx.equipo = i;
        });
        // Si no se reconoció "nombre", cae al orden por posición
        if (idx.nombre === -1) idx = { dorsal: 0, nombre: 1, categoria: 2, equipo: 3 };
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
          categoria: get("categoria"),
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
  const contenido = "dorsal,nombre,categoria,equipo\n" +
    "1,Juan Pérez,Elite,Club Ciclista San José\n" +
    "2,María Rodríguez,Máster A,Team Cartago\n" +
    "3,Carlos Mora,Sub-23,\n";
  // BOM para que Excel abra bien los acentos
  const blob = new Blob(["\uFEFF" + contenido], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "plantilla-corredores.csv";
  a.click();
  URL.revokeObjectURL(a.href);
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
  renderEtapa();
  renderGeneral();
  actualizarDatalistCategorias();
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
  ["#c-dorsal", "#c-nombre", "#c-categoria", "#c-equipo"].forEach((s) =>
    $(s).addEventListener("keydown", (e) => { if (e.key === "Enter") agregarCorredor(); }));
  $("#buscar-corredor").addEventListener("input", renderCorredores);
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

  // Etapas
  $("#btn-nueva-etapa").addEventListener("click", nuevaEtapa);
  $("#btn-editar-etapa").addEventListener("click", editarEtapa);
  $("#btn-eliminar-etapa").addEventListener("click", eliminarEtapa);
  $("#sel-etapa").addEventListener("change", (e) => { estado.seleccion.etapaId = e.target.value; guardar(); renderEtapa(); });
  $("#btn-imprimir-etapa").addEventListener("click", imprimirEtapa);

  // General
  $("#filtro-categoria").addEventListener("change", renderGeneral);
  $("#btn-imprimir-general").addEventListener("click", imprimirGeneral);

  // Respaldo
  $("#btn-exportar").addEventListener("click", exportar);
  $("#btn-importar").addEventListener("click", () => $("#file-importar").click());
  $("#file-importar").addEventListener("change", (e) => { if (e.target.files[0]) importar(e.target.files[0]); e.target.value = ""; });
  $("#btn-borrar-todo").addEventListener("click", borrarTodo);
}

document.addEventListener("DOMContentLoaded", init);
