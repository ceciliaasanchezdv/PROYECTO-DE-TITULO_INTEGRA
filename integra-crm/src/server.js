'use strict';

require('dotenv').config(process.env.INTEGRA_ENV_FILE
  ? { path: process.env.INTEGRA_ENV_FILE } : undefined);

const express = require('express');
const path = require('node:path');
const { openPool, withConnection, closePool } = require('./db');
const { secret, checkOrigin } = require('./auth');
const { HttpError, sendError } = require('./http');
const authRoutes = require('./routes/auth');
const accountRoutes = require('./routes/accounts');
const catalogRoutes = require('./routes/catalogs');
const clientRoutes = require('./routes/clients');
const unitRoutes = require('./routes/units');
const saleRoutes = require('./routes/sales');
const returnRoutes = require('./routes/returns');
const serviceRoutes = require('./routes/service');
const analysisRoutes = require('./routes/analysis');
const dashboardRoutes = require('./routes/dashboard');
const searchRoutes = require('./routes/search');

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '100kb' }));
app.use('/api', checkOrigin);
app.use('/api', authRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/catalogs', catalogRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/units', unitRoutes);
app.use('/api/sales', saleRoutes);
app.use('/api/returns', returnRoutes);
app.use('/api/service', serviceRoutes);
app.use('/api/analysis', analysisRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/search', searchRoutes);

app.get('/api/health', async (_req, res, next) => {
  try {
    const info = await withConnection(async (conn) => {
      const result = await conn.execute(
        "SELECT USER AS ESQUEMA, SYS_CONTEXT('USERENV', 'CON_NAME') AS BASE FROM DUAL"
      );
      return result.rows[0];
    });
    res.json({ ok: true, database: info });
  } catch (error) {
    next(error);
  }
});

app.get('/vendor/vue.js', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'node_modules', 'vue', 'dist', 'vue.global.prod.js'));
});
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use((_req, _res, next) => next(new HttpError(404, 'La dirección solicitada no existe')));
app.use(sendError);

async function main() {
  secret();
  await openPool();
  const port = Number(process.env.PORT || 3000);
  const server = app.listen(port, () => {
    console.log('Integra disponible en http://localhost:' + port);
  });
  async function shutdown() {
    server.close();
    await closePool();
  }
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

main().catch((error) => {
  console.error('No se pudo iniciar Integra:', error.message);
  process.exitCode = 1;
});
