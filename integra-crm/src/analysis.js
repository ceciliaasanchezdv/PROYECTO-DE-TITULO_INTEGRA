'use strict';

const DAY = 24 * 60 * 60 * 1000;
const MIN_CASES = 5;
const MIN_DIFFERENCE = 0.15;

function millis(value) { return new Date(value).getTime(); }
function percent(part, total) { return total ? Math.round(part * 1000 / total) / 10 : 0; }

function firstReturns(rows, cutoff, from) {
  const startOfCutoff = millis(cutoff + 'T00:00:00');
  const earliestSale = Math.max(startOfCutoff - 180 * DAY, from ? millis(from + 'T00:00:00') : -Infinity);
  const latestSaleExclusive = startOfCutoff - 29 * DAY;
  const details = new Map();

  for (const row of rows) {
    const saleTime = millis(row.FECHA_VENTA);
    if (saleTime < earliestSale || saleTime >= latestSaleExclusive) continue;
    let detail = details.get(row.ID_DETALLE_VENTA);
    if (!detail) {
      detail = {
        id: row.ID_DETALLE_VENTA, unitId: row.ID_UNIDAD,
        unitCode: row.CODIGO_INTERNO, saleCode: row.CODIGO_VENTA,
        modelId: row.ID_MODELO, model: row.MODELO,
        lotId: row.ID_LOTE, lot: row.CODIGO_LOTE,
        saleTime, returnTime: null, returnId: null, motivo: null
      };
      details.set(detail.id, detail);
    }
    if (row.ID_DEVOLUCION && row.FECHA_DEVOLUCION) {
      const returnTime = millis(row.FECHA_DEVOLUCION);
      if (returnTime >= saleTime && returnTime <= saleTime + 30 * DAY &&
          (detail.returnTime === null || returnTime < detail.returnTime)) {
        detail.returnTime = returnTime;
        detail.returnId = row.ID_DEVOLUCION;
        detail.motivo = row.MOTIVO;
      }
    }
  }

  const groups = new Map();
  for (const detail of details.values()) {
    const key = detail.modelId + ':' + detail.lotId;
    let group = groups.get(key);
    if (!group) {
      group = { modelo_id: detail.modelId, modelo: detail.model,
        lote_id: detail.lotId, lote: detail.lot,
        vendidas: 0, primeras_devoluciones: 0, detalles_venta: [], devoluciones: [], registros: [] };
      groups.set(key, group);
    }
    group.vendidas++;
    group.detalles_venta.push(detail.id);
    if (detail.returnId) {
      group.primeras_devoluciones++;
      group.devoluciones.push(detail.returnId);
      group.registros.push({
        id_devolucion: detail.returnId, unidad: detail.unitCode,
        venta: detail.saleCode, fecha_venta: new Date(detail.saleTime),
        fecha_devolucion: new Date(detail.returnTime),
        dias_desde_venta: Math.floor((detail.returnTime - detail.saleTime) / DAY),
        motivo: detail.motivo
      });
    }
  }

  const all = [...groups.values()].map((group) => ({
    ...group, tasa: percent(group.primeras_devoluciones, group.vendidas),
    datos_suficientes: group.vendidas >= MIN_CASES
  }));
  const findings = [];
  for (const group of all) {
    const peers = all.filter((other) => other.modelo_id === group.modelo_id && other.lote_id !== group.lote_id);
    const peerSold = peers.reduce((sum, item) => sum + item.vendidas, 0);
    const peerReturns = peers.reduce((sum, item) => sum + item.primeras_devoluciones, 0);
    if (group.vendidas < MIN_CASES || peerSold < MIN_CASES) continue;
    const difference = group.primeras_devoluciones / group.vendidas - peerReturns / peerSold;
    if (difference >= MIN_DIFFERENCE) {
      findings.push({
        modelo: group.modelo, lote: group.lote,
        tasa_lote: group.tasa, tasa_otros_lotes: percent(peerReturns, peerSold),
        diferencia_puntos: Math.round(difference * 1000) / 10,
        vendidas_lote: group.vendidas, devoluciones_lote: group.primeras_devoluciones,
        vendidas_otros_lotes: peerSold, devoluciones_otros_lotes: peerReturns,
        evidencia_devoluciones: group.devoluciones,
        registros: group.registros,
        explicacion: 'El lote presenta una tasa de primeras devoluciones mayor que los otros lotes del mismo modelo.'
      });
    }
  }
  return {
    periodo: 'Ventas desde ' + new Date(earliestSale).toLocaleDateString('es-CL') + ' hasta 30 días antes de la fecha de corte; primeras devoluciones en los 30 días posteriores a cada venta.',
    minimo_casos: MIN_CASES, diferencia_minima_puntos: MIN_DIFFERENCE * 100,
    grupos: all, hallazgos: findings,
    mensaje: all.length && !findings.length ? 'No hay una diferencia suficiente o faltan casos para comparar lotes.' : null
  };
}

