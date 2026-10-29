# Requisitos y aceptacion

Estado de la COPIA ENTREGADA el 29/09/2026. "Pendiente" significa trabajo que
debe realizar AI Studio, no funcionalidad completada con este paquete.
Referencias PDF usan numero de pagina fisica, no el pie que empieza una pagina despues.

## Diez condiciones de la guia

| ID | Fuente | Requisito | Estado actual | Evidencia para aceptar la migracion |
| --- | --- | --- | --- | --- |
| G01 | Guia PDF 6 / diap. 7 | Identificacion individual | Local | Sesion validada por servidor; no basta enviar un userId |
| G02 | PDF 6 / diap. 8-9 | Roles y permisos por unidad | Admin/operador locales | Cuatro roles, alcance por unidad; API rechaza solicitudes prohibidas |
| G03 | PDF 6, 10 / diap. 4, 7 | Validacion de reglas | Motor local implementado | Mismas reglas ejecutadas en servidor y pruebas de entradas manipuladas |
| G04 | PDF 6, 9 / diap. 5, 7 | Trazabilidad | Historial local | Auditoria remota con autor real, fecha, antes/despues y versiones |
| G05 | PDF 6, 8-9 / diap. 5 | Integridad | IDs y referencias locales | Hojas normalizadas, FKs, unicidad, sin cuentas huerfanas ni stock negativo |
| G06 | PDF 6 / diap. 7 | Multiusuario | Mismo perfil local | Dos navegadores/equipos concurrentes; sin perdida de escritura ni doble operacion |
| G07 | PDF 6 / diap. 7 | Usabilidad | Web adaptable | Carga, consulta y errores claros en 390, 768, 1024 y 1440 px; importes grandes completos |
| G08 | PDF 6 / diap. 7 | Reportes | Tablas, indicadores, Excel, PDF | Reportes autorizados concilian con origen; nuevos graficos usan datos reales |
| G09 | PDF 6, 14 / diap. 19 | Respaldo | Traslado local .unrc | Repositorio remoto y copia remota de datos; restauracion verificada |
| G10 | PDF 6, 14 / diap. 7 | Mantenibilidad | Modulos y pruebas existentes | Capas separadas, configuracion externa, manual, diccionario y pruebas ejecutables |

## Arquitectura y mejoras

| ID | Fuente | Requisito | Estado actual / verificacion esperada |
| --- | --- | --- | --- |
| A01 | Guia PDF 3, 9-10 | Backend y Google Sheets centrales | Pendiente; escrituras autenticadas, no un JSON global ni planillas publicas |
| A02 | PDF 10, 14 / diap. 19 | Codigo remoto y URL estable | Pendiente de cuenta/autorizacion; no depender de PC encendida |
| A03 | PDF 9-10 | Permisos del backend | Pendiente; exportaciones y filtros tambien restringidos, no solo botones |
| A04 | PDF 14 | Costos/cuotas documentados | No hay facturacion activada ni promesa de servicio ilimitado |
| U01 | Pedido del propietario | Sin validacion/aprobacion manual | Conservar guardado directo; mantener controles automaticos |
| U02 | Pedido y version 1.4 | Plan Anexos I y II | Conservar 48 filas de anexos + 19 complementos; prohibir dinero en fisicas/grupos |
| U03 | Pedido del propietario | Contabilidad y rentabilidad agricultura/cerdos | Conciliar resultados, margenes internos, saldos y costo de oportunidad |
| U04 | Pedido del propietario | Diario dinamico y Excel | Varias lineas, desplegables, diferencia, centavos, totales y XLSX real |
| U05 | Pedido del propietario | Correo no requerido | No implementar codigos por mail ni exigirlo para conservar acceso por usuario |
| U06 | Pedido del propietario | Identidad, fondo rural y creditos | Logos originales transparentes, paleta UNRC, menu sin numeros, manual al final |
| U07 | Codigo actual | Compatibilidad e historia | Importacion aislada .unrc; operaciones/autores/cierres intactos; sin sobreescritura de destino |
| B01 | Manual bovino 6-7 | Ficha historica | Ampliar por lote porcino; no exigir caravana bovina a cada cerdo |
| B02 | Manual 9-11 | Graficos y analitica | Pendiente; resultados por unidad y mes, costos/fase, ICA y existencias |
| B03 | Manual 11-12 | Alertas | Pendiente; umbrales configurables con fuente y enlaces a registros |
| B04 | Manual 7-8 | Sanidad y carencias | Tratamientos basicos existentes; falta carencia, alcance trazable y bloqueo de faena |
| B05 | Manual 14 | Vista movil | Ampliar tablas a fichas tactiles; navegacion y formularios completos |
| B06 | Manual 12-13 | Estado de sincronizacion | Pendiente; confirmacion real del servidor, error/reintento; sin falsa nube |
| B07 | Manual 9 | ARS/USD | Opcional, segunda prioridad; cambio historico verificable sin reescribir diario |

