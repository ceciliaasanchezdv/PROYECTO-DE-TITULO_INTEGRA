-- permite registrar servicio tecnico con o sin devolucion previa.
-- conserva los servicios existentes: obtiene la unidad de su devolucion.

DECLARE
    v_existe NUMBER;
BEGIN
    IF SYS_CONTEXT('USERENV', 'SESSION_USER') <> 'INTEGRA' THEN
        RAISE_APPLICATION_ERROR(-20001, 'Conectarse como INTEGRA');
    END IF;

    SELECT COUNT(*) INTO v_existe
    FROM USER_TAB_COLUMNS
    WHERE TABLE_NAME = 'SERVICIO_TECNICO'
      AND COLUMN_NAME = 'UNIDAD_ID_UNIDAD';

    IF v_existe = 0 THEN
        EXECUTE IMMEDIATE
            'ALTER TABLE SERVICIO_TECNICO ADD (UNIDAD_id_unidad NUMBER(10))';
    END IF;
END;
/

UPDATE SERVICIO_TECNICO st
SET UNIDAD_id_unidad = (
    SELECT dv.UNIDAD_id_unidad
    FROM DEVOLUCION d
    JOIN DETALLE_VENTA dv
      ON dv.id_detalle_venta = d.DETALLE_VENTA_id_detalle_venta
    WHERE d.id_devolucion = st.DEVOLUCION_id_devolucion
)
WHERE st.UNIDAD_id_unidad IS NULL
  AND st.DEVOLUCION_id_devolucion IS NOT NULL;

COMMIT;

DECLARE
    v_sin_unidad NUMBER;
    v_fk        NUMBER;
    v_nullable  VARCHAR2(1);
BEGIN
    SELECT COUNT(*) INTO v_sin_unidad
    FROM SERVICIO_TECNICO
    WHERE UNIDAD_id_unidad IS NULL;

    IF v_sin_unidad > 0 THEN
        RAISE_APPLICATION_ERROR(-20003,
            'Hay servicios sin unidad; revisar antes de continuar');
    END IF;

    SELECT NULLABLE INTO v_nullable
    FROM USER_TAB_COLUMNS
    WHERE TABLE_NAME = 'SERVICIO_TECNICO'
      AND COLUMN_NAME = 'UNIDAD_ID_UNIDAD';

    IF v_nullable = 'Y' THEN
        EXECUTE IMMEDIATE
            'ALTER TABLE SERVICIO_TECNICO MODIFY (UNIDAD_id_unidad NOT NULL)';
    END IF;

    SELECT COUNT(*) INTO v_fk
    FROM USER_CONSTRAINTS
    WHERE CONSTRAINT_NAME = 'SERVICIO_UNIDAD_FK';

    IF v_fk = 0 THEN
        EXECUTE IMMEDIATE
            'ALTER TABLE SERVICIO_TECNICO ADD CONSTRAINT ' ||
            'SERVICIO_UNIDAD_FK FOREIGN KEY (UNIDAD_id_unidad) ' ||
            'REFERENCES UNIDAD (id_unidad)';
    END IF;

    SELECT NULLABLE INTO v_nullable
    FROM USER_TAB_COLUMNS
    WHERE TABLE_NAME = 'SERVICIO_TECNICO'
      AND COLUMN_NAME = 'DEVOLUCION_ID_DEVOLUCION';

    IF v_nullable = 'N' THEN
        EXECUTE IMMEDIATE
            'ALTER TABLE SERVICIO_TECNICO MODIFY (DEVOLUCION_id_devolucion NULL)';
    END IF;
END;
/

SELECT COLUMN_NAME, NULLABLE
FROM USER_TAB_COLUMNS
WHERE TABLE_NAME = 'SERVICIO_TECNICO'
  AND COLUMN_NAME IN ('UNIDAD_ID_UNIDAD', 'DEVOLUCION_ID_DEVOLUCION')
ORDER BY COLUMN_NAME;
