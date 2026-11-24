'use strict';

const express = require('express');
const { oracledb, withConnection, withTransaction } = require('../db');
const { requireAuth } = require('../auth');
const { requiredText, optionalText, positiveId, isoDate } = require('../http');
const { pageRequest, pageResponse } = require('../pagination');

const router = express.Router();
router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    const filters = [];
    const binds = {};
    const { offset, fetch } = pageRequest(req);
    const q = String(req.query.q || '').trim().slice(0, 80).toLowerCase();
    if (q) {
      filters.push('(INSTR(LOWER(u.codigo_interno), :q) > 0 OR INSTR(LOWER(u.numero_serie), :q) > 0)');
      binds.q = q;
    }
    if (req.query.estado) {
      binds.estado = requiredText(req.query.estado, 'Estado', 20);
      filters.push('u.estado_actual = :estado');
    }
    if (req.query.lote) {
      binds.lote = positiveId(req.query.lote, 'Lote');
      filters.push('u.LOTE_id_lote = :lote');
    }
    if (req.query.modelo) {
      binds.modelo = positiveId(req.query.modelo, 'Modelo');
      filters.push('l.MODELO_id_modelo = :modelo');
    }
    if (req.query.eligible === 'service') {
      filters.push("u.estado_actual IN ('VENDIDA', 'REVISION', 'ENTREGADA')");
    } else if (req.query.eligible === 'sale') {
      filters.push("u.estado_actual = 'DISPONIBLE'");
    }
    const rows = await withConnection(async (conn) => {
      const sql = 'SELECT u.id_unidad, u.codigo_interno, u.numero_serie, u.fecha_ingreso, ' +
        'u.estado_actual, u.LOTE_id_lote, l.codigo_lote, l.MODELO_id_modelo, ' +
        'm.nombre AS modelo, l.PROVEEDOR_id_proveedor, p.nombre AS proveedor ' +
        'FROM UNIDAD u JOIN LOTE l ON l.id_lote = u.LOTE_id_lote ' +
        'JOIN MODELO m ON m.id_modelo = l.MODELO_id_modelo ' +
        'JOIN PROVEEDOR p ON p.id_proveedor = l.PROVEEDOR_id_proveedor ' +
        (filters.length ? 'WHERE ' + filters.join(' AND ') + ' ' : '') +
        'ORDER BY u.id_unidad DESC OFFSET :offset ROWS FETCH NEXT :fetch ROWS ONLY';
      const result = await conn.execute(sql, { ...binds, offset, fetch });
      return result.rows;
    });
    res.json(pageResponse(rows, offset));
  } catch (error) { next(error); }
});

router.get('/suggest', async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim().slice(0, 80).toLowerCase();
    if (!q) return res.json({ items: [] });
    const items = await withConnection(async (conn) => {
      const result = await conn.execute(
        'SELECT u.id_unidad, u.codigo_interno, u.numero_serie, u.fecha_ingreso, ' +
        'u.estado_actual, u.LOTE_id_lote, l.codigo_lote, l.MODELO_id_modelo, ' +
        'm.nombre AS modelo, l.PROVEEDOR_id_proveedor, p.nombre AS proveedor ' +
        'FROM UNIDAD u JOIN LOTE l ON l.id_lote = u.LOTE_id_lote ' +
        'JOIN MODELO m ON m.id_modelo = l.MODELO_id_modelo ' +
        'JOIN PROVEEDOR p ON p.id_proveedor = l.PROVEEDOR_id_proveedor ' +
        'WHERE INSTR(LOWER(u.codigo_interno), :q) > 0 ' +
        'OR INSTR(LOWER(u.numero_serie), :q) > 0 ' +
        'ORDER BY u.id_unidad DESC FETCH FIRST 10 ROWS ONLY', { q }
      );
      return result.rows;
    });
    res.json({ items });
  } catch (error) { next(error); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const id = positiveId(req.params.id, 'Unidad');
    const item = await withConnection(async (conn) => {
      const result = await conn.execute(
        'SELECT u.id_unidad, u.codigo_interno, u.numero_serie, u.fecha_ingreso, ' +
        'u.estado_actual, u.LOTE_id_lote, l.codigo_lote, l.MODELO_id_modelo, ' +
        'm.nombre AS modelo, l.PROVEEDOR_id_proveedor, p.nombre AS proveedor ' +
        'FROM UNIDAD u JOIN LOTE l ON l.id_lote = u.LOTE_id_lote ' +
        'JOIN MODELO m ON m.id_modelo = l.MODELO_id_modelo ' +
        'JOIN PROVEEDOR p ON p.id_proveedor = l.PROVEEDOR_id_proveedor ' +
        'WHERE u.id_unidad = :id', { id }
      );
      return result.rows[0];
    });
    if (!item) return res.status(404).json({ error: 'Unidad no encontrada' });
    res.json({ item });
  } catch (error) { next(error); }
});

