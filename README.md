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
- **Corredores:** dorsal, nombre, categoría y equipo. Agregar, editar, eliminar, buscar y ordenar.
- **Etapas:** crear varias etapas (con nombre y fecha). Por cada etapa se registra el
  **tiempo o puntos** de cada corredor y su **estado**: OK, **DNF** (no finalizó),
  **DNS** (no salió), **DSQ** (descalificado). La posición de cada etapa se calcula sola.
- **Clasificación general (acumulado):** se calcula automáticamente a partir de las etapas,
  con diferencia de tiempo respecto al líder (en modo tiempo) y filtro por categoría.
- **Imprimir / PDF:** botones para imprimir la etapa o la general con encabezado del evento
  (nombre, organizador, comisario y fecha de impresión).
- **Respaldo `.json`:** exportar/importar todos los datos para pasarlos entre computadora y
  celular (no es sincronización automática).

## Uso

Abrí `index.html` en cualquier navegador. Funciona sin conexión una vez cargada.

1. Completá la **Configuración del evento** y elegí el tipo de clasificación.
2. En **Corredores**, agregá a los participantes.
3. En **Etapas**, creá cada etapa e ingresá tiempos/puntos y estados.
4. En **Clasificación general** ves el acumulado; usá los botones de imprimir para generar el PDF.
5. En **Respaldo**, exportá el `.json` para tener copia o pasarlo a otro dispositivo.

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
