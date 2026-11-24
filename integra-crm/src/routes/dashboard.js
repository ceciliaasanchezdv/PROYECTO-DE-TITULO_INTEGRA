'use strict';

const express = require('express');
const { withConnection } = require('../db');
const { requireAuth } = require('../auth');
const { HttpError } = require('../http');

const router = express.Router();
router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    const month = String(req.query.mes || '').trim();
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      throw new HttpError(400, 'El período debe tener formato AAAA-MM');
    }
    const data = await withConnection(async (conn) => {
      const summary = await conn.execute(
        'SELECT ' +
        "(SELECT COUNT(*) FROM VENTA WHERE fecha_venta >= TO_DATE(:mes, 'YYYY-MM') " +
        "AND fecha_venta < ADD_MONTHS(TO_DATE(:mes, 'YYYY-MM'), 1)) AS VENTAS_PERIODO, " +
        "(SELECT COUNT(*) FROM DEVOLUCION WHERE fecha_cierre IS NULL) AS DEVOLUCIONES_ABIERTAS, " +
        "(SELECT COUNT(*) FROM UNIDAD WHERE estado_actual = 'REVISION') AS UNIDADES_REVISION, " +
        "(SELECT COUNT(*) FROM UNIDAD WHERE estado_actual = 'DISPONIBLE') AS UNIDADES_DISPONIBLES, " +
        "(SELECT COUNT(*) FROM UNIDAD) AS UNIDADES_TOTAL, " +
        "(SELECT COUNT(*) FROM SERVICIO_TECNICO WHERE fecha_cierre IS NULL) AS SERVICIOS_ABIERTOS " +
        'FROM DUAL', { mes: month }
      );
      const grouped = await conn.execute(
        "SELECT 'VENTA' AS TIPO, FLOOR((EXTRACT(DAY FROM fecha_venta)-1)/7)+1 AS SEMANA, COUNT(*) AS TOTAL " +
        "FROM VENTA WHERE fecha_venta >= TO_DATE(:mes, 'YYYY-MM') " +
        "AND fecha_venta < ADD_MONTHS(TO_DATE(:mes, 'YYYY-MM'), 1) " +
        'GROUP BY FLOOR((EXTRACT(DAY FROM fecha_venta)-1)/7)+1 ' +
        'UNION ALL ' +
        "SELECT 'DEVOLUCION' AS TIPO, FLOOR((EXTRACT(DAY FROM fecha_devolucion)-1)/7)+1 AS SEMANA, COUNT(*) AS TOTAL " +
        "FROM DEVOLUCION WHERE fecha_devolucion >= TO_DATE(:mes, 'YYYY-MM') " +
        "AND fecha_devolucion < ADD_MONTHS(TO_DATE(:mes, 'YYYY-MM'), 1) " +
        'GROUP BY FLOOR((EXTRACT(DAY FROM fecha_devolucion)-1)/7)+1',
        { mes: month }
      );
      const leadingLot = await conn.execute(
        "SELECT l.codigo_lote, COUNT(*) AS disponibles FROM UNIDAD u " +
        "JOIN LOTE l ON l.id_lote = u.LOTE_id_lote WHERE u.estado_actual = 'DISPONIBLE' " +
        'GROUP BY l.codigo_lote ORDER BY disponibles DESC, l.codigo_lote FETCH FIRST 1 ROW ONLY'
      );
      return { resumen: summary.rows[0], semanas: grouped.rows, lote_destacado: leadingLot.rows[0] || null };
    });
    res.json({ mes: month, calculado_en: new Date().toISOString(), ...data });
  } catch (error) { next(error); }
});

module.exports = router;
