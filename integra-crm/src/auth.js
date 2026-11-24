'use strict';

const crypto = require('node:crypto');
const { withConnection } = require('./db');
const { HttpError } = require('./http');

const cookieName = 'integra_session';
const sessionHours = 8;

function secret() {
  const value = process.env.SESSION_SECRET || '';
  if (value.length < 32 || value.startsWith('CAMBIAR')) {
    throw new Error('SESSION_SECRET debe contener al menos 32 caracteres aleatorios');
  }
  return value;
}

function sign(payload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', secret()).update(encoded).digest('base64url');
  return encoded + '.' + signature;
}

function verify(token) {
  if (typeof token !== 'string') return null;
  const [encoded, signature, extra] = token.split('.');
  if (!encoded || !signature || extra) return null;
  const expected = crypto.createHmac('sha256', secret()).update(encoded).digest();
  let actual;
  try { actual = Buffer.from(signature, 'base64url'); } catch { return null; }
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (!Number.isSafeInteger(payload.id) || payload.id < 1 || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

function readCookie(req) {
  const cookies = (req.headers.cookie || '').split(';');
  const pair = cookies.map((item) => item.trim()).find((item) => item.startsWith(cookieName + '='));
  return pair ? pair.slice(cookieName.length + 1) : null;
}

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    maxAge: sessionHours * 60 * 60 * 1000,
    path: '/'
  };
}

function startSession(res, id) {
  const token = sign({ id, exp: Date.now() + sessionHours * 60 * 60 * 1000 });
  res.cookie(cookieName, token, cookieOptions());
}

function endSession(res) {
  const options = cookieOptions();
  delete options.maxAge;
  res.clearCookie(cookieName, options);
}

async function requireAuth(req, _res, next) {
  try {
    const payload = verify(readCookie(req));
    if (!payload) throw new HttpError(401, 'Debes iniciar sesion');
    const user = await withConnection(async (conn) => {
      const result = await conn.execute(
        'SELECT id_usuario, nombre, correo, perfil FROM USUARIO WHERE id_usuario = :id AND activo = 1',
        { id: payload.id }
      );
      return result.rows[0];
    });
    if (!user) throw new HttpError(401, 'La cuenta no esta disponible');
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

function requireSupervisor(req, _res, next) {
  if (req.user?.PERFIL !== 'SUPERVISOR') return next(new HttpError(403, 'Acceso exclusivo del supervisor'));
  next();
}

function checkOrigin(req, _res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.get('origin');
  if (!origin) return next();
  try {
    if (new URL(origin).host === req.get('host')) return next();
  } catch { /* origen invalido */ }
  next(new HttpError(403, 'Origen no autorizado'));
}

module.exports = { secret, startSession, endSession, requireAuth, requireSupervisor, checkOrigin };
