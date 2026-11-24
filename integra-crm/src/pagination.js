'use strict';

const { HttpError } = require('./http');

const PAGE_SIZE = 50;

function pageRequest(req) {
  const raw = req.query.offset === undefined ? '0' : String(req.query.offset);
  if (!/^(0|[1-9]\d{0,8})$/.test(raw)) {
    throw new HttpError(400, 'La página solicitada no es válida');
  }
  return { offset: Number(raw), fetch: PAGE_SIZE + 1 };
}

function pageResponse(rows, offset) {
  const hasMore = rows.length > PAGE_SIZE;
  return {
    items: hasMore ? rows.slice(0, PAGE_SIZE) : rows,
    has_more: hasMore,
    next_offset: hasMore ? offset + PAGE_SIZE : null
  };
}

module.exports = { PAGE_SIZE, pageRequest, pageResponse };