function recurrences(rows, cutoff, from) {
  const startOfCutoff = millis(cutoff + 'T00:00:00');
  const earliestClose = Math.max(startOfCutoff - 365 * DAY, from ? millis(from + 'T00:00:00') : -Infinity);
  const latestCloseExclusive = startOfCutoff - 89 * DAY;
  const byUnitSymptom = new Map();
  for (const row of rows) {
    const key = row.UNIDAD_ID_UNIDAD + ':' + row.SINTOMA_ID_SINTOMA;
    const list = byUnitSymptom.get(key) || [];
    list.push(row);
    byUnitSymptom.set(key, list);
  }

  const groups = new Map();
  for (const row of rows) {
    if (!row.FECHA_CIERRE || !row.TIPO_INTERVENCION_ID_TIPO) continue;
    const close = millis(row.FECHA_CIERRE);
    if (close < earliestClose || close >= latestCloseExclusive) continue;
    const key = row.ID_MODELO + ':' + row.SINTOMA_ID_SINTOMA + ':' + row.TIPO_INTERVENCION_ID_TIPO;
    let group = groups.get(key);
    if (!group) {
      group = {
        modelo_id: row.ID_MODELO, modelo: row.MODELO,
        sintoma_id: row.SINTOMA_ID_SINTOMA, sintoma: row.SINTOMA,
        tipo_id: row.TIPO_INTERVENCION_ID_TIPO, intervencion: row.INTERVENCION,
        cerrados: 0, reincidencias: 0, servicios_base: [], servicios_reingreso: [], registros: []
      };
      groups.set(key, group);
    }
    group.cerrados++;
    group.servicios_base.push(row.ID_SERVICIO);
    const later = (byUnitSymptom.get(row.UNIDAD_ID_UNIDAD + ':' + row.SINTOMA_ID_SINTOMA) || [])
      .filter((item) => item.ID_SERVICIO !== row.ID_SERVICIO &&
        millis(item.FECHA_INGRESO) > close && millis(item.FECHA_INGRESO) <= close + 90 * DAY)
      .sort((a, b) => millis(a.FECHA_INGRESO) - millis(b.FECHA_INGRESO))[0];
    if (later) {
      group.reincidencias++;
      group.servicios_reingreso.push(later.ID_SERVICIO);
      group.registros.push({
        unidad: row.CODIGO_INTERNO, servicio_base: row.CODIGO_SERVICIO,
        fecha_cierre: new Date(close), servicio_reingreso: later.CODIGO_SERVICIO,
        fecha_reingreso: later.FECHA_INGRESO
      });
    }
  }

  const all = [...groups.values()].map((group) => ({
    ...group, tasa: percent(group.reincidencias, group.cerrados),
    datos_suficientes: group.cerrados >= MIN_CASES
  }));
  const findings = [];
  for (const group of all) {
    const peers = all.filter((other) => other.modelo_id === group.modelo_id &&
      other.sintoma_id === group.sintoma_id && other.tipo_id !== group.tipo_id);
    const peerClosed = peers.reduce((sum, item) => sum + item.cerrados, 0);
    const peerRecurrent = peers.reduce((sum, item) => sum + item.reincidencias, 0);
    if (group.cerrados < MIN_CASES || peerClosed < MIN_CASES) continue;
    const difference = group.reincidencias / group.cerrados - peerRecurrent / peerClosed;
    if (difference >= MIN_DIFFERENCE) findings.push({
      modelo: group.modelo, sintoma: group.sintoma, intervencion: group.intervencion,
      tasa_intervencion: group.tasa, tasa_otras_intervenciones: percent(peerRecurrent, peerClosed),
      diferencia_puntos: Math.round(difference * 1000) / 10,
      cerrados_intervencion: group.cerrados, reincidencias_intervencion: group.reincidencias,
      cerrados_otras: peerClosed, reincidencias_otras: peerRecurrent,
      evidencia_servicios: group.servicios_base,
      evidencia_reingresos: group.servicios_reingreso,
      registros: group.registros,
      explicacion: 'La intervencion presenta una mayor proporcion de reingresos por el mismo sintoma.'
    });
  }
  return {
    periodo: 'Servicios cerrados desde ' + new Date(earliestClose).toLocaleDateString('es-CL') + ' hasta 90 días antes de la fecha de corte; reingresos por el mismo síntoma en 90 días.',
    minimo_casos: MIN_CASES, diferencia_minima_puntos: MIN_DIFFERENCE * 100,
    grupos: all, hallazgos: findings,
    mensaje: all.length && !findings.length ? 'No hay una diferencia suficiente o faltan casos para comparar intervenciones.' : null
  };
}

module.exports = { firstReturns, recurrences };
