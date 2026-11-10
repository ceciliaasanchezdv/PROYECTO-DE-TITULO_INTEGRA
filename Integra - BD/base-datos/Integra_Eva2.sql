--   sitio:      Oracle Database 21c

CREATE TABLE CATEGORIA 
    ( 
     id_categoria     NUMBER (10)  NOT NULL , 
     codigo_categoria VARCHAR2 (30 CHAR)  NOT NULL , 
     nombre           VARCHAR2 (80 CHAR)  NOT NULL 
    ) 
;

ALTER TABLE CATEGORIA 
    ADD CONSTRAINT CATEGORIA_PK PRIMARY KEY ( id_categoria ) ;

ALTER TABLE CATEGORIA 
    ADD CONSTRAINT CATEGORIA_codigo_categoria_UN UNIQUE ( codigo_categoria ) ;

CREATE TABLE CLIENTE 
    ( 
     id_cliente     NUMBER (10)  NOT NULL , 
     codigo_cliente VARCHAR2 (30)  NOT NULL , 
     nombre         VARCHAR2 (100 CHAR)  NOT NULL , 
     correo         VARCHAR2 (120 CHAR) , 
     telefono       VARCHAR2 (30 CHAR) 
    ) 
;

ALTER TABLE CLIENTE 
    ADD CONSTRAINT CLIENTE_PK PRIMARY KEY ( id_cliente ) ;

ALTER TABLE CLIENTE 
    ADD CONSTRAINT CLIENTE_codigo_cliente_UN UNIQUE ( codigo_cliente ) ;

CREATE TABLE COMPONENTE_UTILIZADO 
    ( 
     id_componente_utilizado      NUMBER (10)  NOT NULL , 
     nombre                       VARCHAR2 (120 CHAR)  NOT NULL , 
     cantidad                     NUMBER (5)  NOT NULL , 
     observacion                  VARCHAR2 (250 CHAR) , 
     SERVICIO_TECNICO_id_servicio NUMBER (10)  NOT NULL 
    ) 
;

ALTER TABLE COMPONENTE_UTILIZADO 
    ADD CONSTRAINT COMPONENTE_UTILIZADO_PK PRIMARY KEY ( id_componente_utilizado ) ;

CREATE TABLE DETALLE_VENTA 
    ( 
     id_detalle_venta NUMBER (10)  NOT NULL , 
     precio_venta     NUMBER (12)  NOT NULL , 
     VENTA_id_venta   NUMBER (10)  NOT NULL , 
     UNIDAD_id_unidad NUMBER (10)  NOT NULL 
    ) 
;

ALTER TABLE DETALLE_VENTA 
    ADD CONSTRAINT DETALLE_VENTA_PK PRIMARY KEY ( id_detalle_venta ) ;

CREATE TABLE DEVOLUCION 
    ( 
     id_devolucion                  NUMBER (10)  NOT NULL , 
     codigo_devolucion              VARCHAR2 (30)  NOT NULL , 
     fecha_devolucion               DATE  NOT NULL , 
     motivo                         VARCHAR2 (250 CHAR)  NOT NULL , 
     fecha_cierre                   DATE , 
     destino_final                  VARCHAR2 (20 CHAR) , 
     DETALLE_VENTA_id_detalle_venta NUMBER (10)  NOT NULL , 
     USUARIO_id_usuario             NUMBER (10)  NOT NULL 
    ) 
;

ALTER TABLE DEVOLUCION 
    ADD CONSTRAINT DEVOLUCION_PK PRIMARY KEY ( id_devolucion ) ;

ALTER TABLE DEVOLUCION 
    ADD CONSTRAINT DEVOLUCION_CODIGO_UK UNIQUE ( codigo_devolucion ) ;

CREATE TABLE LOTE 
    ( 
     id_lote                NUMBER (10)  NOT NULL , 
     codigo_lote            VARCHAR2 (30 CHAR)  NOT NULL , 
     fecha_recepcion        DATE  NOT NULL , 
     PROVEEDOR_id_proveedor NUMBER (10)  NOT NULL , 
     MODELO_id_modelo       NUMBER (10)  NOT NULL 
    ) 
