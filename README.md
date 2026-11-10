# Integra — TecnoHogar

Integra es un proyecto académico de plataforma web para gestionar las ventas, devoluciones y atenciones técnicas de TecnoHogar, una empresa ficticia. Su objetivo es permitir el seguimiento de cada unidad desde su lote de origen hasta las operaciones posteriores a su venta.

## Estado del proyecto

La base de datos relacional está modelada e implementada en una instancia local de Oracle AI Database Free Lite. La verificación del esquema confirmó 15 tablas, 15 claves primarias, 16 claves foráneas y 13 restricciones de unicidad.

La interfaz web con Vue.js 3, la API con Node.js y Express, las pruebas de las operaciones y el despliegue web están previstos para etapas posteriores. Este repositorio documenta el avance actual; todavía no contiene una aplicación web funcional.

## Contenido del repositorio

- base-datos/Integra_Eva2.sql: instrucciones SQL para crear las tablas y restricciones.
- base-datos/Integra_Local.sql: consultas para verificar la cantidad de tablas y restricciones creadas.
- modelo/Integra Diagrama.dmd: diseño editable de Oracle SQL Developer Data Modeler. Ambos elementos deben permanecer juntos.
- modelo/Relational_Diagrama.png: imagen del modelo relacional.

## Cómo revisar la base de datos

1. Conectarse en Oracle SQL Developer a un esquema Oracle vacío con permisos para crear tablas.
2. Abrir base-datos/Integra_Eva2.sql y ejecutarlo como script.
3. Ejecutar base-datos/Integra_Local.sql en la misma conexión para comprobar las tablas y restricciones creadas.

Para abrir el modelo editable, usar Archivo → Abrir → Diseño en Oracle SQL Developer Data Modeler y seleccionar modelo/Integra Diagrama.dmd.

## Arquitectura prevista

El operador y el supervisor accederán desde un navegador. La interfaz con Vue.js 3 enviará solicitudes a una API con Node.js y Express, encargada de los permisos, las validaciones y las reglas de negocio. La API accederá a Oracle Database. Para el despliegue web se contempla Oracle Autonomous Database.

## Autoría

Proyecto individual de Cecilia Sánchez de Vicente. TecnoHogar es una empresa ficticia utilizada para desarrollar el caso académico.
