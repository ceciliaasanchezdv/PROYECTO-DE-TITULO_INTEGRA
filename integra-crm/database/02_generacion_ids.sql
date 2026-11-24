-- Conserva los registros existentes y empieza cada secuencia despues del mayor ID.

DECLARE
    v_inicio NUMBER;
    v_existe NUMBER;
    v_total  NUMBER;
    v_seq    VARCHAR2(30);
BEGIN
    IF SYS_CONTEXT('USERENV', 'SESSION_USER') <> 'INTEGRA' THEN
        RAISE_APPLICATION_ERROR(-20001, 'Conectarse como INTEGRA');
    END IF;

    SELECT COUNT(*) INTO v_total
    FROM USER_CONSTRAINTS
    WHERE CONSTRAINT_TYPE = 'P'
      AND TABLE_NAME IN (
        'CATEGORIA', 'CLIENTE', 'COMPONENTE_UTILIZADO',
        'DETALLE_VENTA', 'DEVOLUCION', 'LOTE', 'MARCA',
        'MODELO', 'PROVEEDOR', 'SERVICIO_TECNICO',
        'SINTOMA', 'TIPO_INTERVENCION', 'UNIDAD',
        'USUARIO', 'VENTA'
      );

    IF v_total <> 15 THEN
        RAISE_APPLICATION_ERROR(-20002, 'No se encontraron las 15 tablas esperadas');
    END IF;

    FOR r IN (
        SELECT c.TABLE_NAME, cc.COLUMN_NAME
        FROM USER_CONSTRAINTS c
        JOIN USER_CONS_COLUMNS cc
          ON cc.CONSTRAINT_NAME = c.CONSTRAINT_NAME
         AND cc.TABLE_NAME = c.TABLE_NAME
        WHERE c.CONSTRAINT_TYPE = 'P'
          AND c.TABLE_NAME IN (
            'CATEGORIA', 'CLIENTE', 'COMPONENTE_UTILIZADO',
            'DETALLE_VENTA', 'DEVOLUCION', 'LOTE', 'MARCA',
            'MODELO', 'PROVEEDOR', 'SERVICIO_TECNICO',
            'SINTOMA', 'TIPO_INTERVENCION', 'UNIDAD',
            'USUARIO', 'VENTA'
          )
    ) LOOP
        v_seq := 'SEQ_' || r.TABLE_NAME;

        SELECT COUNT(*) INTO v_existe
        FROM USER_SEQUENCES
        WHERE SEQUENCE_NAME = v_seq;

        IF v_existe = 0 THEN
            EXECUTE IMMEDIATE
                'SELECT NVL(MAX(' || r.COLUMN_NAME || '), 0) + 1 FROM ' ||
                r.TABLE_NAME
                INTO v_inicio;

            EXECUTE IMMEDIATE
                'CREATE SEQUENCE ' || v_seq ||
                ' START WITH ' || v_inicio ||
                ' INCREMENT BY 1 NOCYCLE';
        END IF;

        EXECUTE IMMEDIATE
            'ALTER TABLE ' || r.TABLE_NAME ||
            ' MODIFY (' || r.COLUMN_NAME ||
            ' DEFAULT ' || v_seq || '.NEXTVAL)';
    END LOOP;
END;
/

-- Verificacion esperada: 15 secuencias y 15 ID con valor automatico.
SELECT
  (SELECT COUNT(*) FROM USER_SEQUENCES
   WHERE SEQUENCE_NAME LIKE 'SEQ_%') AS secuencias,
  (SELECT COUNT(*) FROM USER_TAB_COLUMNS
   WHERE SUBSTR(COLUMN_NAME, 1, 3) = 'ID_'
     AND DEFAULT_LENGTH > 0) AS id_con_valor_automatico
FROM DUAL;
