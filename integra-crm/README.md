# Integra CRM
Aplicación de TecnoHogar para registrar lotes, unidades, ventas, devoluciones y servicios técnicos, y consultar el historial de cada unidad. Incluye perfiles **Operador** y **Supervisor**. La interfaz usa Vue 3; el servidor usa Node.js, Express y Oracle Database.

## Estado del proyecto
La aplicación está [publicada en Render](https://proyecto-de-titulo-integra.onrender.com/) y se conecta mediante TLS al esquema `INTEGRA` de Oracle Autonomous Database. El esquema tiene quince tablas y diecisiete claves foráneas. La aplicación mostró el resumen, el historial y los dos análisis con datos sintéticos `DEMO26`. Las pruebas con datos ficticios no representan conclusiones sobre operaciones reales.

## Requisitos
- Node.js 22 o posterior.
- Oracle Autonomous Database con el esquema `INTEGRA` y permisos para crear tablas, secuencias y disparadores, además de espacio asignado para sus objetos.

## Perfiles
- Supervisor:
EMAIL=supervisor@integra.test
PASSWORD=SuperIntegr@
- Operador:
EMAIL=operador@integra.test
PASSWORD=OperaIntegr@

## Base de datos
En Oracle Cloud Database Actions, conectarse como `INTEGRA` y ejecutar en este orden sobre un esquema nuevo:

1. `database/01_esquema.sql` para crear las 15 tablas y sus restricciones, solamente en un esquema vacío.
2. `database/02_generacion_ids.sql` para crear las 15 secuencias y los valores automáticos de las claves primarias. El usuario necesita el privilegio `CREATE SEQUENCE`.
3. `database/03_servicio_unidad.sql` para asociar el servicio técnico directamente a una unidad y permitir que la devolución sea opcional. Esta migración se aplica una vez sobre el esquema de EVA 2.
4. `database/04_indices_consulta.sql` para agregar índices a las relaciones y fechas consultadas con frecuencia. En Oracle Cloud se verificaron ocho índices `IX_`.
5. `database/05_integridad_datos.sql` para validar los datos y agregar restricciones, unicidad del número de serie y disparadores que protegen vínculos históricos.

Los nombres descriptivos pueden corregirse. El script 05 no borra ni corrige automáticamente registros existentes: se detiene si encuentra datos incompatibles.

La base migrada tiene 15 tablas, 15 claves primarias y 17 claves foráneas. No ejecutar nuevamente el script de creación inicial sobre tablas existentes.

## Ejecución de la aplicación con Oracle Cloud
Oracle Cloud ya contiene dos cuentas de demostración y el conjunto sintético `DEMO26`: 20 unidades, 2 ventas, 3 devoluciones y 13 servicios.

El Supervisor gestiona catálogos y cuentas; ambos perfiles pueden registrar operaciones y consultar historiales. Los informes comparan primeras devoluciones entre lotes del mismo modelo y reingresos por síntoma entre tipos de intervención. Los criterios y tamaños mínimos aparecen en la pantalla de análisis.

La búsqueda global consulta Oracle directamente por código o serie de unidad, cliente y código de venta. Si hay más de 200 registros entre esas entidades, la interfaz avisa que la búsqueda podría demorar más de lo habitual. Los listados de catálogos, clientes, unidades, ventas, devoluciones y servicios muestran 50 registros por página y ofrecen «Cargar más»; sus buscadores consultan Oracle para encontrar registros de páginas anteriores. Los formularios permiten buscar por código o nombre cuando una opción no aparece en la primera página.

## Estructura
- `public/`: interfaz web.
- `src/routes/`: rutas de operaciones y consultas.
- `src/analysis.js`: cálculo de indicadores y hallazgos.
- `scripts/seed-users.js`: preparación de cuentas de demostración.
- `database/`: esquema y migraciones.

