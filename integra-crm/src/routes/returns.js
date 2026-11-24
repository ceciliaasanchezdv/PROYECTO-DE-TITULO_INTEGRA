'use strict';

const express = require('express');
const { oracledb, withConnection, withTransaction } = require('../db');
const { requireAuth } = require('../auth');
const { HttpError, requiredText, positiveId, isoDate } = require('../http');
const { pageRequest, pageResponse } = require('../pagination');

const router = express.Router();
router.use(requireAuth);

const destinations = {
  ENTREGADA: 'ENTREGADA',
  DISPONIBLE: 'DISPONIBLE',
  BAJA: 'BAJA'
};

router.get('/', async (req, res, next) => {
  try {
    const { offset, fetch } = pageRequest(req);
    const q = String(req.query.q || '').trim().slice(0, 80).toLowerCase();
    const filters = [];
    if (q) filters.push('(INSTR(LOWER(d.codigo_devolucion), :q) > 0 OR INSTR(LOWER(u.codigo_interno), :q) > 0 OR INSTR(LOWER(v.codigo_venta), :q) > 0)');
    if (req.query.open === '1') filters.push('d.fecha_cierre IS NULL');
    const rows = await withConnection(async (conn) => {
      const result = await conn.execute(
        'SELECT d.id_devolucion, d.codigo_devolucion, d.fecha_devolucion, d.motivo, ' +
        'd.fecha_cierre, d.destino_final, d.DETALLE_VENTA_id_detalle_venta, ' +
        'u.id_unidad, u.codigo_interno, v.codigo_venta, op.nombre AS operador ' +
        'FROM DEVOLUCION d JOIN DETALLE_VENTA dv ' +
        'ON dv.id_detalle_venta = d.DETALLE_VENTA_id_detalle_venta ' +
        'JOIN UNIDAD u ON u.id_unidad = dv.UNIDAD_id_unidad ' +
        'JOIN VENTA v ON v.id_venta = dv.VENTA_id_venta ' +
        'JOIN USUARIO op ON op.id_usuario = d.USUARIO_id_usuario ' +
        (filters.length ? 'WHERE ' + filters.join(' AND ') + ' ' : '') +
        'ORDER BY d.id_devolucion DESC OFFSET :offset ROWS FETCH NEXT :fetch ROWS ONLY',
        { ...(q ? { q } : {}), offset, fetch }
      );
      return result.rows;
    });
    res.json(pageResponse(rows, offset));
  } catch (error) { next(error); }
});

