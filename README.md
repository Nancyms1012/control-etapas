# 🚴 Control de Etapas · Ciclismo

App web para llevar el control diario de corredores y la clasificación general (acumulado)
en eventos de ciclismo de **varias etapas**. Pensada para uso de comisarios de la
**Federación Costarricense de Ciclismo**.

Sitio estático (HTML + CSS + JavaScript), sin backend. Todos los datos se guardan
en el navegador (`localStorage`) y se pueden respaldar en un archivo `.json`.

## Funciones

- **Configuración del evento:** nombre, organiza, comisario y tipo de clasificación.
- **Dos modos de clasificación:**
  - **Por tiempo** — se suman los tiempos de cada etapa; gana el menor tiempo total.
  - **Por puntos** — se suman los puntos; gana el mayor puntaje. Admite un esquema de
    puntos por posición (ej: `25,20,16,13,...`) o puntos ingresados a mano.
- **Cronómetro en la etapa (modo tiempo):** iniciás el crono al dar la salida y marcás la
  llegada de cada corredor escribiendo su dorsal; el tiempo se guarda solo en su fila.
- **Metas Volantes (por categoría):** por etapa agregás cada meta y registrás las posiciones
  **por cada categoría de corredor** (cada categoría reparte sus propios puntos, ej. 5/3/1). Se
  ingresa por **dorsal** y la app muestra el nombre/equipo y **valida que el corredor sea de esa
  categoría** (avisa si no lo es). Las categorías se detectan solas según los corredores inscritos.
  Genera la **clasificación general de metas volantes** (rey de las metas) con filtro por categoría.
- **Premios de Montaña (por categoría):** igual que las metas, pero cada premio tiene además su
  **categoría de premio** (3/4 por defecto, configurable) que define cuántos puntos reparte. Dentro,
  se registra por cada categoría de corredor. Genera la **clasificación general de montaña** (rey de
  la montaña) con filtro.
- **Desempates (según Guía Técnica FECOCI):**
  - *Metas volantes:* más 1os puestos → más 2os, 3os… → mejor puesto en la general individual por tiempos.
  - *Montaña:* más 1os en la categoría de premio más elevada → siguiente categoría… → general individual.
- **Clasificación por Equipos:**
  - *Diaria (por etapa):* suma de los **3 mejores tiempos** del equipo; menor tiempo gana. Desempate por
    suma de puestos de esos 3 y luego por su mejor corredor. Equipos con menos de 3 tiempos quedan fuera.
  - *General:* suma de los 3 mejores tiempos de todas las etapas. Desempate por más 1os/2os en la
    clasificación por equipos de etapa y luego por el mejor corredor en la general individual.
- **Orden de Caravana:** rifa (sorteo) del orden por grupos según la cantidad de integrantes de cada
  equipo: primero los de 5-6, luego los de 4-3, y por último los de menos de 3 corredores.
- **Puntuación configurable:** tablas editables de puntos para Metas Volantes, Premios de
  Montaña (por categoría) y Top 10 de etapa. Vienen con los valores de la Federación y se
  pueden cambiar por evento.
- **Corredores:** dorsal, nombre, UCI ID, categoría, nacionalidad y equipo. Agregar, editar, eliminar, buscar y ordenar.
  - **Importar desde CSV:** subí un archivo `.csv` (o un Excel guardado como CSV) con las
    columnas `dorsal, nombre, uci id, categoria, nac, equipo` para cargar decenas de corredores de una vez.
    Detecta automáticamente el separador (`,`, `;` o tab) y si la primera fila es encabezado.
    Podés **agregar** al final o **reemplazar** la lista. Hay una **plantilla descargable**.
- **Datos de competencia:** definís de antemano cada etapa con **nombre, fecha, hora de salida,
  distancia (km) y recorrido**, y las listas de **metas volantes** (lugar) y **premios de montaña**
  (lugar + categoría de premio). Es la hoja de ruta maestra; se puede imprimir.
- **Registro del día:** elegís la etapa/día y registrás TODO lo de esa jornada en un solo lugar,
  con sub-pestañas: **⏱️ Tiempos** (con cronómetro y estado OK/DNF/DNS/DSQ), **🟢 Metas Volantes**
  y **🔴 Montaña** (los ganadores por dorsal). Las metas y premios que aparecen son los definidos
  en Datos de competencia.
- **Clasificación general (acumulado):** se calcula automáticamente a partir de las etapas,
  con diferencia de tiempo respecto al líder (en modo tiempo) y filtro por categoría.
- **Imprimir / PDF:** botones para imprimir la etapa o la general con encabezado del evento
  (nombre, organizador, comisario y fecha de impresión).
- **Respaldo `.json`:** exportar/importar todos los datos para pasarlos entre computadora y
  celular (no es sincronización automática).

## Uso

Abrí `index.html` en cualquier navegador. Funciona sin conexión una vez cargada.

1. Completá la **Configuración del evento** y elegí el tipo de clasificación.
2. En **Corredores**, agregá a los participantes (o importá el CSV).
3. En **Datos de competencia**, creá cada etapa con su recorrido y sus metas volantes y premios de montaña.
4. Durante la carrera, en **Registro del día** elegís la etapa y anotás tiempos, metas y montaña.
5. Las clasificaciones **General, Metas Volantes, Montaña y Equipos** se forman solas (acumulado).
6. En **Respaldo**, exportá el `.json` para tener copia o pasarlo a otro dispositivo.

## Despliegue en Cloudflare Pages

Sitio estático, sin build:

- **Framework preset:** None
- **Build command:** (vacío)
- **Build output directory:** `/`

Cada `push` a la rama `main` dispara un redeploy automático.

## Notas técnicas

- Clave de `localStorage`: `controlEtapas_v1`.
- Formato de tiempo aceptado: `h:mm:ss`, `mm:ss` o segundos (admite decimales).
- Los datos son por dispositivo/navegador; usá el respaldo `.json` para moverlos.
