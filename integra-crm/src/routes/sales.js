'use strict';

const express = require('express');
const { oracledb, withConnection, withTransaction } = require('../db');
const { requireAuth } = require('../auth');
const { HttpError, requiredText, positiveId, nonNegative, isoDate } = require('../http');
const { pageRequest, pageResponse } = require('../pagination');

const router = express.Router();
router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    const { offset, fetch } = pageRequest(req);
    const q = String(req.query.q || '').trim().slice(0, 80).toLowerCase();
    const rows = await withConnection(async (conn) => {
      const result = await conn.execute(
        'SELECT v.id_venta, v.codigo_venta, v.fecha_venta, v.CLIENTE_id_cliente, ' +
        'c.nombre AS cliente, u.nombre AS operador, COUNT(d.id_detalle_venta) AS unidades ' +
        'FROM VENTA v JOIN CLIENTE c ON c.id_cliente = v.CLIENTE_id_cliente ' +
        'JOIN USUARIO u ON u.id_usuario = v.USUARIO_id_usuario ' +
        'LEFT JOIN DETALLE_VENTA d ON d.VENTA_id_venta = v.id_venta ' +
        (q ? 'WHERE INSTR(LOWER(v.codigo_venta), :q) > 0 OR INSTR(LOWER(c.nombre), :q) > 0 ' : '') +
        'GROUP BY v.id_venta, v.codigo_venta, v.fecha_venta, v.CLIENTE_id_cliente, c.nombre, u.nombre ' +
        'ORDER BY v.id_venta DESC OFFSET :offset ROWS FETCH NEXT :fetch ROWS ONLY',
        { ...(q ? { q } : {}), offset, fetch }
      );
      return result.rows;
    });
    res.json(pageResponse(rows, offset));
  } catch (error) { next(error); }
});

router.get('/details', async (req, res, next) => {
  try {
    const { offset, fetch } = pageRequest(req);
    const q = String(req.query.q || '').trim().slice(0, 80).toLowerCase();
    const rows = await withConnection(async (conn) => {
      const result = await conn.execute(
        'SELECT d.id_detalle_venta, d.precio_venta, d.UNIDAD_id_unidad, ' +
        'u.codigo_interno, v.id_venta, v.codigo_venta, v.fecha_venta, c.nombre AS cliente ' +
        'FROM DETALLE_VENTA d JOIN VENTA v ON v.id_venta = d.VENTA_id_venta ' +
        'JOIN UNIDAD u ON u.id_unidad = d.UNIDAD_id_unidad ' +
        'JOIN CLIENTE c ON c.id_cliente = v.CLIENTE_id_cliente ' +
        "WHERE u.estado_actual IN ('VENDIDA', 'ENTREGADA') " +
        'AND NOT EXISTS (SELECT 1 FROM DETALLE_VENTA newer ' +
        'JOIN VENTA newer_sale ON newer_sale.id_venta = newer.VENTA_id_venta ' +
        'WHERE newer.UNIDAD_id_unidad = d.UNIDAD_id_unidad ' +
        'AND newer_sale.id_venta > v.id_venta) ' +
        (q ? 'AND (INSTR(LOWER(u.codigo_interno), :q) > 0 OR ' +
          'INSTR(LOWER(u.numero_serie), :q) > 0 OR INSTR(LOWER(v.codigo_venta), :q) > 0) ' : '') +
        'ORDER BY d.id_detalle_venta DESC OFFSET :offset ROWS FETCH NEXT :fetch ROWS ONLY',
        { ...(q ? { q } : {}), offset, fetch }
      );
      return result.rows;
    });
    res.json(pageResponse(rows, offset));
  } catch (error) { next(error); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const id = positiveId(req.params.id, 'Venta');
    const result = await withConnection(async (conn) => {
      const sale = await conn.execute(
        'SELECT v.id_venta, v.codigo_venta, v.fecha_venta, c.nombre AS cliente, op.nombre AS operador ' +
        'FROM VENTA v JOIN CLIENTE c ON c.id_cliente = v.CLIENTE_id_cliente ' +
        'JOIN USUARIO op ON op.id_usuario = v.USUARIO_id_usuario WHERE v.id_venta = :id', { id }
      );
      if (!sale.rows.length) return null;
      const details = await conn.execute(
        'SELECT d.id_detalle_venta, d.precio_venta, u.codigo_interno, u.numero_serie, m.nombre AS modelo ' +
        'FROM DETALLE_VENTA d JOIN UNIDAD u ON u.id_unidad = d.UNIDAD_id_unidad ' +
        'JOIN LOTE l ON l.id_lote = u.LOTE_id_lote JOIN MODELO m ON m.id_modelo = l.MODELO_id_modelo ' +
        'WHERE d.VENTA_id_venta = :id ORDER BY d.id_detalle_venta', { id }
      );
      return { ...sale.rows[0], detalles: details.rows };
    });
    if (!result) throw new HttpError(404, 'Venta no encontrada');
    res.json({ item: result });
  } catch (error) { next(error); }
});

router.post('/', async (req, res, next) => {
  try {
    const codigo = requiredText(req.body?.codigo_venta, 'Codigo de venta', 30);
    const fecha = isoDate(req.body?.fecha_venta, 'Fecha de venta');
    const cliente = positiveId(req.body?.CLIENTE_id_cliente, 'Cliente');
    const unidades = req.body?.unidades;
    if (!Array.isArray(unidades) || !unidades.length || unidades.length > 20) {
      throw new HttpError(400, 'La venta debe incluir entre 1 y 20 unidades');
    }
    const lines = unidades.map((item) => ({
      id: positiveId(item?.id_unidad, 'Unidad'),
      precio: nonNegative(item?.precio_venta, 'Precio de venta')
    }));
    if (new Set(lines.map((item) => item.id)).size !== lines.length) {
      throw new HttpError(400, 'Una unidad aparece dos veces en la venta');
    }

    const id = await withTransaction(async (conn) => {
      const sale = await conn.execute(
        "INSERT INTO VENTA (codigo_venta, fecha_venta, CLIENTE_id_cliente, USUARIO_id_usuario) " +
        "VALUES (:codigo, TO_DATE(:fecha, 'YYYY-MM-DD'), :cliente, :usuario) " +
        'RETURNING id_venta INTO :newId',
        { codigo, fecha, cliente, usuario: req.user.ID_USUARIO,
          newId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER } }
      );
      const saleId = sale.outBinds.newId[0];
      for (const item of lines) {
        const found = await conn.execute(
          'SELECT estado_actual FROM UNIDAD WHERE id_unidad = :id FOR UPDATE', { id: item.id }
        );
        if (!found.rows.length) throw new HttpError(404, 'Unidad ' + item.id + ' no encontrada');
        if (found.rows[0].ESTADO_ACTUAL !== 'DISPONIBLE') {
          throw new HttpError(409, 'La unidad ' + item.id + ' no esta disponible');
        }
        await conn.execute(
          'INSERT INTO DETALLE_VENTA (precio_venta, VENTA_id_venta, UNIDAD_id_unidad) ' +
          'VALUES (:precio, :venta, :unidad)',
          { precio: item.precio, venta: saleId, unidad: item.id }
        );
        await conn.execute(
          "UPDATE UNIDAD SET estado_actual = 'VENDIDA' WHERE id_unidad = :id",
          { id: item.id }
        );
      }
      return saleId;
    });
    res.status(201).json({ id });
  } catch (error) { next(error); }
});

module.exports = router;