router.get('/:id/history', async (req, res, next) => {
  try {
    const id = positiveId(req.params.id, 'Unidad');
    const events = await withConnection(async (conn) => {
      const unit = await conn.execute(
        'SELECT id_unidad, codigo_interno, fecha_ingreso, estado_actual ' +
        'FROM UNIDAD WHERE id_unidad = :id', { id }
      );
      if (!unit.rows.length) return null;
      const history = [{
        FECHA: unit.rows[0].FECHA_INGRESO,
        TIPO: 'INGRESO', CODIGO: unit.rows[0].CODIGO_INTERNO,
        DETALLE: 'Ingreso de la unidad al lote', USUARIO: null
      }];
      const sales = await conn.execute(
        'SELECT v.fecha_venta, v.codigo_venta, c.nombre AS cliente, op.nombre AS operador ' +
        'FROM DETALLE_VENTA dv JOIN VENTA v ON v.id_venta = dv.VENTA_id_venta ' +
        'JOIN CLIENTE c ON c.id_cliente = v.CLIENTE_id_cliente ' +
        'JOIN USUARIO op ON op.id_usuario = v.USUARIO_id_usuario ' +
        'WHERE dv.UNIDAD_id_unidad = :id ORDER BY v.fecha_venta', { id }
      );
      for (const row of sales.rows) history.push({
        FECHA: row.FECHA_VENTA, TIPO: 'VENTA', CODIGO: row.CODIGO_VENTA,
        DETALLE: 'Cliente: ' + row.CLIENTE, USUARIO: row.OPERADOR
      });
      const returns = await conn.execute(
        'SELECT d.fecha_devolucion, d.fecha_cierre, d.codigo_devolucion, d.motivo, ' +
        'd.destino_final, op.nombre AS operador ' +
        'FROM DEVOLUCION d JOIN DETALLE_VENTA dv ' +
        'ON dv.id_detalle_venta = d.DETALLE_VENTA_id_detalle_venta ' +
        'JOIN USUARIO op ON op.id_usuario = d.USUARIO_id_usuario ' +
        'WHERE dv.UNIDAD_id_unidad = :id ORDER BY d.fecha_devolucion', { id }
      );
      for (const row of returns.rows) {
        history.push({ FECHA: row.FECHA_DEVOLUCION, TIPO: 'DEVOLUCION',
          CODIGO: row.CODIGO_DEVOLUCION, DETALLE: row.MOTIVO, USUARIO: row.OPERADOR });
        if (row.FECHA_CIERRE) history.push({ FECHA: row.FECHA_CIERRE,
          TIPO: 'CIERRE_DEVOLUCION', CODIGO: row.CODIGO_DEVOLUCION,
          DETALLE: row.DESTINO_FINAL, USUARIO: null });
      }
      const services = await conn.execute(
        'SELECT s.fecha_ingreso, s.fecha_cierre, s.codigo_servicio, s.diagnostico, ' +
        's.resultado, si.nombre AS sintoma, ti.nombre AS intervencion, op.nombre AS operador ' +
        'FROM SERVICIO_TECNICO s ' +
        'JOIN SINTOMA si ON si.id_sintoma = s.SINTOMA_id_sintoma ' +
        'LEFT JOIN TIPO_INTERVENCION ti ON ti.id_tipo_intervencion = s.TIPO_INTERVENCION_id_tipo ' +
        'JOIN USUARIO op ON op.id_usuario = s.USUARIO_id_usuario ' +
        'WHERE s.UNIDAD_id_unidad = :id ORDER BY s.fecha_ingreso', { id }
      );
      for (const row of services.rows) {
        history.push({ FECHA: row.FECHA_INGRESO, TIPO: 'SERVICIO',
          CODIGO: row.CODIGO_SERVICIO, DETALLE: row.SINTOMA +
          (row.DIAGNOSTICO ? ' · ' + row.DIAGNOSTICO : ''), USUARIO: row.OPERADOR });
        if (row.FECHA_CIERRE) history.push({ FECHA: row.FECHA_CIERRE,
          TIPO: 'CIERRE_SERVICIO', CODIGO: row.CODIGO_SERVICIO,
          DETALLE: (row.INTERVENCION || '') + ' · ' + (row.RESULTADO || ''), USUARIO: null });
      }
      const sequence = {
        INGRESO: 1, VENTA: 2, DEVOLUCION: 3, SERVICIO: 4,
        CIERRE_SERVICIO: 5, CIERRE_DEVOLUCION: 6
      };
      return history.sort((a, b) =>
        new Date(a.FECHA) - new Date(b.FECHA) ||
        (sequence[a.TIPO] || 99) - (sequence[b.TIPO] || 99));
    });
    if (!events) return res.status(404).json({ error: 'Unidad no encontrada' });
    res.json({ items: events });
  } catch (error) { next(error); }
});

router.post('/', async (req, res, next) => {
  try {
    const binds = {
      codigo: requiredText(req.body?.codigo_interno, 'Codigo interno', 30),
      serie: optionalText(req.body?.numero_serie, 'Numero de serie', 80),
      fecha: isoDate(req.body?.fecha_ingreso, 'Fecha de ingreso'),
      lote: positiveId(req.body?.LOTE_id_lote, 'Lote'),
      newId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }
    };
    const result = await withTransaction((conn) => conn.execute(
      "INSERT INTO UNIDAD (codigo_interno, numero_serie, fecha_ingreso, estado_actual, LOTE_id_lote) " +
      "VALUES (:codigo, :serie, TO_DATE(:fecha, 'YYYY-MM-DD'), 'DISPONIBLE', :lote) " +
      'RETURNING id_unidad INTO :newId', binds
    ));
    res.status(201).json({ id: result.outBinds.newId[0] });
  } catch (error) { next(error); }
});

module.exports = router;
