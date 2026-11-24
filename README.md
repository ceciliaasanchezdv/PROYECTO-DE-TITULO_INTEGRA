# Integra — TecnoHogar

Integra es un proyecto académico para registrar ventas, devoluciones y servicios técnicos de TecnoHogar, una empresa ficticia. Permite consultar el recorrido de cada unidad desde su lote de origen y analizar primeras devoluciones y reingresos por el mismo síntoma.

## Estado del proyecto

La aplicación web está implementada con Vue 3, Node.js y Express y [publicada en Render](https://proyecto-de-titulo-integra.onrender.com/). El servidor se conecta mediante TLS al esquema `INTEGRA` de Oracle Autonomous Database. La base implementada tiene 15 tablas y 17 claves foráneas. Las pruebas con datos ficticios `DEMO26` comprobaron los dos informes, permisos por perfil, reglas de integridad y el ROLLBACK de una venta fallida.

## Carpetas

- [`integra-crm/`](integra-crm/README.md): código de la aplicación, cinco scripts SQL para crear y migrar el esquema e instrucciones de ejecución.
- [`Integra - BD/`](Integra%20-%20BD/): diseño y SQL originales de EVA 2. El diagrama de esa carpeta corresponde a la versión inicial de 16 claves foráneas; la relación adicional entre servicio técnico y unidad está documentada y aplicada en `integra-crm/database/03_servicio_unidad.sql`.

Para instalar y ejecutar la versión actual, consulta el [README de la aplicación](integra-crm/README.md).

Las cuentas y los registros `DEMO26` son datos de demostración.

## Autoría
Proyecto individual de Cecilia Sánchez de Vicente. TecnoHogar es una empresa ficticia utilizada para desarrollar el caso académico.
