-- ==============================================================================
-- LINEPULSE MES - MIGRACIÓN PARA ENCENDIDO Y APAGADO DE LÍNEA
-- Ejecutar en el SQL Editor de Supabase
-- ==============================================================================

-- 1. AGREGAR COLUMNA DE ESTADO OPERATIVO A TABLA LINEAS
ALTER TABLE lineas 
ADD COLUMN IF NOT EXISTS operating_status VARCHAR(50) DEFAULT 'Encendida' NOT NULL;

-- Agregar comentario descriptivo
COMMENT ON COLUMN lineas.operating_status IS 'Estado operativo de la línea (Encendida o Apagada)';

-- 2. CREAR TABLA DE HISTORIAL DE ESTADOS DE LÍNEA
CREATE TABLE IF NOT EXISTS historial_estados_linea (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    line_id UUID REFERENCES lineas(id) ON DELETE CASCADE NOT NULL,
    fecha DATE DEFAULT CURRENT_DATE NOT NULL,
    hora TIME DEFAULT CURRENT_TIME NOT NULL,
    numero_empleado VARCHAR(50) NOT NULL,
    estado_anterior VARCHAR(50) NOT NULL,
    estado_nuevo VARCHAR(50) NOT NULL,
    motivo VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

COMMENT ON TABLE historial_estados_linea IS 'Historial de cambios de estado operativo (encendido/apagado) de las líneas';

-- 3. INDICES DE RENDIMIENTO Y OPTIMIZACIÓN
CREATE INDEX IF NOT EXISTS idx_historial_estados_linea_line ON historial_estados_linea(line_id);
CREATE INDEX IF NOT EXISTS idx_historial_estados_linea_fecha ON historial_estados_linea(fecha);

-- 4. HABILITAR RLS (ROW LEVEL SECURITY) Y CREAR POLÍTICA PÚBLICA
ALTER TABLE historial_estados_linea ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public access historial_estados_linea" ON historial_estados_linea;
CREATE POLICY "Public access historial_estados_linea" ON historial_estados_linea FOR ALL USING (true) WITH CHECK (true);