router.post('/', async (req, res, next) => {
  try {
    const codigo = requiredText(req.body?.codigo_devolucion, 'Codigo de devolucion', 30);
    const fecha = isoDate(req.body?.fecha_devolucion, 'Fecha de devolucion');
    const motivo = requiredText(req.body?.motivo, 'Motivo', 250);
    const detalle = positiveId(req.body?.DETALLE_VENTA_id_detalle_venta, 'Detalle de venta');
    const id = await withTransaction(async (conn) => {
      const sold = await conn.execute(
        'SELECT dv.UNIDAD_id_unidad, v.fecha_venta FROM DETALLE_VENTA dv ' +
        'JOIN VENTA v ON v.id_venta = dv.VENTA_id_venta ' +
        'WHERE dv.id_detalle_venta = :detalle', { detalle }
      );
      if (!sold.rows.length) throw new HttpError(404, 'La venta seleccionada no existe');
      const unitId = sold.rows[0].UNIDAD_ID_UNIDAD;
      const unit = await conn.execute(
        'SELECT estado_actual FROM UNIDAD WHERE id_unidad = :id FOR UPDATE', { id: unitId }
      );
      if (!['VENDIDA', 'ENTREGADA'].includes(unit.rows[0].ESTADO_ACTUAL)) {
        throw new HttpError(409, 'La unidad no esta en un estado que permita devolucion');
      }
      // Una unidad reacondicionada puede venderse otra vez. La devolución
      // siempre debe corresponder a su venta más reciente.
      const latestSale = await conn.execute(
        'SELECT dv.id_detalle_venta FROM DETALLE_VENTA dv ' +
        'JOIN VENTA v ON v.id_venta = dv.VENTA_id_venta ' +
        'WHERE dv.UNIDAD_id_unidad = :id ' +
        'ORDER BY v.id_venta DESC, dv.id_detalle_venta DESC FETCH FIRST 1 ROW ONLY',
        { id: unitId }
      );
      if (latestSale.rows[0]?.ID_DETALLE_VENTA !== detalle) {
        throw new HttpError(409, 'Selecciona la venta vigente de esta unidad');
      }
      const open = await conn.execute(
        'SELECT COUNT(*) AS TOTAL FROM DEVOLUCION d JOIN DETALLE_VENTA dv ' +
        'ON dv.id_detalle_venta = d.DETALLE_VENTA_id_detalle_venta ' +
        'WHERE dv.UNIDAD_id_unidad = :id AND d.fecha_cierre IS NULL', { id: unitId }
      );
      if (open.rows[0].TOTAL > 0) throw new HttpError(409, 'La unidad ya tiene una devolucion abierta');
      const saleDate = sold.rows[0].FECHA_VENTA;
      if (new Date(fecha + 'T00:00:00') < new Date(saleDate.toDateString())) {
        throw new HttpError(400, 'La devolucion no puede ser anterior a la venta');
      }
      const result = await conn.execute(
        "INSERT INTO DEVOLUCION (codigo_devolucion, fecha_devolucion, motivo, " +
        "DETALLE_VENTA_id_detalle_venta, USUARIO_id_usuario) " +
        "VALUES (:codigo, TO_DATE(:fecha, 'YYYY-MM-DD'), :motivo, :detalle, :usuario) " +
        'RETURNING id_devolucion INTO :newId',
        { codigo, fecha, motivo, detalle, usuario: req.user.ID_USUARIO,
          newId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER } }
      );
      await conn.execute("UPDATE UNIDAD SET estado_actual = 'REVISION' WHERE id_unidad = :id", { id: unitId });
      return result.outBinds.newId[0];
    });
    res.status(201).json({ id });
  } catch (error) { next(error); }
});

router.patch('/:id/close', async (req, res, next) => {
  try {
    const id = positiveId(req.params.id);
    const fecha = isoDate(req.body?.fecha_cierre, 'Fecha de cierre');
    const destino = destinations[req.body?.destino_final];
    if (!destino) throw new HttpError(400, 'Destino final invalido');
    await withTransaction(async (conn) => {
      const found = await conn.execute(
        'SELECT d.fecha_cierre, dv.UNIDAD_id_unidad FROM DEVOLUCION d ' +
        'JOIN DETALLE_VENTA dv ON dv.id_detalle_venta = d.DETALLE_VENTA_id_detalle_venta ' +
        'WHERE d.id_devolucion = :id FOR UPDATE OF d.fecha_cierre', { id }
      );
      if (!found.rows.length) throw new HttpError(404, 'Devolucion no encontrada');
      if (found.rows[0].FECHA_CIERRE) throw new HttpError(409, 'La devolucion ya esta cerrada');
      const unitId = found.rows[0].UNIDAD_ID_UNIDAD;
      await conn.execute('SELECT id_unidad FROM UNIDAD WHERE id_unidad = :id FOR UPDATE', { id: unitId });
      const open = await conn.execute(
        'SELECT COUNT(*) AS TOTAL FROM SERVICIO_TECNICO ' +
        'WHERE UNIDAD_id_unidad = :id AND fecha_cierre IS NULL', { id: unitId }
      );
      if (open.rows[0].TOTAL > 0) throw new HttpError(409, 'Cierra antes el servicio tecnico');
      await conn.execute(
        "UPDATE DEVOLUCION SET fecha_cierre = TO_DATE(:fecha, 'YYYY-MM-DD'), destino_final = :destino " +
        'WHERE id_devolucion = :id', { fecha, destino, id }
      );
      await conn.execute('UPDATE UNIDAD SET estado_actual = :destino WHERE id_unidad = :id',
        { destino, id: unitId });
    });
    res.json({ ok: true });
  } catch (error) { next(error); }
});

module.exports = router;
