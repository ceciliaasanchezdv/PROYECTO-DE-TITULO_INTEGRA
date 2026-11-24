'use strict';

require('dotenv').config(process.env.INTEGRA_ENV_FILE
  ? { path: process.env.INTEGRA_ENV_FILE } : undefined);

const crypto = require('node:crypto');
const { oracledb, openPool, withConnection, withTransaction, closePool } = require('../src/db');

const baseUrl = 'http://localhost:' + (process.env.PORT || 3000);
const suffix = crypto.randomBytes(5).toString('hex').toUpperCase();
const unitCode = 'TXTEST_U_' + suffix;
const saleCode = 'TXTEST_V_' + suffix;
let unitId;
let poolOpened = false;

async function checkEnvironment() {
  if (!process.env.INTEGRA_ENV_FILE ||
      !process.env.INTEGRA_ENV_FILE.toLowerCase().endsWith('.env.cloud')) {
    throw new Error('Selecciona .env.cloud mediante INTEGRA_ENV_FILE');
  }
  const direct = await withConnection(async (conn) => {
    const result = await conn.execute(
      "SELECT USER AS ESQUEMA, SYS_CONTEXT('USERENV', 'CON_NAME') AS BASE FROM DUAL"
    );
    return result.rows[0];
  });
  const healthResponse = await fetch(baseUrl + '/api/health');
  const health = await healthResponse.json();
  if (!healthResponse.ok || direct.ESQUEMA !== 'INTEGRA' ||
      health.database?.ESQUEMA !== direct.ESQUEMA ||
      health.database?.BASE !== direct.BASE || direct.BASE === 'FREEPDB1') {
    throw new Error('La aplicación y el script deben usar la misma base Oracle Cloud');
  }
}

async function prepareUnit() {
  return withTransaction(async (conn) => {
    const ids = await conn.execute(
      'SELECT (SELECT id_lote FROM LOTE WHERE codigo_lote = :lote) AS LOTE, ' +
      '(SELECT id_cliente FROM CLIENTE WHERE codigo_cliente = :cliente) AS CLIENTE, ' +
      '(SELECT id_unidad FROM UNIDAD WHERE codigo_interno = :vendida) AS VENDIDA ' +
      'FROM DUAL',
      { lote: 'DEMO26_LOTE_A', cliente: 'DEMO26_CLI', vendida: 'DEMO26_U10' }
    );
    const { LOTE, CLIENTE, VENDIDA } = ids.rows[0];
    if (!LOTE || !CLIENTE || !VENDIDA) throw new Error('Faltan registros DEMO26');
    const sold = await conn.execute(
      'SELECT estado_actual FROM UNIDAD WHERE id_unidad = :id', { id: VENDIDA }
    );
    if (sold.rows[0].ESTADO_ACTUAL !== 'VENDIDA') {
      throw new Error('DEMO26_U10 ya no está en estado VENDIDA');
    }
    const created = await conn.execute(
      "INSERT INTO UNIDAD (codigo_interno, fecha_ingreso, estado_actual, LOTE_id_lote) " +
      "VALUES (:codigo, TRUNC(SYSDATE), 'DISPONIBLE', :lote) " +
      'RETURNING id_unidad INTO :newId',
      { codigo: unitCode, lote: LOTE,
        newId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER } }
    );
    unitId = created.outBinds.newId[0];
    return { clientId: CLIENTE, soldId: VENDIDA };
  });
}

async function login() {
  const correo = process.env.SEED_OPERADOR_EMAIL;
  const clave = process.env.SEED_OPERADOR_PASSWORD;
  if (!correo || !clave) throw new Error('Faltan credenciales de prueba en .env.cloud');
  const response = await fetch(baseUrl + '/api/login', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ correo, clave })
  });
  if (!response.ok) throw new Error('No se pudo iniciar sesión con la cuenta de prueba');
  const cookie = response.headers.get('set-cookie')?.split(';')[0];
  if (!cookie) throw new Error('No se recibió la sesión de prueba');
  return cookie;
}

async function inspect() {
  return withConnection(async (conn) => {
    const result = await conn.execute(
      'SELECT (SELECT COUNT(*) FROM VENTA WHERE codigo_venta = :codigo) AS VENTAS, ' +
      '(SELECT COUNT(*) FROM DETALLE_VENTA d JOIN VENTA v ' +
      'ON v.id_venta = d.VENTA_id_venta WHERE v.codigo_venta = :codigo) AS DETALLES, ' +
      '(SELECT estado_actual FROM UNIDAD WHERE id_unidad = :unidad) AS ESTADO FROM DUAL',
      { codigo: saleCode, unidad: unitId }
    );
    return result.rows[0];
  });
}

async function cleanup() {
  if (!unitId) return;
  await withTransaction(async (conn) => {
    const sale = await conn.execute(
      'SELECT id_venta FROM VENTA WHERE codigo_venta = :codigo', { codigo: saleCode }
    );
    if (sale.rows.length) {
      const id = sale.rows[0].ID_VENTA;
      await conn.execute('DELETE FROM DETALLE_VENTA WHERE VENTA_id_venta = :id', { id });
      await conn.execute('DELETE FROM VENTA WHERE id_venta = :id', { id });
    }
    const removed = await conn.execute(
      'DELETE FROM UNIDAD WHERE id_unidad = :id', { id: unitId }
    );
    if (removed.rowsAffected !== 1) {
      throw new Error('No se pudo eliminar la unidad temporal');
    }
  });
}

async function main() {
  try {
    await openPool();
    poolOpened = true;
    await checkEnvironment();
    const { clientId, soldId } = await prepareUnit();
    const cookie = await login();
    const response = await fetch(baseUrl + '/api/sales', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({
        codigo_venta: saleCode,
        fecha_venta: new Date().toISOString().slice(0, 10),
        CLIENTE_id_cliente: clientId,
        unidades: [
          { id_unidad: unitId, precio_venta: 1000 },
          { id_unidad: soldId, precio_venta: 1000 }
        ]
      })
    });
    const result = await response.json();
    const state = await inspect();
    if (response.status !== 409 ||
        result.error !== 'La unidad ' + soldId + ' no esta disponible' ||
        state.VENTAS !== 0 ||
        state.DETALLES !== 0 || state.ESTADO !== 'DISPONIBLE') {
      throw new Error('Falló la comprobación de rollback: respuesta ' +
        response.status + ', venta ' + state.VENTAS + ', detalles ' +
        state.DETALLES + ', estado ' + state.ESTADO);
    }
    console.log('Prueba aprobada: segunda unidad rechazada (' + result.error + ').');
    console.log('Rollback confirmado: 0 ventas, 0 detalles; primera unidad DISPONIBLE.');
  } finally {
    if (poolOpened) {
      try {
        await cleanup();
        if (unitId) console.log('Unidad temporal eliminada.');
      } finally {
        await closePool();
      }
    }
  }
}

main().catch((error) => {
  console.error('Prueba no aprobada:', error.message);
  process.exitCode = 1;
});