;

ALTER TABLE LOTE 
    ADD CONSTRAINT LOTE_PK PRIMARY KEY ( id_lote ) ;

ALTER TABLE LOTE 
    ADD CONSTRAINT LOTE_codigo_lote_UN UNIQUE ( codigo_lote ) ;

CREATE TABLE MARCA 
    ( 
     id_marca     NUMBER (10)  NOT NULL , 
     codigo_marca VARCHAR2 (30 CHAR)  NOT NULL , 
     nombre       VARCHAR2 (80 CHAR)  NOT NULL 
    ) 
;

ALTER TABLE MARCA 
    ADD CONSTRAINT MARCA_PK PRIMARY KEY ( id_marca ) ;

ALTER TABLE MARCA 
    ADD CONSTRAINT MARCA_codigo_marca_UN UNIQUE ( codigo_marca ) ;

CREATE TABLE MODELO 
    ( 
     id_modelo              NUMBER (10)  NOT NULL , 
     codigo_modelo          VARCHAR2 (30 CHAR)  NOT NULL , 
     nombre                 VARCHAR2 (100 BYTE)  NOT NULL , 
     MARCA_id_marca         NUMBER (10)  NOT NULL , 
     CATEGORIA_id_categoria NUMBER (10)  NOT NULL 
    ) 
;

ALTER TABLE MODELO 
    ADD CONSTRAINT MODELO_PK PRIMARY KEY ( id_modelo ) ;

ALTER TABLE MODELO 
    ADD CONSTRAINT MODELO_codigo_modelo_UN UNIQUE ( codigo_modelo ) ;

CREATE TABLE PROVEEDOR 
    ( 
     id_proveedor     NUMBER (10)  NOT NULL , 
     codigo_proveedor VARCHAR2 (30 CHAR)  NOT NULL , 
     nombre           VARCHAR2 (100 CHAR)  NOT NULL , 
     correo           VARCHAR2 (120 CHAR) , 
     telefono         VARCHAR2 (30 CHAR) 
    ) 
;

ALTER TABLE PROVEEDOR 
    ADD CONSTRAINT PROVEEDOR_PK PRIMARY KEY ( id_proveedor ) ;

ALTER TABLE PROVEEDOR 
    ADD CONSTRAINT PROVEEDOR_codigo_proveedor_UN UNIQUE ( codigo_proveedor ) ;

CREATE TABLE SERVICIO_TECNICO 
    ( 
     id_servicio               NUMBER (10)  NOT NULL , 
     codigo_servicio           VARCHAR2 (30 CHAR)  NOT NULL , 
     fecha_ingreso             DATE  NOT NULL , 
     diagnostico               VARCHAR2 (500 CHAR) , 
     fecha_cierre              DATE , 
     resultado                 VARCHAR2 (250 CHAR) , 
     DEVOLUCION_id_devolucion  NUMBER (10)  NOT NULL , 
     SINTOMA_id_sintoma        NUMBER (10)  NOT NULL , 
     TIPO_INTERVENCION_id_tipo NUMBER (10) , 
     USUARIO_id_usuario        NUMBER (10)  NOT NULL 
    ) 
;

ALTER TABLE SERVICIO_TECNICO 
    ADD CONSTRAINT SERVICIO_TECNICO_PK PRIMARY KEY ( id_servicio ) ;

ALTER TABLE SERVICIO_TECNICO 
    ADD CONSTRAINT SERVICIO_TECNICO_CODIGO_UK UNIQUE ( codigo_servicio ) ;

CREATE TABLE SINTOMA 
    ( 
     id_sintoma     NUMBER (10)  NOT NULL , 
     codigo_sintoma VARCHAR2 (30 CHAR)  NOT NULL , 
     nombre         VARCHAR2 (100 CHAR)  NOT NULL , 
     descripcion    VARCHAR2 (250 CHAR)  NOT NULL 
    ) 
;

