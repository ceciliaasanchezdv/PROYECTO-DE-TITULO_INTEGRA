'use strict';

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function requiredText(value, label, max = 250) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new HttpError(400, label + ' es obligatorio');
  }
  const text = value.trim();
  if (text.length > max) throw new HttpError(400, label + ' excede ' + max + ' caracteres');
  return text;
}

function optionalText(value, label, max = 250) {
  if (value === undefined || value === null || value === '') return null;
  return requiredText(value, label, max);
}

function positiveId(value, label = 'ID') {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1) {
    throw new HttpError(400, label + ' debe ser un entero positivo');
  }
  return number;
}

function nonNegative(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    throw new HttpError(400, label + ' debe ser un numero no negativo');
  }
  return number;
}

function isoDate(value, label) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new HttpError(400, label + ' debe tener formato AAAA-MM-DD');
  }
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new HttpError(400, label + ' no es una fecha valida');
  }
  return value;
}

function sendError(error, req, res, _next) {
  let status = error.status || 500;
  let message = error.message || 'No se pudo completar la operación';
  if (error instanceof SyntaxError && error.status === 400) message = 'JSON inválido';
  else if (!error.status) {
    const known = {
      2290: [400, 'Los datos no cumplen las reglas de la base de datos'],
      2291: [400, 'La referencia seleccionada no existe'],
      20022: [409, 'El lote ya tiene unidades; su código u origen no se puede cambiar'],
      20023: [409, 'El modelo ya tiene lotes; su código o clasificación no se puede cambiar'],
      20024: [409, 'La devolución no corresponde a la unidad del servicio'],
      20025: [409, 'La venta de una devolución registrada no se puede cambiar'],
      20026: [409, 'La unidad de una venta registrada no se puede cambiar']
    };
    if (error.errorNum === 1) {
      status = 409;
      message = error.message?.includes('UX_UNIDAD_SERIE_NORMALIZADA')
        ? 'El número de serie ya está registrado' : 'El código o correo ya existe';
    } else if (known[error.errorNum]) {
      [status, message] = known[error.errorNum];
    } else {
      console.error(error);
      message = 'No se pudo completar la operación';
    }
  }
  if (!String(req.get('accept') || '').includes('text/html')) {
    return res.status(status).json({ error: message });
  }
  const escaped = String(message).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
  return res.status(status).type('html').send(`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Integra · ${status}</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f5f7fb;color:#1b273b;font:16px Arial,sans-serif;padding:1rem;box-sizing:border-box}.card{width:min(440px,100%);background:#fff;border:1px solid #dbe3ee;border-radius:12px;padding:2rem;box-sizing:border-box}.brand{color:#3474f4;font-weight:800}.code{font-size:3rem;font-weight:800;margin:1.5rem 0 .3rem}p{line-height:1.5}.actions{display:flex;gap:.6rem;flex-wrap:wrap;margin-top:1.5rem}a,button{font:inherit;padding:.7rem 1rem;border-radius:6px;border:1px solid #3474f4;background:#3474f4;color:#fff;text-decoration:none;cursor:pointer}button{background:#fff;color:#3474f4}</style></head><body><main class="card"><div class="brand">▣ Integra</div><div class="code">${status}</div><h1>No pudimos abrir esta página</h1><p>${escaped}</p><div class="actions"><a href="/">Ir a Integra</a><button onclick="history.back()">Volver</button></div></main></body></html>`);
}

module.exports = {
  HttpError, requiredText, optionalText, positiveId, nonNegative, isoDate, sendError
};
