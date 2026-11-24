'use strict';

const express = require('express');
const { oracledb, withConnection, withTransaction } = require('../db');
const { requireAuth } = require('../auth');
const { HttpError, requiredText, optionalText, positiveId } = require('../http');
const { pageRequest, pageResponse } = require('../pagination');

const router = express.Router();
router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim().slice(0, 100).toLowerCase();
    const { offset, fetch } = pageRequest(req);
    const rows = await withConnection(async (conn) => {
      const sql = 'SELECT id_cliente, codigo_cliente, nombre, correo, telefono FROM CLIENTE ' +
        (q ? 'WHERE INSTR(LOWER(codigo_cliente), :q) > 0 OR INSTR(LOWER(nombre), :q) > 0 ' : '') +
        'ORDER BY id_cliente DESC OFFSET :offset ROWS FETCH NEXT :fetch ROWS ONLY';
      const result = await conn.execute(sql, { ...(q ? { q } : {}), offset, fetch });
      return result.rows;
    });
    res.json(pageResponse(rows, offset));
  } catch (error) { next(error); }
});

router.post('/', async (req, res, next) => {
  try {
    const binds = {
      codigo: requiredText(req.body?.codigo_cliente, 'Codigo de cliente', 30),
      nombre: requiredText(req.body?.nombre, 'Nombre', 100),
      correo: optionalText(req.body?.correo, 'Correo', 120),
      telefono: optionalText(req.body?.telefono, 'Telefono', 30),
      newId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }
    };
    const result = await withTransaction((conn) => conn.execute(
      'INSERT INTO CLIENTE (codigo_cliente, nombre, correo, telefono) ' +
      'VALUES (:codigo, :nombre, :correo, :telefono) RETURNING id_cliente INTO :newId',
      binds
    ));
    res.status(201).json({ id: result.outBinds.newId[0] });
  } catch (error) { next(error); }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const id = positiveId(req.params.id);
    const fields = [];
    const binds = { id };
    const options = {
      codigo_cliente: ['codigo_cliente', 30, true], nombre: ['nombre', 100, true],
      correo: ['correo', 120, false], telefono: ['telefono', 30, false]
    };
    for (const [field, [column, max, required]] of Object.entries(options)) {
      if (req.body?.[field] === undefined) continue;
      binds[field] = required
        ? requiredText(req.body[field], field, max)
        : optionalText(req.body[field], field, max);
      fields.push(column + ' = :' + field);
    }
    if (!fields.length) throw new HttpError(400, 'No hay cambios para guardar');
    const affected = await withTransaction(async (conn) => {
      const result = await conn.execute(
        'UPDATE CLIENTE SET ' + fields.join(', ') + ' WHERE id_cliente = :id', binds
      );
      return result.rowsAffected;
    });
    if (!affected) throw new HttpError(404, 'Cliente no encontrado');
    res.json({ ok: true });
  } catch (error) { next(error); }
});

module.exports = router;
