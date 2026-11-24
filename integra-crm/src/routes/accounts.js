'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const { oracledb, withConnection, withTransaction } = require('../db');
const { requireAuth, requireSupervisor } = require('../auth');
const { HttpError, requiredText, positiveId } = require('../http');

const router = express.Router();
router.use(requireAuth, requireSupervisor);

function email(value) {
  const result = requiredText(value, 'Correo', 120).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result)) {
    throw new HttpError(400, 'Correo invalido');
  }
  return result;
}

function profile(value) {
  if (!['OPERADOR', 'SUPERVISOR'].includes(value)) {
    throw new HttpError(400, 'Perfil invalido');
  }
  return value;
}

router.get('/', async (_req, res, next) => {
  try {
    const rows = await withConnection(async (conn) => {
      const result = await conn.execute(
        'SELECT id_usuario, nombre, correo, perfil, activo FROM USUARIO ORDER BY id_usuario'
      );
      return result.rows;
    });
    res.json({ items: rows });
  } catch (error) { next(error); }
});

router.post('/', async (req, res, next) => {
  try {
    const nombre = requiredText(req.body?.nombre, 'Nombre', 100);
    const correo = email(req.body?.correo);
    const perfil = profile(req.body?.perfil);
    const clave = requiredText(req.body?.clave, 'Contraseña', 200);
    if (clave.length < 12) throw new HttpError(400, 'La contraseña debe tener al menos 12 caracteres');
    const hash = await bcrypt.hash(clave, 12);
    const id = await withTransaction(async (conn) => {
      const old = await conn.execute('SELECT 1 FROM USUARIO WHERE LOWER(correo) = :correo', { correo });
      if (old.rows.length) throw new HttpError(409, 'El correo ya esta registrado');
      const result = await conn.execute(
        'INSERT INTO USUARIO (nombre, correo, clave_hash, perfil, activo) ' +
        'VALUES (:nombre, :correo, :hash, :perfil, 1) RETURNING id_usuario INTO :newId',
        { nombre, correo, hash, perfil,
          newId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER } }
      );
      return result.outBinds.newId[0];
    });
    res.status(201).json({ id });
  } catch (error) { next(error); }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const id = positiveId(req.params.id);
    const fields = [];
    const binds = { id };
    if (req.body?.nombre !== undefined) {
      binds.nombre = requiredText(req.body.nombre, 'Nombre', 100);
      fields.push('nombre = :nombre');
    }
    if (req.body?.correo !== undefined) {
      binds.correo = email(req.body.correo);
      fields.push('correo = :correo');
    }
    if (req.body?.perfil !== undefined) {
      binds.perfil = profile(req.body.perfil);
      fields.push('perfil = :perfil');
    }
    if (req.body?.activo !== undefined) {
      if (![0, 1].includes(req.body.activo)) throw new HttpError(400, 'Activo debe ser 0 o 1');
      if (id === req.user.ID_USUARIO && req.body.activo === 0) {
        throw new HttpError(400, 'No puedes desactivar tu propia cuenta');
      }
      binds.activo = req.body.activo;
      fields.push('activo = :activo');
    }
    if (req.body?.clave !== undefined) {
      const clave = requiredText(req.body.clave, 'Contraseña', 200);
      if (clave.length < 12) throw new HttpError(400, 'La contraseña debe tener al menos 12 caracteres');
      binds.hash = await bcrypt.hash(clave, 12);
      fields.push('clave_hash = :hash');
    }
    if (!fields.length) throw new HttpError(400, 'No hay cambios para guardar');
    const affected = await withTransaction(async (conn) => {
      if (binds.correo) {
        const duplicate = await conn.execute(
          'SELECT 1 FROM USUARIO WHERE LOWER(correo) = :correo AND id_usuario <> :id',
          { correo: binds.correo, id }
        );
        if (duplicate.rows.length) throw new HttpError(409, 'El correo ya esta registrado');
      }
      const result = await conn.execute('UPDATE USUARIO SET ' + fields.join(', ') + ' WHERE id_usuario = :id', binds);
      return result.rowsAffected;
    });
    if (!affected) throw new HttpError(404, 'Cuenta no encontrada');
    res.json({ ok: true });
  } catch (error) { next(error); }
});

module.exports = router;
