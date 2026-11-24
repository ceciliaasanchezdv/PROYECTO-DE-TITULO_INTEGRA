'use strict';

require('dotenv').config(process.env.INTEGRA_ENV_FILE
  ? { path: process.env.INTEGRA_ENV_FILE } : undefined);

const { openPool, withConnection, closePool } = require('../src/db');

async function main() {
  await openPool();
  try {
    const info = await withConnection(async (conn) => {
      const result = await conn.execute(
        "SELECT USER AS ESQUEMA, SYS_CONTEXT('USERENV', 'DB_NAME') AS BASE FROM DUAL"
      );
      const tables = await conn.execute(
        "SELECT COUNT(*) AS TOTAL FROM USER_TABLES WHERE TABLE_NAME IN (" +
        "'CATEGORIA','CLIENTE','COMPONENTE_UTILIZADO','DETALLE_VENTA'," +
        "'DEVOLUCION','LOTE','MARCA','MODELO','PROVEEDOR'," +
        "'SERVICIO_TECNICO','SINTOMA','TIPO_INTERVENCION'," +
        "'UNIDAD','USUARIO','VENTA')"
      );
      return { ...result.rows[0], TABLAS: tables.rows[0].TOTAL };
    });
    console.log('Conexión correcta:', info);
  } finally {
    await closePool();
  }
}

main().catch((error) => {
  console.error('No se pudo comprobar la base:', error.message);
  process.exitCode = 1;
});
