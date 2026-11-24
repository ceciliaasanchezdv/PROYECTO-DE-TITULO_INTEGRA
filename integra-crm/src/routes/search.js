'use strict';

const express = require('express');
const { withConnection } = require('../db');
const { requireAuth } = require('../auth');
const { HttpError } = require('../http');

const router = express.Router();
router.use(requireAuth);

router.get('/volume', async (_req, res, next) => {
  try {
    const total = await withConnection(async (conn) => {
      const result = await conn.execute(
        'SELECT (SELECT COUNT(*) FROM UNIDAD) + ' +
        '(SELECT COUNT(*) FROM CLIENTE) + ' +
        '(SELECT COUNT(*) FROM VENTA) AS TOTAL FROM DUAL'
      );
      return result.rows[0].TOTAL;
    });
    res.json({ total });
  } catch (error) { next(error); }
});

router.get('/', async (req, res, next) => {
  try {
    const term = String(req.query.q || '').trim().toLowerCase();
    if (!term || term.length > 80) {
      throw new HttpError(400, 'Escribe entre 1 y 80 caracteres para buscar');
    }
    const found = await withConnection(async (conn) => {
      const unit = await conn.execute(
        'SELECT u.id_unidad, u.codigo_interno, u.numero_serie, u.fecha_ingreso, ' +
        'u.estado_actual, u.LOTE_id_lote, l.codigo_lote, l.MODELO_id_modelo, ' +
        'm.nombre AS modelo, l.PROVEEDOR_id_proveedor, p.nombre AS proveedor ' +
        'FROM UNIDAD u JOIN LOTE l ON l.id_lote = u.LOTE_id_lote ' +
        'JOIN MODELO m ON m.id_modelo = l.MODELO_id_modelo ' +
        'JOIN PROVEEDOR p ON p.id_proveedor = l.PROVEEDOR_id_proveedor ' +
        'WHERE INSTR(LOWER(u.codigo_interno), :term) > 0 ' +
        'OR INSTR(LOWER(u.numero_serie), :term) > 0 ' +
        'ORDER BY u.id_unidad DESC FETCH FIRST 1 ROWS ONLY', { term }
      );
      if (unit.rows.length) return { tipo: 'unidad', item: unit.rows[0] };

      const client = await conn.execute(
        'SELECT id_cliente, codigo_cliente, nombre FROM CLIENTE ' +
        'WHERE INSTR(LOWER(codigo_cliente), :term) > 0 ' +
        'OR INSTR(LOWER(nombre), :term) > 0 ' +
        'ORDER BY id_cliente DESC FETCH FIRST 1 ROWS ONLY', { term }
      );
      if (client.rows.length) return { tipo: 'cliente', item: client.rows[0] };

      const sale = await conn.execute(
        'SELECT v.id_venta, v.codigo_venta, v.fecha_venta, v.CLIENTE_id_cliente, ' +
        'c.nombre AS cliente, u.nombre AS operador, COUNT(d.id_detalle_venta) AS unidades ' +
        'FROM VENTA v JOIN CLIENTE c ON c.id_cliente = v.CLIENTE_id_cliente ' +
        'JOIN USUARIO u ON u.id_usuario = v.USUARIO_id_usuario ' +
        'LEFT JOIN DETALLE_VENTA d ON d.VENTA_id_venta = v.id_venta ' +
        'WHERE INSTR(LOWER(v.codigo_venta), :term) > 0 ' +
        'GROUP BY v.id_venta, v.codigo_venta, v.fecha_venta, v.CLIENTE_id_cliente, c.nombre, u.nombre ' +
        'ORDER BY v.id_venta DESC FETCH FIRST 1 ROWS ONLY', { term }
      );
      if (sale.rows.length) return { tipo: 'venta', item: sale.rows[0] };
      return null;
    });
    res.json({ encontrado: found });
  } catch (error) { next(error); }
});

module.exports = router;
