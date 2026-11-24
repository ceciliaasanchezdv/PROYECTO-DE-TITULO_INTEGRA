-- INTEGRA: reglas de integridad adicionales al esquema de EVA 2.
-- Antes de cambiar la base, verifica que los datos actuales cumplan las reglas.
-- Se puede repetir: las restricciones e indice existentes no se recrean.

DECLARE
    v_total NUMBER;
    PROCEDURE assert_zero(p_sql VARCHAR2, p_message VARCHAR2) IS
        v_count NUMBER;
    BEGIN
        EXECUTE IMMEDIATE p_sql INTO v_count;
        IF v_count > 0 THEN
            RAISE_APPLICATION_ERROR(-20020, p_message || ': ' || v_count);
        END IF;
    END;
BEGIN
    IF SYS_CONTEXT('USERENV', 'SESSION_USER') <> 'INTEGRA' THEN
        RAISE_APPLICATION_ERROR(-20001, 'Conectarse como INTEGRA');
    END IF;

    SELECT COUNT(*) INTO v_total FROM USER_TABLES
    WHERE TABLE_NAME IN (
        'COMPONENTE_UTILIZADO', 'DETALLE_VENTA', 'USUARIO', 'UNIDAD',
        'DEVOLUCION', 'SERVICIO_TECNICO'
    );
    IF v_total <> 6 THEN
        RAISE_APPLICATION_ERROR(-20021, 'Faltan tablas del esquema INTEGRA');
    END IF;

    assert_zero('SELECT COUNT(*) FROM COMPONENTE_UTILIZADO WHERE cantidad <= 0',
        'Componentes con cantidad invalida');
    assert_zero('SELECT COUNT(*) FROM DETALLE_VENTA WHERE precio_venta < 0',
        'Detalles con precio invalido');
    assert_zero('SELECT COUNT(*) FROM USUARIO WHERE perfil NOT IN (''OPERADOR'', ''SUPERVISOR'')',
        'Usuarios con perfil invalido');
    assert_zero('SELECT COUNT(*) FROM USUARIO WHERE activo NOT IN (0, 1)',
        'Usuarios con estado activo invalido');
    assert_zero('SELECT COUNT(*) FROM UNIDAD WHERE estado_actual NOT IN ' ||
        '(''DISPONIBLE'', ''VENDIDA'', ''REVISION'', ''EN_SERVICIO'', ''ENTREGADA'', ''BAJA'')',
        'Unidades con estado invalido');
    assert_zero('SELECT COUNT(*) FROM DEVOLUCION WHERE ' ||
        '(fecha_cierre IS NULL AND destino_final IS NOT NULL) OR ' ||
        '(fecha_cierre IS NOT NULL AND (fecha_cierre < fecha_devolucion OR ' ||
        'destino_final IS NULL OR destino_final NOT IN ' ||
        '(''ENTREGADA'', ''DISPONIBLE'', ''BAJA'')))',
        'Devoluciones con cierre o destino invalido');
    assert_zero('SELECT COUNT(*) FROM SERVICIO_TECNICO WHERE ' ||
        'fecha_cierre IS NOT NULL AND (fecha_cierre < fecha_ingreso OR ' ||
        'TIPO_INTERVENCION_id_tipo IS NULL OR resultado IS NULL)',
        'Servicios cerrados sin datos obligatorios');
    assert_zero('SELECT COUNT(*) FROM (SELECT UPPER(TRIM(numero_serie)) AS serie ' ||
        'FROM UNIDAD WHERE TRIM(numero_serie) IS NOT NULL ' ||
        'GROUP BY UPPER(TRIM(numero_serie)) HAVING COUNT(*) > 1)',
        'Numeros de serie repetidos sin distinguir mayusculas');
    assert_zero('SELECT COUNT(*) FROM SERVICIO_TECNICO s ' ||
        'JOIN DEVOLUCION d ON d.id_devolucion = s.DEVOLUCION_id_devolucion ' ||
        'JOIN DETALLE_VENTA dv ON dv.id_detalle_venta = d.DETALLE_VENTA_id_detalle_venta ' ||
        'WHERE s.UNIDAD_id_unidad <> dv.UNIDAD_id_unidad',
        'Servicios vinculados a devoluciones de otra unidad');
END;
/

