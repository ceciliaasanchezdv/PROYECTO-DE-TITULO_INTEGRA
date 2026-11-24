'use strict';

const express = require('express');
const { withConnection } = require('../db');
const { requireAuth } = require('../auth');
const { HttpError, isoDate } = require('../http');
const { firstReturns, recurrences } = require('../analysis');

const router = express.Router();
router.use(requireAuth);

function today() {
  const date = new Date();
  return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' +
    String(date.getDate()).padStart(2, '0');
}

function oneYearBefore(value) {
  const date = new Date(value + 'T00:00:00Z');
  date.setUTCDate(date.getUTCDate() - 365);
  return date.toISOString().slice(0, 10);
}

function daysBefore(value, days) {
  const date = new Date(value + 'T00:00:00Z');
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

router.get('/', async (req, res, next) => {
  try {
    const cutoff = isoDate(req.query.fecha || today(), 'Fecha de corte');
    const from = isoDate(req.query.desde || oneYearBefore(cutoff), 'Fecha inicial');
    if (from > cutoff) throw new HttpError(400, 'La fecha inicial no puede ser posterior a la fecha de corte');
    // Los cálculos solo usan ventas de los últimos 180 días y servicios
    // cerrados de los últimos 365 días. Se añade un día para cubrir bordes.
    const saleStart = daysBefore(cutoff, 181);
    const serviceStart = daysBefore(cutoff, 366);
    const result = await withConnection(async (conn) => {
      const sales = await conn.execute(
        'SELECT dv.id_detalle_venta, u.id_unidad, u.codigo_interno, ' +
        'l.id_lote, l.codigo_lote, m.id_modelo, m.nombre AS modelo, ' +
        'v.codigo_venta, v.fecha_venta, d.id_devolucion, d.fecha_devolucion, d.motivo ' +
        'FROM DETALLE_VENTA dv JOIN VENTA v ON v.id_venta = dv.VENTA_id_venta ' +
        'JOIN UNIDAD u ON u.id_unidad = dv.UNIDAD_id_unidad ' +
        'JOIN LOTE l ON l.id_lote = u.LOTE_id_lote ' +
        'JOIN MODELO m ON m.id_modelo = l.MODELO_id_modelo ' +
        "LEFT JOIN DEVOLUCION d ON d.DETALLE_VENTA_id_detalle_venta = dv.id_detalle_venta " +
        "AND d.fecha_devolucion < TO_DATE(:cutoff, 'YYYY-MM-DD') + 1 " +
        "WHERE v.fecha_venta >= TO_DATE(:saleStart, 'YYYY-MM-DD') " +
        "AND v.fecha_venta < TO_DATE(:cutoff, 'YYYY-MM-DD') + 1",
        { cutoff, saleStart }
      );
      const services = await conn.execute(
        'SELECT s.id_servicio, s.codigo_servicio, s.UNIDAD_id_unidad, u.codigo_interno, s.SINTOMA_id_sintoma, ' +
        'si.nombre AS sintoma, s.TIPO_INTERVENCION_id_tipo, ' +
        'ti.nombre AS intervencion, s.fecha_ingreso, s.fecha_cierre, ' +
        'm.id_modelo, m.nombre AS modelo ' +
        'FROM SERVICIO_TECNICO s JOIN UNIDAD u ON u.id_unidad = s.UNIDAD_id_unidad ' +
        'JOIN LOTE l ON l.id_lote = u.LOTE_id_lote ' +
        'JOIN MODELO m ON m.id_modelo = l.MODELO_id_modelo ' +
        'JOIN SINTOMA si ON si.id_sintoma = s.SINTOMA_id_sintoma ' +
        'LEFT JOIN TIPO_INTERVENCION ti ON ti.id_tipo_intervencion = s.TIPO_INTERVENCION_id_tipo ' +
        "WHERE s.fecha_ingreso < TO_DATE(:cutoff, 'YYYY-MM-DD') + 1 " +
        "AND (s.fecha_ingreso >= TO_DATE(:serviceStart, 'YYYY-MM-DD') " +
        "OR s.fecha_cierre >= TO_DATE(:serviceStart, 'YYYY-MM-DD'))",
        { cutoff, serviceStart }
      );
      const summary = await conn.execute(
        'SELECT ' +
        "(SELECT COUNT(*) FROM VENTA WHERE fecha_venta >= TO_DATE(:start_date, 'YYYY-MM-DD') AND fecha_venta < TO_DATE(:cutoff, 'YYYY-MM-DD') + 1) AS VENTAS, " +
        "(SELECT COUNT(*) FROM DEVOLUCION WHERE fecha_devolucion >= TO_DATE(:start_date, 'YYYY-MM-DD') AND fecha_devolucion < TO_DATE(:cutoff, 'YYYY-MM-DD') + 1) AS DEVOLUCIONES, " +
        "(SELECT COUNT(DISTINCT dv.UNIDAD_id_unidad) FROM DEVOLUCION d JOIN DETALLE_VENTA dv " +
        "ON dv.id_detalle_venta = d.DETALLE_VENTA_id_detalle_venta " +
        "WHERE d.fecha_devolucion >= TO_DATE(:start_date, 'YYYY-MM-DD') AND d.fecha_devolucion < TO_DATE(:cutoff, 'YYYY-MM-DD') + 1) AS UNIDADES_DEVUELTAS, " +
        "(SELECT COUNT(*) FROM SERVICIO_TECNICO WHERE fecha_ingreso >= TO_DATE(:start_date, 'YYYY-MM-DD') AND fecha_ingreso < TO_DATE(:cutoff, 'YYYY-MM-DD') + 1) AS SERVICIOS " +
        'FROM DUAL', { cutoff, start_date: from }
      );
      return { sales: sales.rows, services: services.rows, summary: summary.rows[0] };
    });
    res.json({
      fecha_desde: from,
      fecha_corte: cutoff,
      calculado_en: new Date().toISOString(),
      resumen: result.summary,
      primeras_devoluciones: firstReturns(result.sales, cutoff, from),
      reincidencias: recurrences(result.services, cutoff, from)
    });
  } catch (error) { next(error); }
});

module.exports = router;
