-- ==============================================================================
-- LINEPULSE MES - SQL MIGRACIÓN COMPLETO DE ENCENDIDO/APAGADO DE LÍNEA
-- Ejecutar en el SQL Editor de Supabase
-- ==============================================================================

-- 1. AGREGAR COLUMNA DE ESTADO OPERATIVO A TABLA LINEAS (SI NO EXISTE)
ALTER TABLE lineas 
ADD COLUMN IF NOT EXISTS operating_status VARCHAR(50) DEFAULT 'Encendida' NOT NULL;

COMMENT ON COLUMN lineas.operating_status IS 'Estado operativo de la línea (Encendida o Apagada)';

-- 2. CREAR O ACTUALIZAR TABLA DE HISTORIAL DE ESTADOS DE LÍNEA
-- Nota: Para máxima compatibilidad con cualquier versión del frontend,
-- este script soporta tanto "line_id" como "linea_id", y añade "nombre_linea".

CREATE TABLE IF NOT EXISTS historial_estados_linea (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    linea_id UUID REFERENCES lineas(id) ON DELETE CASCADE,
    line_id UUID REFERENCES lineas(id) ON DELETE CASCADE,
    nombre_linea VARCHAR(150),
    fecha DATE DEFAULT CURRENT_DATE NOT NULL,
    hora TIME DEFAULT CURRENT_TIME NOT NULL,
    numero_empleado VARCHAR(50) NOT NULL,
    estado_anterior VARCHAR(50) NOT NULL,
    estado_nuevo VARCHAR(50) NOT NULL,
    motivo VARCHAR(150) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 3. ACTUALIZAR COLUMNAS EN TABLA EXISTENTE (En caso de que la tabla ya exista pero le falten columnas)
ALTER TABLE historial_estados_linea ADD COLUMN IF NOT EXISTS linea_id UUID REFERENCES lineas(id) ON DELETE CASCADE;
ALTER TABLE historial_estados_linea ADD COLUMN IF NOT EXISTS line_id UUID REFERENCES lineas(id) ON DELETE CASCADE;
ALTER TABLE historial_estados_linea ADD COLUMN IF NOT EXISTS nombre_linea VARCHAR(150);
ALTER TABLE historial_estados_linea ADD COLUMN IF NOT EXISTS fecha DATE DEFAULT CURRENT_DATE;
ALTER TABLE historial_estados_linea ADD COLUMN IF NOT EXISTS hora TIME DEFAULT CURRENT_TIME;
ALTER TABLE historial_estados_linea ADD COLUMN IF NOT EXISTS numero_empleado VARCHAR(50);
ALTER TABLE historial_estados_linea ADD COLUMN IF NOT EXISTS estado_anterior VARCHAR(50);
ALTER TABLE historial_estados_linea ADD COLUMN IF NOT EXISTS estado_nuevo VARCHAR(50);
ALTER TABLE historial_estados_linea ADD COLUMN IF NOT EXISTS motivo VARCHAR(150);
ALTER TABLE historial_estados_linea ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

COMMENT ON TABLE historial_estados_linea IS 'Historial de cambios de estado operativo (encendido/apagado) de las líneas';

-- 4. INDICES DE RENDIMIENTO Y OPTIMIZACIÓN
CREATE INDEX IF NOT EXISTS idx_historial_estados_linea_linea ON historial_estados_linea(linea_id);
CREATE INDEX IF NOT EXISTS idx_historial_estados_linea_line ON historial_estados_linea(line_id);
CREATE INDEX IF NOT EXISTS idx_historial_estados_linea_fecha ON historial_estados_linea(fecha);

-- 5. HABILITAR RLS (ROW LEVEL SECURITY) Y CREAR POLÍTICA PÚBLICA DE ACCESO
ALTER TABLE historial_estados_linea ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public access historial_estados_linea" ON historial_estados_linea;
CREATE POLICY "Public access historial_estados_linea" ON historial_estados_linea FOR ALL USING (true) WITH CHECK (true);