ALTER TABLE SINTOMA 
    ADD CONSTRAINT SINTOMA_PK PRIMARY KEY ( id_sintoma ) ;

ALTER TABLE SINTOMA 
    ADD CONSTRAINT SINTOMA_codigo_sintoma_UN UNIQUE ( codigo_sintoma ) ;

CREATE TABLE TIPO_INTERVENCION 
    ( 
     id_tipo_intervencion NUMBER (10)  NOT NULL , 
     codigo_tipo          VARCHAR2 (30 CHAR)  NOT NULL , 
     nombre               VARCHAR2 (100 CHAR)  NOT NULL , 
     descripcion          VARCHAR2 (250 CHAR) 
    ) 
;

ALTER TABLE TIPO_INTERVENCION 
    ADD CONSTRAINT TIPO_INTERVENCION_PK PRIMARY KEY ( id_tipo_intervencion ) ;

ALTER TABLE TIPO_INTERVENCION 
    ADD CONSTRAINT TIPO_INTERV_CODIGO_UK UNIQUE ( codigo_tipo ) ;

CREATE TABLE UNIDAD 
    ( 
     id_unidad      NUMBER (10)  NOT NULL , 
     codigo_interno VARCHAR2 (30 CHAR)  NOT NULL , 
     numero_serie   VARCHAR2 (80 CHAR) , 
     fecha_ingreso  DATE  NOT NULL , 
     estado_actual  VARCHAR2 (20 CHAR)  NOT NULL , 
     LOTE_id_lote   NUMBER (10)  NOT NULL 
    ) 
;

ALTER TABLE UNIDAD 
    ADD CONSTRAINT UNIDAD_PK PRIMARY KEY ( id_unidad ) ;

ALTER TABLE UNIDAD 
    ADD CONSTRAINT UNIDAD_codigo_interno_UN UNIQUE ( codigo_interno ) ;

CREATE TABLE USUARIO 
    ( 
     id_usuario NUMBER (10)  NOT NULL , 
     nombre     VARCHAR2 (100 CHAR)  NOT NULL , 
     correo     VARCHAR2 (120 CHAR)  NOT NULL , 
     clave_hash VARCHAR2 (255 CHAR)  NOT NULL , 
     perfil     VARCHAR2 (15 CHAR)  NOT NULL , 
     activo     NUMBER (1)  NOT NULL 
    ) 
;

ALTER TABLE USUARIO 
    ADD CONSTRAINT USUARIO_PK PRIMARY KEY ( id_usuario ) ;

ALTER TABLE USUARIO 
    ADD CONSTRAINT USUARIO_correo_UN UNIQUE ( correo ) ;

CREATE TABLE VENTA 
    ( 
     id_venta           NUMBER (10)  NOT NULL , 
     codigo_venta       VARCHAR2 (30)  NOT NULL , 
     fecha_venta        DATE  NOT NULL , 
     CLIENTE_id_cliente NUMBER (10)  NOT NULL , 
     USUARIO_id_usuario NUMBER (10)  NOT NULL 
    ) 
;

ALTER TABLE VENTA 
    ADD CONSTRAINT VENTA_PK PRIMARY KEY ( id_venta ) ;

ALTER TABLE VENTA 
    ADD CONSTRAINT VENTA_codigo_venta_UN UNIQUE ( codigo_venta ) ;

ALTER TABLE COMPONENTE_UTILIZADO 
    ADD CONSTRAINT COMP_UTIL_SERVICIO_FK FOREIGN KEY 
    ( 
     SERVICIO_TECNICO_id_servicio
    ) 
    REFERENCES SERVICIO_TECNICO 
    ( 
     id_servicio
    ) 
;

ALTER TABLE DETALLE_VENTA 
    ADD CONSTRAINT DETALLE_VENTA_UNIDAD_FK FOREIGN KEY 
    ( 
     UNIDAD_id_unidad
    ) 
    REFERENCES UNIDAD 
    ( 
     id_unidad
    ) 
;

