'use strict';

const express = require('express');
const { oracledb, withConnection, withTransaction } = require('../db');
const { requireAuth, requireSupervisor } = require('../auth');
const { HttpError, requiredText, optionalText, positiveId, isoDate } = require('../http');
const { pageRequest, pageResponse } = require('../pagination');

const router = express.Router();
router.use(requireAuth);

const catalog = {
  categorias: {
    table: 'CATEGORIA', id: 'id_categoria',
    fields: { codigo_categoria: ['text', 30, true], nombre: ['text', 80, true] }
  },
  marcas: {
    table: 'MARCA', id: 'id_marca',
    fields: { codigo_marca: ['text', 30, true], nombre: ['text', 80, true] }
  },
  modelos: {
    table: 'MODELO', id: 'id_modelo',
    fields: { codigo_modelo: ['text', 30, true], nombre: ['text', 100, true],
      MARCA_id_marca: ['id', 0, true], CATEGORIA_id_categoria: ['id', 0, true] }
  },
  proveedores: {
    table: 'PROVEEDOR', id: 'id_proveedor',
    fields: { codigo_proveedor: ['text', 30, true], nombre: ['text', 100, true],
      correo: ['text', 120, false], telefono: ['text', 30, false] }
  },
  lotes: {
    table: 'LOTE', id: 'id_lote',
    fields: { codigo_lote: ['text', 30, true], fecha_recepcion: ['date', 0, true],
      PROVEEDOR_id_proveedor: ['id', 0, true], MODELO_id_modelo: ['id', 0, true] }
  },
  sintomas: {
    table: 'SINTOMA', id: 'id_sintoma',
    fields: { codigo_sintoma: ['text', 30, true], nombre: ['text', 100, true],
      descripcion: ['text', 250, true] }
  },
  intervenciones: {
    table: 'TIPO_INTERVENCION', id: 'id_tipo_intervencion',
    fields: { codigo_tipo: ['text', 30, true], nombre: ['text', 100, true],
      descripcion: ['text', 250, false] }
  }
};

function definition(type) {
  const selected = catalog[type];
  if (!selected) throw new HttpError(404, 'Catalogo no encontrado');
  return selected;
}

function parseFields(body, config, partial) {
  const binds = {};
  const columns = [];
  for (const [column, [kind, max, required]] of Object.entries(config.fields)) {
    if (body?.[column] === undefined) {
      if (required && !partial) throw new HttpError(400, column + ' es obligatorio');
      continue;
    }
    const value = body[column];
    if (kind === 'text') {
      binds[column] = required ? requiredText(value, column, max) : optionalText(value, column, max);
    } else if (kind === 'id') {
      binds[column] = positiveId(value, column);
    } else {
      binds[column] = isoDate(value, column);
    }
    columns.push(column);
  }
  return { binds, columns };
}

function valueSql(column, config) {
  return config.fields[column][0] === 'date'
    ? "TO_DATE(:" + column + ", 'YYYY-MM-DD')"
    : ':' + column;
}

router.get('/:type', async (req, res, next) => {
  try {
    const config = definition(req.params.type);
    const { offset, fetch } = pageRequest(req);
    const q = String(req.query.q || '').trim().slice(0, 80).toLowerCase();
    const searchable = Object.keys(config.fields).filter((column) => column.startsWith('codigo_') || column === 'nombre');
    const where = q ? 'WHERE ' + searchable.map((column) => 'INSTR(LOWER(' + column + '), :q) > 0').join(' OR ') + ' ' : '';
    const rows = await withConnection(async (conn) => {
      const result = await conn.execute(
        'SELECT * FROM ' + config.table + ' ' + where + 'ORDER BY ' + config.id +
        ' DESC OFFSET :offset ROWS FETCH NEXT :fetch ROWS ONLY',
        { ...(q ? { q } : {}), offset, fetch }
      );
      return result.rows;
    });
    res.json(pageResponse(rows, offset));
  } catch (error) { next(error); }
});

router.get('/:type/:id', async (req, res, next) => {
  try {
    const config = definition(req.params.type);
    const id = positiveId(req.params.id);
    const item = await withConnection(async (conn) => {
      const result = await conn.execute(
        'SELECT * FROM ' + config.table + ' WHERE ' + config.id + ' = :id', { id }
      );
      return result.rows[0];
    });
    if (!item) throw new HttpError(404, 'Registro de catálogo no encontrado');
    res.json({ item });
  } catch (error) { next(error); }
});

router.post('/:type', requireSupervisor, async (req, res, next) => {
  try {
    const config = definition(req.params.type);
    const { binds, columns } = parseFields(req.body, config, false);
    const result = await withTransaction(async (conn) => {
      return conn.execute(
        'INSERT INTO ' + config.table + ' (' + columns.join(', ') + ') VALUES (' +
        columns.map((column) => valueSql(column, config)).join(', ') + ') ' +
        'RETURNING ' + config.id + ' INTO :newId',
        { ...binds, newId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER } }
      );
    });
    res.status(201).json({ id: result.outBinds.newId[0] });
  } catch (error) { next(error); }
});

router.patch('/:type/:id', requireSupervisor, async (req, res, next) => {
  try {
    const config = definition(req.params.type);
    const id = positiveId(req.params.id);
    const { binds, columns } = parseFields(req.body, config, true);
    if (!columns.length) throw new HttpError(400, 'No hay cambios para guardar');
    const affected = await withTransaction(async (conn) => {
      const result = await conn.execute(
        'UPDATE ' + config.table + ' SET ' +
        columns.map((column) => column + ' = ' + valueSql(column, config)).join(', ') +
        ' WHERE ' + config.id + ' = :targetId',
        { ...binds, targetId: id }
      );
      return result.rowsAffected;
    });
    if (!affected) throw new HttpError(404, 'Registro no encontrado');
    res.json({ ok: true });
  } catch (error) { next(error); }
});

module.exports = router;
