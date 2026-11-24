'use strict';

const oracledb = require('oracledb');

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

let pool;

async function openPool() {
  for (const key of ['DB_USER', 'DB_PASSWORD', 'DB_CONNECT_STRING']) {
    if (!process.env[key]) {
      throw new Error('Falta la variable ' + key);
    }
  }
  pool = await oracledb.createPool({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    connectString: process.env.DB_CONNECT_STRING,
    poolMin: 0,
    poolMax: 5,
    poolIncrement: 1
  });
}

async function connection() {
  if (!pool) throw new Error('La conexion de Oracle no esta inicializada');
  return pool.getConnection();
}

async function withConnection(work) {
  const conn = await connection();
  try {
    return await work(conn);
  } finally {
    await conn.close();
  }
}

async function withTransaction(work) {
  const conn = await connection();
  try {
    const result = await work(conn);
    await conn.commit();
    return result;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    await conn.close();
  }
}

async function closePool() {
  if (pool) await pool.close(10);
  pool = undefined;
}

module.exports = { oracledb, openPool, withConnection, withTransaction, closePool };