DECLARE
    v_existe NUMBER;
    PROCEDURE add_check(p_name VARCHAR2, p_sql VARCHAR2) IS
    BEGIN
        SELECT COUNT(*) INTO v_existe FROM USER_CONSTRAINTS
        WHERE CONSTRAINT_NAME = p_name;
        IF v_existe = 0 THEN EXECUTE IMMEDIATE p_sql; END IF;
    END;
BEGIN
    add_check('CK_COMPONENTE_CANTIDAD',
        'ALTER TABLE COMPONENTE_UTILIZADO ADD CONSTRAINT CK_COMPONENTE_CANTIDAD CHECK (cantidad > 0)');
    add_check('CK_DETALLE_PRECIO',
        'ALTER TABLE DETALLE_VENTA ADD CONSTRAINT CK_DETALLE_PRECIO CHECK (precio_venta >= 0)');
    add_check('CK_USUARIO_PERFIL',
        'ALTER TABLE USUARIO ADD CONSTRAINT CK_USUARIO_PERFIL CHECK (perfil IN (''OPERADOR'', ''SUPERVISOR''))');
    add_check('CK_USUARIO_ACTIVO',
        'ALTER TABLE USUARIO ADD CONSTRAINT CK_USUARIO_ACTIVO CHECK (activo IN (0, 1))');
    add_check('CK_UNIDAD_ESTADO',
        'ALTER TABLE UNIDAD ADD CONSTRAINT CK_UNIDAD_ESTADO CHECK (estado_actual IN ' ||
        '(''DISPONIBLE'', ''VENDIDA'', ''REVISION'', ''EN_SERVICIO'', ''ENTREGADA'', ''BAJA''))');
    add_check('CK_DEVOLUCION_CIERRE',
        'ALTER TABLE DEVOLUCION ADD CONSTRAINT CK_DEVOLUCION_CIERRE CHECK (' ||
        '(fecha_cierre IS NULL AND destino_final IS NULL) OR ' ||
        '(fecha_cierre IS NOT NULL AND fecha_cierre >= fecha_devolucion AND ' ||
        'destino_final IN (''ENTREGADA'', ''DISPONIBLE'', ''BAJA'')))');
    add_check('CK_SERVICIO_CIERRE',
        'ALTER TABLE SERVICIO_TECNICO ADD CONSTRAINT CK_SERVICIO_CIERRE CHECK (' ||
        'fecha_cierre IS NULL OR (fecha_cierre >= fecha_ingreso AND ' ||
        'TIPO_INTERVENCION_id_tipo IS NOT NULL AND resultado IS NOT NULL))');

    SELECT COUNT(*) INTO v_existe FROM USER_INDEXES
    WHERE INDEX_NAME = 'UX_UNIDAD_SERIE_NORMALIZADA';
    IF v_existe = 0 THEN
        EXECUTE IMMEDIATE 'CREATE UNIQUE INDEX UX_UNIDAD_SERIE_NORMALIZADA ' ||
            'ON UNIDAD (UPPER(TRIM(numero_serie)))';
    END IF;
END;
/

-- Una vez que un lote tiene unidades, no cambia su codigo, origen ni modelo.
-- Los nombres descriptivos de las tablas relacionadas si pueden corregirse.
CREATE OR REPLACE TRIGGER TRG_LOTE_ORIGEN_FIJO
BEFORE UPDATE OF codigo_lote, fecha_recepcion, PROVEEDOR_id_proveedor, MODELO_id_modelo
ON LOTE FOR EACH ROW
DECLARE
    v_unidades NUMBER;
BEGIN
    IF :NEW.codigo_lote <> :OLD.codigo_lote OR
       :NEW.fecha_recepcion <> :OLD.fecha_recepcion OR
       :NEW.PROVEEDOR_id_proveedor <> :OLD.PROVEEDOR_id_proveedor OR
       :NEW.MODELO_id_modelo <> :OLD.MODELO_id_modelo THEN
        SELECT COUNT(*) INTO v_unidades FROM UNIDAD
        WHERE LOTE_id_lote = :OLD.id_lote;
        IF v_unidades > 0 THEN
            RAISE_APPLICATION_ERROR(-20022,
                'No se puede cambiar el origen de un lote que ya tiene unidades');
        END IF;
    END IF;
END;
/

