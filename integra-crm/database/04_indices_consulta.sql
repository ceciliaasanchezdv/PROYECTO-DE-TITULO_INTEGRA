-- Indices para las relaciones y filtros usados por Integra.
-- Si ya existe un indice con el nombre indicado, no lo recrea.

DECLARE
    v_count NUMBER;
    PROCEDURE create_if_missing(p_name VARCHAR2, p_sql VARCHAR2) IS
    BEGIN
        SELECT COUNT(*) INTO v_count FROM USER_INDEXES WHERE INDEX_NAME = p_name;
        IF v_count = 0 THEN EXECUTE IMMEDIATE p_sql; END IF;
    END;
BEGIN
    IF SYS_CONTEXT('USERENV', 'SESSION_USER') <> 'INTEGRA' THEN
        RAISE_APPLICATION_ERROR(-20001, 'Conectarse como INTEGRA');
    END IF;

    create_if_missing('IX_UNIDAD_LOTE',
        'CREATE INDEX IX_UNIDAD_LOTE ON UNIDAD (LOTE_id_lote)');
    create_if_missing('IX_LOTE_MODELO',
        'CREATE INDEX IX_LOTE_MODELO ON LOTE (MODELO_id_modelo)');
    create_if_missing('IX_DETALLE_UNIDAD',
        'CREATE INDEX IX_DETALLE_UNIDAD ON DETALLE_VENTA (UNIDAD_id_unidad)');
    create_if_missing('IX_DETALLE_VENTA',
        'CREATE INDEX IX_DETALLE_VENTA ON DETALLE_VENTA (VENTA_id_venta)');
    create_if_missing('IX_DEVOLUCION_DETALLE_FECHA',
        'CREATE INDEX IX_DEVOLUCION_DETALLE_FECHA ON DEVOLUCION (DETALLE_VENTA_id_detalle_venta, fecha_devolucion)');
    create_if_missing('IX_SERVICIO_UNIDAD_SINTOMA',
        'CREATE INDEX IX_SERVICIO_UNIDAD_SINTOMA ON SERVICIO_TECNICO (UNIDAD_id_unidad, SINTOMA_id_sintoma, fecha_ingreso)');
    create_if_missing('IX_VENTA_FECHA',
        'CREATE INDEX IX_VENTA_FECHA ON VENTA (fecha_venta)');
    create_if_missing('IX_SERVICIO_CIERRE',
        'CREATE INDEX IX_SERVICIO_CIERRE ON SERVICIO_TECNICO (fecha_cierre)');
END;
/

SELECT INDEX_NAME, TABLE_NAME
FROM USER_INDEXES
WHERE INDEX_NAME LIKE 'IX_%'
ORDER BY INDEX_NAME;