ALTER TABLE DETALLE_VENTA 
    ADD CONSTRAINT DETALLE_VENTA_VENTA_FK FOREIGN KEY 
    ( 
     VENTA_id_venta
    ) 
    REFERENCES VENTA 
    ( 
     id_venta
    ) 
;

ALTER TABLE DEVOLUCION 
    ADD CONSTRAINT DEVOLUCION_DETALLE_VENTA_FK FOREIGN KEY 
    ( 
     DETALLE_VENTA_id_detalle_venta
    ) 
    REFERENCES DETALLE_VENTA 
    ( 
     id_detalle_venta
    ) 
;

ALTER TABLE DEVOLUCION 
    ADD CONSTRAINT DEVOLUCION_USUARIO_FK FOREIGN KEY 
    ( 
     USUARIO_id_usuario
    ) 
    REFERENCES USUARIO 
    ( 
     id_usuario
    ) 
;

ALTER TABLE LOTE 
    ADD CONSTRAINT LOTE_MODELO_FK FOREIGN KEY 
    ( 
     MODELO_id_modelo
    ) 
    REFERENCES MODELO 
    ( 
     id_modelo
    ) 
;

ALTER TABLE LOTE 
    ADD CONSTRAINT LOTE_PROVEEDOR_FK FOREIGN KEY 
    ( 
     PROVEEDOR_id_proveedor
    ) 
    REFERENCES PROVEEDOR 
    ( 
     id_proveedor
    ) 
;

ALTER TABLE MODELO 
    ADD CONSTRAINT MODELO_CATEGORIA_FK FOREIGN KEY 
    ( 
     CATEGORIA_id_categoria
    ) 
    REFERENCES CATEGORIA 
    ( 
     id_categoria
    ) 
;

ALTER TABLE MODELO 
    ADD CONSTRAINT MODELO_MARCA_FK FOREIGN KEY 
    ( 
     MARCA_id_marca
    ) 
    REFERENCES MARCA 
    ( 
     id_marca
    ) 
;

ALTER TABLE SERVICIO_TECNICO 
    ADD CONSTRAINT SERVICIO_TECNICO_DEVOLUCION_FK FOREIGN KEY 
    ( 
     DEVOLUCION_id_devolucion
    ) 
    REFERENCES DEVOLUCION 
    ( 
     id_devolucion
    ) 
;

ALTER TABLE SERVICIO_TECNICO 
    ADD CONSTRAINT SERVICIO_TECNICO_SINTOMA_FK FOREIGN KEY 
    ( 
     SINTOMA_id_sintoma
    ) 
    REFERENCES SINTOMA 
    ( 
     id_sintoma
    ) 
;

ALTER TABLE SERVICIO_TECNICO 
    ADD CONSTRAINT SERVICIO_TECNICO_USUARIO_FK FOREIGN KEY 
    ( 
     USUARIO_id_usuario
    ) 
    REFERENCES USUARIO 
    ( 
     id_usuario
    ) 
;

ALTER TABLE SERVICIO_TECNICO 
    ADD CONSTRAINT SERVICIO_TIPO_INTERV_FK FOREIGN KEY 
    ( 
     TIPO_INTERVENCION_id_tipo
    ) 
    REFERENCES TIPO_INTERVENCION 
    ( 
     id_tipo_intervencion
    ) 
;

ALTER TABLE UNIDAD 
    ADD CONSTRAINT UNIDAD_LOTE_FK FOREIGN KEY 
    ( 
     LOTE_id_lote
    ) 
    REFERENCES LOTE 
    ( 
     id_lote
    ) 
;

ALTER TABLE VENTA 
    ADD CONSTRAINT VENTA_CLIENTE_FK FOREIGN KEY 
    ( 
     CLIENTE_id_cliente
    ) 
    REFERENCES CLIENTE 
    ( 
     id_cliente
    ) 
;

ALTER TABLE VENTA 
    ADD CONSTRAINT VENTA_USUARIO_FK FOREIGN KEY 
    ( 
     USUARIO_id_usuario
    ) 
    REFERENCES USUARIO 
    ( 
     id_usuario
    ) 
;