-- El codigo y la clasificacion de un modelo usado por lotes permanecen estables.
CREATE OR REPLACE TRIGGER TRG_MODELO_CLASIFICACION_FIJA
BEFORE UPDATE OF codigo_modelo, MARCA_id_marca, CATEGORIA_id_categoria
ON MODELO FOR EACH ROW
DECLARE
    v_lotes NUMBER;
BEGIN
    IF :NEW.codigo_modelo <> :OLD.codigo_modelo OR
       :NEW.MARCA_id_marca <> :OLD.MARCA_id_marca OR
       :NEW.CATEGORIA_id_categoria <> :OLD.CATEGORIA_id_categoria THEN
        SELECT COUNT(*) INTO v_lotes FROM LOTE
        WHERE MODELO_id_modelo = :OLD.id_modelo;
        IF v_lotes > 0 THEN
            RAISE_APPLICATION_ERROR(-20023,
                'No se puede reclasificar un modelo que ya tiene lotes');
        END IF;
    END IF;
END;
/

-- Un servicio puede no tener devolucion; si la tiene, ambas deben ser de la misma unidad, incluso cuando la insercion se haga fuera de la API.
CREATE OR REPLACE TRIGGER TRG_SERVICIO_DEVOLUCION_UNIDAD
BEFORE INSERT OR UPDATE OF UNIDAD_id_unidad, DEVOLUCION_id_devolucion
ON SERVICIO_TECNICO FOR EACH ROW
DECLARE
    v_match NUMBER;
BEGIN
    IF :NEW.DEVOLUCION_id_devolucion IS NOT NULL THEN
        SELECT COUNT(*) INTO v_match
        FROM DEVOLUCION d
        JOIN DETALLE_VENTA dv
          ON dv.id_detalle_venta = d.DETALLE_VENTA_id_detalle_venta
        WHERE d.id_devolucion = :NEW.DEVOLUCION_id_devolucion
          AND dv.UNIDAD_id_unidad = :NEW.UNIDAD_id_unidad;
        IF v_match = 0 THEN
            RAISE_APPLICATION_ERROR(-20024,
                'La devolucion no corresponde a la unidad del servicio');
        END IF;
    END IF;
END;
/

-- La venta/unidad asociada a una devolucion es parte de su historial.
CREATE OR REPLACE TRIGGER TRG_DEVOLUCION_DETALLE_FIJO
BEFORE UPDATE OF DETALLE_VENTA_id_detalle_venta
ON DEVOLUCION FOR EACH ROW
BEGIN
    IF :NEW.DETALLE_VENTA_id_detalle_venta <> :OLD.DETALLE_VENTA_id_detalle_venta THEN
        RAISE_APPLICATION_ERROR(-20025,
            'No se puede cambiar la venta de una devolucion registrada');
    END IF;
END;
/

CREATE OR REPLACE TRIGGER TRG_DETALLE_VENTA_VINCULO_FIJO
BEFORE UPDATE OF VENTA_id_venta, UNIDAD_id_unidad
ON DETALLE_VENTA FOR EACH ROW
BEGIN
    IF :NEW.VENTA_id_venta <> :OLD.VENTA_id_venta OR
       :NEW.UNIDAD_id_unidad <> :OLD.UNIDAD_id_unidad THEN
        RAISE_APPLICATION_ERROR(-20026,
            'No se puede mover una unidad a otra venta ya registrada');
    END IF;
END;
/

SELECT CONSTRAINT_NAME, TABLE_NAME, STATUS
FROM USER_CONSTRAINTS
WHERE CONSTRAINT_NAME LIKE 'CK_%'
ORDER BY CONSTRAINT_NAME;

SELECT INDEX_NAME, TABLE_NAME, UNIQUENESS
FROM USER_INDEXES
WHERE INDEX_NAME = 'UX_UNIDAD_SERIE_NORMALIZADA';

SELECT TRIGGER_NAME, STATUS
FROM USER_TRIGGERS
WHERE TRIGGER_NAME IN (
    'TRG_LOTE_ORIGEN_FIJO', 'TRG_MODELO_CLASIFICACION_FIJA',
    'TRG_SERVICIO_DEVOLUCION_UNIDAD', 'TRG_DEVOLUCION_DETALLE_FIJO',
    'TRG_DETALLE_VENTA_VINCULO_FIJO'
)
ORDER BY TRIGGER_NAME;
