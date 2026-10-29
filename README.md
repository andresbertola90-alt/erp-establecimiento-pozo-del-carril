# Pozo del Carril - UNRC: base para AI Studio

Copia del sistema local 1.4.0 preparada el 29/09/2026. No es una migracion
terminada a la nube. No contiene datos reales ni cuentas del usuario.

## Arranque

Node.js 20 o posterior. No requiere instalar dependencias para esta copia:

```sh
npm start
npm test
```

La vista local abre en http://localhost:3000. En un contenedor de vista previa
configurar `HOST=0.0.0.0` y el `PORT` que indique la plataforma. El valor por
defecto solo escucha en el propio equipo. No iniciar servidores en 0.0.0.0
con datos reales sin completar primero el backend de acceso.

Tambien se conserva la apertura directa de index.html. Cada origen web tiene
almacenamiento separado; cambiar de file:// a localhost o a la nube NO migra datos.

El primer acceso crea un administrador LOCAL. No hay usuario o clave de fabrica.
No confundir este alta local con el registro autorizado de la futura aplicacion
compartida. server.cjs solo sirve archivos publicos permitidos: no tiene endpoints
de negocio, autenticacion de servidor, persistencia remota ni Google Sheets.

## Trabajo solicitado

Leer MIGRACION-AI-STUDIO.md y REQUISITOS-Y-ACEPTACION.md. El mensaje completo
tambien esta en MENSAJE-PARA-AI-STUDIO.txt. Primero conservar y probar; despues
implementar los requisitos de nube. No reiniciar el proyecto con una maqueta.

## Mapa del codigo

- domain.js: validaciones y motor de existencias, contabilidad, indicadores y escenarios.
- assets/account-plan.js: catalogo de anexos, complementos y equivalencias historicas.
- journal.js / journal-ui.js: asientos y Excel; audit.js / audit-ui.js: historial.
- storage.js: IndexedDB transaccional local; reemplazar por adaptador remoto protegido.
- auth.js / access-ui.js: acceso local; no es autenticacion de servidor.
- transfer.js / transfer-ui.js: formato .unrc y controles de importacion.
- interface.js: formularios, modulos, consultas y manual; printing.js: reportes.
- index.html, archivos CSS y assets: interfaz, logos y fondo originales.
- desktop/: fuentes Electron de referencia; no se ejecutan con este package.json.
- package.desktop-original.json y pnpm-lock.desktop-original.yaml: configuracion
  original, solo referencia para mantener una futura distribucion de escritorio.
- tests/: 67 pruebas originales de dominio/traslado/politica mas prueba del preview.
- docs/plan-de-cuentas.json: exportacion del catalogo, NO una base operativa.
- docs/historico/: documentos originales con fechas y alcances anteriores.

No se incluye app.js: es el motor obsoleto que index.html ya no carga. Tampoco se
incluyen instaladores, node_modules, perfiles, copias reales o la carpeta .git.

## Importacion

Importar esta carpeta como raiz de un repositorio privado y usar Build > + >
Import from GitHub. El ZIP permite transportar los archivos, no garantiza que
cualquier interfaz de AI Studio lo admita como proyecto. No se subio nada a Google
o GitHub al preparar esta entrega. Las guias originales van fuera del repositorio,
en referencias; pueden adjuntarse al chat tras revisar su contenido.

## Estado y fuentes

La guia PDF/presentacion exige backend, Sheets, roles por unidad, trazabilidad,
respaldo remoto y publicacion. El manual bovino inspira las vistas, no cambia
la actividad del sistema. Los ejemplos de animales, tasas o carencias del manual
no son datos ni reglas validas para aplicar automaticamente a porcinos.

Documentacion vigente consultada: [AI Studio Build](https://ai.google.dev/gemini-api/docs/aistudio-build-mode),
[publicacion](https://ai.google.dev/gemini-api/docs/aistudio-deploying),
[Sheets batch](https://developers.google.com/workspace/sheets/api/guides/batch),
[Apps Script LockService](https://developers.google.com/apps-script/reference/lock/lock-service).
