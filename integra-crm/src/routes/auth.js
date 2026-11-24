'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const { withConnection } = require('../db');
const { HttpError, requiredText } = require('../http');
const { startSession, endSession, requireAuth } = require('../auth');

const router = express.Router();
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_FAILURES = 8;
const failedLogins = new Map();

function attemptKey(req, correo) {
  return req.ip + '|' + correo;
}

function recentFailures(key) {
  const record = failedLogins.get(key);
  if (!record) return 0;
  if (Date.now() - record.startedAt >= LOGIN_WINDOW_MS) {
    failedLogins.delete(key);
    return 0;
  }
  return record.count;
}

function recordFailure(key) {
  const current = recentFailures(key);
  failedLogins.set(key, { count: current + 1,
    startedAt: current ? failedLogins.get(key).startedAt : Date.now() });
  if (failedLogins.size > 5000) {
    for (const [entry, value] of failedLogins) {
      if (Date.now() - value.startedAt >= LOGIN_WINDOW_MS) failedLogins.delete(entry);
    }
    if (failedLogins.size > 5000) failedLogins.delete(failedLogins.keys().next().value);
  }
}

router.post('/login', async (req, res, next) => {
  try {
    const correo = requiredText(req.body?.correo, 'Correo', 120).toLowerCase();
    const clave = requiredText(req.body?.clave, 'Contraseña', 200);
    const key = attemptKey(req, correo);
    if (recentFailures(key) >= LOGIN_MAX_FAILURES) {
      throw new HttpError(429, 'Demasiados intentos. Espera 15 minutos antes de volver a intentar');
    }
    const user = await withConnection(async (conn) => {
      const result = await conn.execute(
        'SELECT id_usuario, nombre, correo, clave_hash, perfil, activo FROM USUARIO WHERE LOWER(correo) = :correo',
        { correo }
      );
      return result.rows[0];
    });
    if (!user || user.ACTIVO !== 1 || !(await bcrypt.compare(clave, user.CLAVE_HASH))) {
      recordFailure(key);
      throw new HttpError(401, 'Correo o contraseña incorrectos');
    }
    failedLogins.delete(key);
    startSession(res, user.ID_USUARIO);
    res.json({ user: {
      id: user.ID_USUARIO, nombre: user.NOMBRE, correo: user.CORREO, perfil: user.PERFIL
    } });
  } catch (error) { next(error); }
});

router.get('/me', requireAuth, (req, res) => {
  const user = req.user;
  res.json({ user: {
    id: user.ID_USUARIO, nombre: user.NOMBRE, correo: user.CORREO, perfil: user.PERFIL
  } });
});

router.post('/logout', (_req, res) => {
  endSession(res);
  res.json({ ok: true });
});

module.exports = router;