## Casos de aceptacion obligatorios

1. Consumo 300 kg con ganancia valida 100 kg produce ICA 3; movimientos parciales
   no alteran la formula ni permiten promedios incorrectos por fase.
2. Venta parcial resta cabezas y costo proporcional; anular restaura ambos.
   Cobro parcial solo cancela saldo; no crea otro ingreso.
3. Agricultura transfiere cereal a Cerdos: conserva costo y concilia margen interno;
   no duplica existencias o beneficio consolidado.
4. Asiento desbalanceado o cuenta fisica es rechazado por el servidor. Dos
   decimales y centavos de reparto se conservan en libro y Excel.
5. Cierre bloquea carga/correccion retroactiva tambien llamando directamente la API.
6. Conservar antiguos IDs que coinciden visualmente con codigos del plan nuevo,
   sin cambiar su significado ni borrar el catalogo anterior.
7. Operador intenta cambiar permisos por API: denegado. Responsable de Cerdos
   intenta exportar Agricultura: denegado. Auditor exporta su alcance sin editar.
8. Dos operadores parten de la misma revision y venden las mismas cabezas:
   solo confirmar operaciones que mantengan stock; conflicto comprensible sin perdida.
9. Repetir una solicitud por perdida de conexion produce una sola operacion y un
   solo efecto contable. Falla a mitad de guardado no deja movimiento sin auditoria.
10. Una sesion revocada no lee ni guarda; un usuario inactivo no entra. Credenciales
    no aparecen en HTML, bundles, logs, respuestas de usuarios ni exportaciones.
11. Confirmacion de Sheets y UI coinciden; error de red no cambia a "sincronizado".
    Modo demo, si existe, no comparte hojas ni perfiles con produccion.
12. Tratamiento con alcance parcial y traslado conserva animales restringidos.
    No se vende a faena antes de liberacion; el costo se vincula una sola vez.
13. Restaurar una copia en entorno aislado recupera registros, autoria, relaciones
    y resultados; no confundir una sincronizacion que replica un borrado con respaldo.
14. Importar .unrc sintetico conserva saldos, cabezas, costos, cierres y autores
    originales; registrar al importador aparte. No contiene contrasenas.
15. En 390 px no hay desbordamiento general; en desktop los importes de millones
    entran sin taparse. PDF sin fondos ni botones; Excel con valores numericos.
16. Version desplegada responde con PC local apagada. Acceso anonimo no muestra
    datos del establecimiento. Registrar evidencia de pruebas y limites conocidos.

## Conflictos resueltos

- La guia permite exportar a Consulta/auditoria: aplicar esa regla, no la matriz
  distinta del manual bovino.
- La guia acepta usuario u otra identidad: no fuerza email ni contradice la
  decision de no agregar recuperacion por correo.
- Validacion de la guia significa controles de datos/permisos, no aprobacion humana.
- La aplicacion es porcina/agricola: genealogia individual, equivalentes vaca,
  tabla de cargas bovinas y plazos sanitarios de ejemplo no son requisitos a copiar.
- GitHub respalda codigo; Sheets es almacenamiento; copia historica recuperable
  es respaldo. No tratarlos como tres nombres de la misma cosa.
- Los originales en docs/historico tienen referencias a estados pendientes y
  versiones antiguas: el comportamiento vigente de guardado directo prevalece.
