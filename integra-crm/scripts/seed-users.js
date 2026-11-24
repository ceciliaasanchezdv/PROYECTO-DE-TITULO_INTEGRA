'use strict';

require('dotenv').config(process.env.INTEGRA_ENV_FILE
  ? { path: process.env.INTEGRA_ENV_FILE } : undefined);

const bcrypt = require('bcryptjs');
const { openPool, withTransaction, closePool } = require('../src/db');

async function upsertUser(conn, name, email, password, profile) {
  if (!email || !password || password === 'CAMBIAR') {
    throw new Error('Completa las credenciales de demostracion en .env');
  }
  if (password.length < 12) throw new Error('Cada contraseña de demostracion necesita al menos 12 caracteres');
  const normalized = email.trim().toLowerCase();
  const hash = await bcrypt.hash(password, 12);
  const found = await conn.execute(
    'SELECT id_usuario FROM USUARIO WHERE LOWER(correo) = :correo',
    { correo: normalized }
  );
  if (found.rows.length) {
    await conn.execute(
      'UPDATE USUARIO SET nombre = :nombre, clave_hash = :hash, perfil = :perfil, activo = 1 WHERE id_usuario = :id',
      { nombre: name, hash, perfil: profile, id: found.rows[0].ID_USUARIO }
    );
  } else {
    await conn.execute(
      'INSERT INTO USUARIO (nombre, correo, clave_hash, perfil, activo) VALUES (:nombre, :correo, :hash, :perfil, 1)',
      { nombre: name, correo: normalized, hash, perfil: profile }
    );
  }
}

async function main() {
  await openPool();
  try {
    await withTransaction(async (conn) => {
      await upsertUser(conn, 'Supervisor de demostracion',
        process.env.SEED_SUPERVISOR_EMAIL, process.env.SEED_SUPERVISOR_PASSWORD, 'SUPERVISOR');
      await upsertUser(conn, 'Operador de demostracion',
        process.env.SEED_OPERADOR_EMAIL, process.env.SEED_OPERADOR_PASSWORD, 'OPERADOR');
    });
    console.log('Cuentas de demostracion preparadas');
  } finally {
    await closePool();
  }
}

main().catch((error) => {
  console.error('No se pudieron preparar las cuentas:', error.message);
  process.exitCode = 1;
});
