'use strict';

const express = require('express');
const { oracledb, withConnection, withTransaction } = require('../db');
const { requireAuth } = require('../auth');
const { HttpError, requiredText, optionalText, positiveId, isoDate } = require('../http');
const { pageRequest, pageResponse } = require('../pagination');

const router = express.Router();
router.use(requireAuth);

const destinations = new Set(['ENTREGADA', 'DISPONIBLE', 'BAJA']);

router.get('/', async (req, res, next) => {
  try {
    const { offset, fetch } = pageRequest(req);
    const q = String(req.query.q || '').trim().slice(0, 80).toLowerCase();
    const filters = [];
    if (q) filters.push('(INSTR(LOWER(s.codigo_servicio), :q) > 0 OR INSTR(LOWER(u.codigo_interno), :q) > 0)');
    if (req.query.open === '1') filters.push('s.fecha_cierre IS NULL');
    const rows = await withConnection(async (conn) => {
      const result = await conn.execute(
        'SELECT s.id_servicio, s.codigo_servicio, s.fecha_ingreso, s.diagnostico, ' +
        's.fecha_cierre, s.resultado, s.DEVOLUCION_id_devolucion, s.UNIDAD_id_unidad, ' +
        's.SINTOMA_id_sintoma, si.nombre AS sintoma, s.TIPO_INTERVENCION_id_tipo, ' +
        'ti.nombre AS intervencion, u.codigo_interno, op.nombre AS operador ' +
        'FROM SERVICIO_TECNICO s ' +
        'JOIN UNIDAD u ON u.id_unidad = s.UNIDAD_id_unidad ' +
        'JOIN SINTOMA si ON si.id_sintoma = s.SINTOMA_id_sintoma ' +
        'LEFT JOIN TIPO_INTERVENCION ti ON ti.id_tipo_intervencion = s.TIPO_INTERVENCION_id_tipo ' +
        'JOIN USUARIO op ON op.id_usuario = s.USUARIO_id_usuario ' +
        (filters.length ? 'WHERE ' + filters.join(' AND ') + ' ' : '') +
        'ORDER BY s.id_servicio DESC OFFSET :offset ROWS FETCH NEXT :fetch ROWS ONLY',
        { ...(q ? { q } : {}), offset, fetch }
      );
      return result.rows;
    });
    res.json(pageResponse(rows, offset));
  } catch (error) { next(error); }
});

router.post('/', async (req, res, next) => {
  try {
    const codigo = requiredText(req.body?.codigo_servicio, 'Codigo de servicio', 30);
    const fecha = isoDate(req.body?.fecha_ingreso, 'Fecha de ingreso');
    const unidad = positiveId(req.body?.UNIDAD_id_unidad, 'Unidad');
    const sintoma = positiveId(req.body?.SINTOMA_id_sintoma, 'Sintoma');
    const diagnostico = optionalText(req.body?.diagnostico, 'Diagnostico', 500);
    const devolucion = req.body?.DEVOLUCION_id_devolucion
      ? positiveId(req.body.DEVOLUCION_id_devolucion, 'Devolucion') : null;

    const id = await withTransaction(async (conn) => {
      const found = await conn.execute(
        'SELECT estado_actual FROM UNIDAD WHERE id_unidad = :id FOR UPDATE', { id: unidad }
      );
      if (!found.rows.length) throw new HttpError(404, 'Unidad no encontrada');
      const state = found.rows[0].ESTADO_ACTUAL;
      if (!['VENDIDA', 'REVISION', 'ENTREGADA'].includes(state)) {
        throw new HttpError(409, 'La unidad no esta vendida o en revision');
      }
      const sale = await conn.execute(
        'SELECT COUNT(*) AS TOTAL FROM DETALLE_VENTA WHERE UNIDAD_id_unidad = :id',
        { id: unidad }
      );
      if (sale.rows[0].TOTAL === 0) throw new HttpError(409, 'La unidad no tiene una venta registrada');
      const open = await conn.execute(
        'SELECT COUNT(*) AS TOTAL FROM SERVICIO_TECNICO ' +
        'WHERE UNIDAD_id_unidad = :id AND fecha_cierre IS NULL', { id: unidad }
      );
      if (open.rows[0].TOTAL > 0) throw new HttpError(409, 'La unidad ya tiene un servicio abierto');
      if (devolucion) {
        const linked = await conn.execute(
          'SELECT d.fecha_cierre, dv.UNIDAD_id_unidad FROM DEVOLUCION d ' +
          'JOIN DETALLE_VENTA dv ON dv.id_detalle_venta = d.DETALLE_VENTA_id_detalle_venta ' +
          'WHERE d.id_devolucion = :id', { id: devolucion }
        );
        if (!linked.rows.length || linked.rows[0].UNIDAD_ID_UNIDAD !== unidad) {
          throw new HttpError(400, 'La devolucion no corresponde a esta unidad');
        }
        if (linked.rows[0].FECHA_CIERRE) throw new HttpError(409, 'La devolucion ya esta cerrada');
      }
      const result = await conn.execute(
        "INSERT INTO SERVICIO_TECNICO (codigo_servicio, fecha_ingreso, diagnostico, " +
        "DEVOLUCION_id_devolucion, UNIDAD_id_unidad, SINTOMA_id_sintoma, USUARIO_id_usuario) " +
        "VALUES (:codigo, TO_DATE(:fecha, 'YYYY-MM-DD'), :diagnostico, :devolucion, " +
        ':unidad, :sintoma, :usuario) RETURNING id_servicio INTO :newId',
        { codigo, fecha, diagnostico, devolucion, unidad, sintoma,
          usuario: req.user.ID_USUARIO,
          newId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER } }
      );
      await conn.execute(
        "UPDATE UNIDAD SET estado_actual = 'EN_SERVICIO' WHERE id_unidad = :id",
        { id: unidad }
      );
      return result.outBinds.newId[0];
    });
    res.status(201).json({ id });
  } catch (error) { next(error); }
});

