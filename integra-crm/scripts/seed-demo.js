'use strict';

require('dotenv').config(process.env.INTEGRA_ENV_FILE
  ? { path: process.env.INTEGRA_ENV_FILE } : undefined);

const { oracledb, openPool, withTransaction, closePool } = require('../src/db');

function dayOffset(days) {
  const now = new Date();
  const date = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() + days));
  return date.toISOString().slice(0, 10);
}

async function add(conn, sql, values) {
  const result = await conn.execute(sql, {
    ...values, newId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }
  });
  return result.outBinds.newId[0];
}

async function main() {
  await openPool();
  try {
    const status = await withTransaction(async (conn) => {
      const exists = await conn.execute(
        "SELECT COUNT(*) AS TOTAL FROM CATEGORIA WHERE codigo_categoria = 'DEMO26_CAT'"
      );
      if (exists.rows[0].TOTAL) return 'Los datos DEMO26 ya estaban cargados';

      const user = await conn.execute(
        'SELECT id_usuario FROM USUARIO WHERE LOWER(correo) = :correo AND activo = 1',
        { correo: String(process.env.SEED_OPERADOR_EMAIL || '').toLowerCase() }
      );
      if (!user.rows.length) throw new Error('Primero ejecuta npm run seed:users');
      const operator = user.rows[0].ID_USUARIO;

      const category = await add(conn,
        'INSERT INTO CATEGORIA (codigo_categoria, nombre) VALUES (:codigo, :nombre) RETURNING id_categoria INTO :newId',
        { codigo: 'DEMO26_CAT', nombre: 'Electrodomésticos de demostración' });
      const brand = await add(conn,
        'INSERT INTO MARCA (codigo_marca, nombre) VALUES (:codigo, :nombre) RETURNING id_marca INTO :newId',
        { codigo: 'DEMO26_MAR', nombre: 'Marca de demostración' });
      const model = await add(conn,
        'INSERT INTO MODELO (codigo_modelo, nombre, MARCA_id_marca, CATEGORIA_id_categoria) ' +
        'VALUES (:codigo, :nombre, :marca, :categoria) RETURNING id_modelo INTO :newId',
        { codigo: 'DEMO26_MOD', nombre: 'Lavadora modelo de prueba', marca: brand, categoria: category });
      const supplier = await add(conn,
        'INSERT INTO PROVEEDOR (codigo_proveedor, nombre) VALUES (:codigo, :nombre) RETURNING id_proveedor INTO :newId',
        { codigo: 'DEMO26_PRO', nombre: 'Proveedor de demostración' });
      const lots = [];
      for (const suffix of ['A', 'B']) {
        lots.push(await add(conn,
          'INSERT INTO LOTE (codigo_lote, fecha_recepcion, PROVEEDOR_id_proveedor, MODELO_id_modelo) ' +
          "VALUES (:codigo, TO_DATE(:fecha, 'YYYY-MM-DD'), :proveedor, :modelo) RETURNING id_lote INTO :newId",
          { codigo: 'DEMO26_LOTE_' + suffix, fecha: dayOffset(-250), proveedor: supplier, modelo: model }));
      }
      const symptom = await add(conn,
        'INSERT INTO SINTOMA (codigo_sintoma, nombre, descripcion) ' +
        'VALUES (:codigo, :nombre, :descripcion) RETURNING id_sintoma INTO :newId',
        { codigo: 'DEMO26_SIN', nombre: 'Falla de centrifugado',
          descripcion: 'Síntoma sintético para probar reincidencias' });
      const types = [];
      for (const [code, name] of [['REP', 'Reparación de control'], ['CAM', 'Cambio de módulo']]) {
        types.push(await add(conn,
          'INSERT INTO TIPO_INTERVENCION (codigo_tipo, nombre, descripcion) ' +
          'VALUES (:codigo, :nombre, :descripcion) RETURNING id_tipo_intervencion INTO :newId',
          { codigo: 'DEMO26_' + code, nombre: name, descripcion: 'Tipo de intervención sintético' }));
      }
      const client = await add(conn,
        'INSERT INTO CLIENTE (codigo_cliente, nombre) VALUES (:codigo, :nombre) RETURNING id_cliente INTO :newId',
        { codigo: 'DEMO26_CLI', nombre: 'Cliente de demostración' });

      const unitIds = [];
      for (let i = 0; i < 20; i++) {
        unitIds.push(await add(conn,
          'INSERT INTO UNIDAD (codigo_interno, numero_serie, fecha_ingreso, estado_actual, LOTE_id_lote) ' +
          "VALUES (:codigo, :serie, TO_DATE(:fecha, 'YYYY-MM-DD'), 'DISPONIBLE', :lote) " +
          'RETURNING id_unidad INTO :newId',
          { codigo: 'DEMO26_U' + String(i + 1).padStart(2, '0'),
            serie: 'DEMO26_SERIE_' + String(i + 1).padStart(2, '0'),
            fecha: dayOffset(-240), lote: lots[i % 10 < 5 ? 0 : 1] }));
      }

      const olderSale = await add(conn,
        'INSERT INTO VENTA (codigo_venta, fecha_venta, CLIENTE_id_cliente, USUARIO_id_usuario) ' +
        "VALUES (:codigo, TO_DATE(:fecha, 'YYYY-MM-DD'), :cliente, :usuario) RETURNING id_venta INTO :newId",
        { codigo: 'DEMO26_V_ANT', fecha: dayOffset(-200), cliente: client, usuario: operator });
      const recentSale = await add(conn,
        'INSERT INTO VENTA (codigo_venta, fecha_venta, CLIENTE_id_cliente, USUARIO_id_usuario) ' +
        "VALUES (:codigo, TO_DATE(:fecha, 'YYYY-MM-DD'), :cliente, :usuario) RETURNING id_venta INTO :newId",
        { codigo: 'DEMO26_V_REC', fecha: dayOffset(-60), cliente: client, usuario: operator });
      const saleDetails = [];
      for (let i = 0; i < 20; i++) {
        saleDetails.push(await add(conn,
          'INSERT INTO DETALLE_VENTA (precio_venta, VENTA_id_venta, UNIDAD_id_unidad) ' +
          'VALUES (:precio, :venta, :unidad) RETURNING id_detalle_venta INTO :newId',
          { precio: 399990, venta: i < 10 ? recentSale : olderSale, unidad: unitIds[i] }));
        await conn.execute("UPDATE UNIDAD SET estado_actual = 'VENDIDA' WHERE id_unidad = :id", { id: unitIds[i] });
      }
      for (let i = 0; i < 3; i++) {
        await add(conn,
          'INSERT INTO DEVOLUCION (codigo_devolucion, fecha_devolucion, motivo, ' +
          'DETALLE_VENTA_id_detalle_venta, USUARIO_id_usuario) ' +
          "VALUES (:codigo, TO_DATE(:fecha, 'YYYY-MM-DD'), :motivo, :detalle, :usuario) " +
          'RETURNING id_devolucion INTO :newId',
          { codigo: 'DEMO26_D' + (i + 1), fecha: dayOffset(-50),
            motivo: 'Falla de funcionamiento', detalle: saleDetails[i], usuario: operator });
        await conn.execute("UPDATE UNIDAD SET estado_actual = 'REVISION' WHERE id_unidad = :id", { id: unitIds[i] });
      }
      for (let i = 10; i < 20; i++) {
        const serviceId = await add(conn,
          'INSERT INTO SERVICIO_TECNICO (codigo_servicio, fecha_ingreso, diagnostico, fecha_cierre, ' +
          'resultado, UNIDAD_id_unidad, SINTOMA_id_sintoma, TIPO_INTERVENCION_id_tipo, USUARIO_id_usuario) ' +
          "VALUES (:codigo, TO_DATE(:ingreso, 'YYYY-MM-DD'), :diagnostico, TO_DATE(:cierre, 'YYYY-MM-DD'), " +
          ':resultado, :unidad, :sintoma, :tipo, :usuario) RETURNING id_servicio INTO :newId',
          { codigo: 'DEMO26_ST' + String(i - 9).padStart(2, '0'),
            ingreso: dayOffset(-160), cierre: dayOffset(-155),
            diagnostico: 'Revisión sintética del centrifugado', resultado: 'Equipo entregado',
            unidad: unitIds[i], sintoma: symptom, tipo: types[i < 15 ? 0 : 1], usuario: operator });
        if (i === 10) {
          await add(conn,
            'INSERT INTO COMPONENTE_UTILIZADO (nombre, cantidad, observacion, SERVICIO_TECNICO_id_servicio) ' +
            'VALUES (:nombre, :cantidad, :observacion, :servicio) RETURNING id_componente_utilizado INTO :newId',
            { nombre: 'Módulo de control de prueba', cantidad: 1,
              observacion: 'Dato sintético', servicio: serviceId });
        }
        await conn.execute("UPDATE UNIDAD SET estado_actual = 'ENTREGADA' WHERE id_unidad = :id", { id: unitIds[i] });
      }
      for (let i = 10; i < 13; i++) {
        await add(conn,
          'INSERT INTO SERVICIO_TECNICO (codigo_servicio, fecha_ingreso, diagnostico, ' +
          'UNIDAD_id_unidad, SINTOMA_id_sintoma, USUARIO_id_usuario) ' +
          "VALUES (:codigo, TO_DATE(:fecha, 'YYYY-MM-DD'), :diagnostico, :unidad, :sintoma, :usuario) " +
          'RETURNING id_servicio INTO :newId',
          { codigo: 'DEMO26_RE' + (i - 9), fecha: dayOffset(-130),
            diagnostico: 'Reingreso sintético por el mismo síntoma',
            unidad: unitIds[i], sintoma: symptom, usuario: operator });
        await conn.execute("UPDATE UNIDAD SET estado_actual = 'EN_SERVICIO' WHERE id_unidad = :id", { id: unitIds[i] });
      }
      return 'Cargados 20 unidades, 2 ventas, 3 devoluciones y 13 servicios sintéticos';
    });
    console.log(status);
  } finally { await closePool(); }
}

main().catch((error) => {
  console.error('No se pudieron cargar los datos sintéticos:', error.message);
  process.exitCode = 1;
});