router.get('/:id/components', async (req, res, next) => {
  try {
    const id = positiveId(req.params.id, 'Servicio');
    const items = await withConnection(async (conn) => {
      const result = await conn.execute(
        'SELECT id_componente_utilizado, nombre, cantidad, observacion ' +
        'FROM COMPONENTE_UTILIZADO WHERE SERVICIO_TECNICO_id_servicio = :id ' +
        'ORDER BY id_componente_utilizado', { id }
      );
      return result.rows;
    });
    res.json({ items });
  } catch (error) { next(error); }
});

router.post('/:id/components', async (req, res, next) => {
  try {
    const id = positiveId(req.params.id, 'Servicio');
    const nombre = requiredText(req.body?.nombre, 'Componente', 120);
    const cantidad = positiveId(req.body?.cantidad, 'Cantidad');
    if (cantidad > 99999) throw new HttpError(400, 'Cantidad demasiado alta');
    const observacion = optionalText(req.body?.observacion, 'Observacion', 250);
    const newId = await withTransaction(async (conn) => {
      const service = await conn.execute(
        'SELECT fecha_cierre FROM SERVICIO_TECNICO WHERE id_servicio = :id FOR UPDATE', { id }
      );
      if (!service.rows.length) throw new HttpError(404, 'Servicio no encontrado');
      if (service.rows[0].FECHA_CIERRE) throw new HttpError(409, 'El servicio ya esta cerrado');
      const result = await conn.execute(
        'INSERT INTO COMPONENTE_UTILIZADO (nombre, cantidad, observacion, SERVICIO_TECNICO_id_servicio) ' +
        'VALUES (:nombre, :cantidad, :observacion, :id) RETURNING id_componente_utilizado INTO :newId',
        { nombre, cantidad, observacion, id,
          newId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER } }
      );
      return result.outBinds.newId[0];
    });
    res.status(201).json({ id: newId });
  } catch (error) { next(error); }
});

router.patch('/:id/close', async (req, res, next) => {
  try {
    const id = positiveId(req.params.id, 'Servicio');
    const fecha = isoDate(req.body?.fecha_cierre, 'Fecha de cierre');
    const tipo = positiveId(req.body?.TIPO_INTERVENCION_id_tipo, 'Tipo de intervencion');
    const resultado = requiredText(req.body?.resultado, 'Resultado', 250);
    const destino = req.body?.destino_final;
    if (!destinations.has(destino)) throw new HttpError(400, 'Destino final invalido');
    await withTransaction(async (conn) => {
      const found = await conn.execute(
        'SELECT UNIDAD_id_unidad, DEVOLUCION_id_devolucion, fecha_ingreso, fecha_cierre ' +
        'FROM SERVICIO_TECNICO WHERE id_servicio = :id FOR UPDATE', { id }
      );
      if (!found.rows.length) throw new HttpError(404, 'Servicio no encontrado');
      const item = found.rows[0];
      if (item.FECHA_CIERRE) throw new HttpError(409, 'El servicio ya esta cerrado');
      if (new Date(fecha + 'T00:00:00') < new Date(item.FECHA_INGRESO.toDateString())) {
        throw new HttpError(400, 'El cierre no puede ser anterior al ingreso');
      }
      await conn.execute('SELECT id_unidad FROM UNIDAD WHERE id_unidad = :id FOR UPDATE',
        { id: item.UNIDAD_ID_UNIDAD });
      await conn.execute(
        "UPDATE SERVICIO_TECNICO SET fecha_cierre = TO_DATE(:fecha, 'YYYY-MM-DD'), " +
        'resultado = :resultado, TIPO_INTERVENCION_id_tipo = :tipo WHERE id_servicio = :id',
        { fecha, resultado, tipo, id }
      );
      if (item.DEVOLUCION_ID_DEVOLUCION) {
        await conn.execute(
          "UPDATE DEVOLUCION SET fecha_cierre = TO_DATE(:fecha, 'YYYY-MM-DD'), " +
          'destino_final = :destino WHERE id_devolucion = :id AND fecha_cierre IS NULL',
          { fecha, destino, id: item.DEVOLUCION_ID_DEVOLUCION }
        );
      }
      await conn.execute('UPDATE UNIDAD SET estado_actual = :destino WHERE id_unidad = :id',
        { destino, id: item.UNIDAD_ID_UNIDAD });
    });
    res.json({ ok: true });
  } catch (error) { next(error); }
});

module.exports = router;
