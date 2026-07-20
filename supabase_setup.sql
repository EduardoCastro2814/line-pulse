-- ==============================================================================
-- LINEPULSE MES - SCRIPT SQL COMPLETO PARA SUPABASE SQL EDITOR
-- Copiar y pegar este script completo directamente en Supabase SQL Editor y hacer clic en RUN.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 0. EXTENSIONES Y FUNCIONES DE TIMESTAMPS
-- ------------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Función Trigger para actualizar el campo updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 1. TABLA: AREAS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS areas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

COMMENT ON TABLE areas IS 'Catálogo de áreas principales de manufactura (SMT, Ensamble, Pruebas)';

-- ------------------------------------------------------------------------------
-- 2. TABLA: LINEAS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lineas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    area_id UUID REFERENCES areas(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    process VARCHAR(150),
    shift1_start TIME NOT NULL DEFAULT '06:00:00',
    shift1_target INTEGER NOT NULL DEFAULT 6,
    shift2_start TIME NOT NULL DEFAULT '14:00:00',
    shift2_target INTEGER NOT NULL DEFAULT 6,
    shift3_start TIME NOT NULL DEFAULT '22:00:00',
    shift3_target INTEGER NOT NULL DEFAULT 4,
    status VARCHAR(50) DEFAULT 'FALTA PERSONAL',
    layout_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

COMMENT ON TABLE lineas IS 'Líneas de producción con metas de plantilla por turno y plano de layout';

-- ------------------------------------------------------------------------------
-- 3. TABLA: EMPLEADOS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS empleados (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    badge_id VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(150) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

COMMENT ON TABLE empleados IS 'Catálogo de personal u operadores con número de gafete único';

-- ------------------------------------------------------------------------------
-- 4. TABLA: EMPLEADOS_LINEA (Plantilla Asignada)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS empleados_linea (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID REFERENCES empleados(id) ON DELETE CASCADE NOT NULL,
    line_id UUID REFERENCES lineas(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    UNIQUE(employee_id, line_id)
);

COMMENT ON TABLE empleados_linea IS 'Asignaciones de empleados a líneas de producción';

-- ------------------------------------------------------------------------------
-- 5. TABLA: LINE_POSITIONS (Y POSICIONES)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS line_positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    line_id UUID REFERENCES lineas(id) ON DELETE CASCADE NOT NULL,
    code VARCHAR(50) NOT NULL,
    station_name VARCHAR(100) NOT NULL,
    employee_id UUID REFERENCES empleados(id) ON DELETE SET NULL,
    x_percent NUMERIC(5,2) NOT NULL DEFAULT 50.0,
    y_percent NUMERIC(5,2) NOT NULL DEFAULT 50.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

COMMENT ON TABLE line_positions IS 'Estaciones de trabajo y coordenadas X,Y sobre el layout de la línea';

-- Tabla alias posiciones para compatibilidad
CREATE TABLE IF NOT EXISTS posiciones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    line_id UUID REFERENCES lineas(id) ON DELETE CASCADE NOT NULL,
    code VARCHAR(50) NOT NULL,
    station_name VARCHAR(100) NOT NULL,
    employee_id UUID REFERENCES empleados(id) ON DELETE SET NULL,
    x_percent NUMERIC(5,2) NOT NULL DEFAULT 50.0,
    y_percent NUMERIC(5,2) NOT NULL DEFAULT 50.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- ------------------------------------------------------------------------------
-- 6. TABLA: LINE_LAYOUTS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS line_layouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    line_id UUID REFERENCES lineas(id) ON DELETE CASCADE NOT NULL,
    image_url TEXT NOT NULL,
    description VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

COMMENT ON TABLE line_layouts IS 'Historial e imágenes de blueprint asociadas a cada línea';

-- ------------------------------------------------------------------------------
-- 7. TABLA: COBERTURAS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS coberturas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    line_id UUID REFERENCES lineas(id) ON DELETE CASCADE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    required_operators INTEGER NOT NULL DEFAULT 3,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

COMMENT ON TABLE coberturas IS 'Reglas de ventanas de alivio y cobertura para comedor';

-- ------------------------------------------------------------------------------
-- 8. TABLA: ESCANEOS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS escaneos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    badge_id VARCHAR(50) NOT NULL,
    employee_name VARCHAR(150) NOT NULL,
    line_id UUID REFERENCES lineas(id) ON DELETE CASCADE,
    event_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    event_type VARCHAR(50) NOT NULL, -- 'shift_start', 'lunch_start', 'lunch_return', 'shift_end'
    was_successful BOOLEAN DEFAULT TRUE NOT NULL,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

COMMENT ON TABLE escaneos IS 'Registros de escaneo de gafete y eventos de presencia/comedor';

-- ------------------------------------------------------------------------------
-- 9. TABLA: TIEMPOS_MUERTOS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tiempos_muertos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    line_id UUID REFERENCES lineas(id) ON DELETE CASCADE NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE,
    duration_minutes INTEGER DEFAULT 0,
    cause TEXT,
    resolved BOOLEAN DEFAULT FALSE NOT NULL,
    date DATE DEFAULT CURRENT_DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

COMMENT ON TABLE tiempos_muertos IS 'Registros de paros no planificados y tiempo muerto acumulado';

-- ==============================================================================
-- TRIGGERS PARA ACTUALIZACIÓN AUTOMÁTICA DE TIMESTAMP updated_at
-- ==============================================================================
DROP TRIGGER IF EXISTS update_areas_updated_at ON areas;
CREATE TRIGGER update_areas_updated_at BEFORE UPDATE ON areas FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_lineas_updated_at ON lineas;
CREATE TRIGGER update_lineas_updated_at BEFORE UPDATE ON lineas FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_empleados_updated_at ON empleados;
CREATE TRIGGER update_empleados_updated_at BEFORE UPDATE ON empleados FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_empleados_linea_updated_at ON empleados_linea;
CREATE TRIGGER update_empleados_linea_updated_at BEFORE UPDATE ON empleados_linea FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_line_positions_updated_at ON line_positions;
CREATE TRIGGER update_line_positions_updated_at BEFORE UPDATE ON line_positions FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_posiciones_updated_at ON posiciones;
CREATE TRIGGER update_posiciones_updated_at BEFORE UPDATE ON posiciones FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_line_layouts_updated_at ON line_layouts;
CREATE TRIGGER update_line_layouts_updated_at BEFORE UPDATE ON line_layouts FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_coberturas_updated_at ON coberturas;
CREATE TRIGGER update_coberturas_updated_at BEFORE UPDATE ON coberturas FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_escaneos_updated_at ON escaneos;
CREATE TRIGGER update_escaneos_updated_at BEFORE UPDATE ON escaneos FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_tiempos_muertos_updated_at ON tiempos_muertos;
CREATE TRIGGER update_tiempos_muertos_updated_at BEFORE UPDATE ON tiempos_muertos FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- ==============================================================================
-- CREACIÓN DE ÍNDICES DE RENDIMIENTO
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_lineas_area ON lineas(area_id);
CREATE INDEX IF NOT EXISTS idx_line_positions_line ON line_positions(line_id);
CREATE INDEX IF NOT EXISTS idx_posiciones_line ON posiciones(line_id);
CREATE INDEX IF NOT EXISTS idx_coberturas_line ON coberturas(line_id);
CREATE INDEX IF NOT EXISTS idx_escaneos_line ON escaneos(line_id);
CREATE INDEX IF NOT EXISTS idx_escaneos_badge ON escaneos(badge_id);
CREATE INDEX IF NOT EXISTS idx_escaneos_time ON escaneos(event_time);
CREATE INDEX IF NOT EXISTS idx_tiempos_muertos_line ON tiempos_muertos(line_id);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) & POLÍTICAS PÚBLICAS
-- ==============================================================================
ALTER TABLE areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE lineas ENABLE ROW LEVEL SECURITY;
ALTER TABLE empleados ENABLE ROW LEVEL SECURITY;
ALTER TABLE empleados_linea ENABLE ROW LEVEL SECURITY;
ALTER TABLE line_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE posiciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE line_layouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE coberturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE escaneos ENABLE ROW LEVEL SECURITY;
ALTER TABLE tiempos_muertos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public access areas" ON areas;
CREATE POLICY "Public access areas" ON areas FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access lineas" ON lineas;
CREATE POLICY "Public access lineas" ON lineas FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access empleados" ON empleados;
CREATE POLICY "Public access empleados" ON empleados FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access empleados_linea" ON empleados_linea;
CREATE POLICY "Public access empleados_linea" ON empleados_linea FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access line_positions" ON line_positions;
CREATE POLICY "Public access line_positions" ON line_positions FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access posiciones" ON posiciones;
CREATE POLICY "Public access posiciones" ON posiciones FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access line_layouts" ON line_layouts;
CREATE POLICY "Public access line_layouts" ON line_layouts FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access coberturas" ON coberturas;
CREATE POLICY "Public access coberturas" ON coberturas FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access escaneos" ON escaneos;
CREATE POLICY "Public access escaneos" ON escaneos FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access tiempos_muertos" ON tiempos_muertos;
CREATE POLICY "Public access tiempos_muertos" ON tiempos_muertos FOR ALL USING (true) WITH CHECK (true);

-- ==============================================================================
-- HABILITACIÓN DE SUPABASE REALTIME
-- ==============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE areas;
        ALTER PUBLICATION supabase_realtime ADD TABLE lineas;
        ALTER PUBLICATION supabase_realtime ADD TABLE empleados;
        ALTER PUBLICATION supabase_realtime ADD TABLE line_positions;
        ALTER PUBLICATION supabase_realtime ADD TABLE posiciones;
        ALTER PUBLICATION supabase_realtime ADD TABLE line_layouts;
        ALTER PUBLICATION supabase_realtime ADD TABLE coberturas;
        ALTER PUBLICATION supabase_realtime ADD TABLE escaneos;
        ALTER PUBLICATION supabase_realtime ADD TABLE tiempos_muertos;
    END IF;
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- ==============================================================================
-- CREACIÓN DE STORAGE BUCKET: line-layouts
-- ==============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('line-layouts', 'line-layouts', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Public Read line-layouts" ON storage.objects;
CREATE POLICY "Public Read line-layouts" ON storage.objects
FOR SELECT USING (bucket_id = 'line-layouts');

DROP POLICY IF EXISTS "Public Upload line-layouts" ON storage.objects;
CREATE POLICY "Public Upload line-layouts" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'line-layouts');

DROP POLICY IF EXISTS "Public Update line-layouts" ON storage.objects;
CREATE POLICY "Public Update line-layouts" ON storage.objects
FOR UPDATE USING (bucket_id = 'line-layouts');

DROP POLICY IF EXISTS "Public Delete line-layouts" ON storage.objects;
CREATE POLICY "Public Delete line-layouts" ON storage.objects
FOR DELETE USING (bucket_id = 'line-layouts');

-- ==============================================================================
-- DATOS DE PRUEBA INICIALES (SEEDS)
-- ==============================================================================
INSERT INTO areas (id, name, description) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'SMT', 'Surface Mount Technology Line'),
  ('a0000000-0000-0000-0000-000000000002', 'Ensamble', 'Assembly and Packaging Line'),
  ('a0000000-0000-0000-0000-000000000003', 'Pruebas', 'Functional & ICT Testing Line')
ON CONFLICT (name) DO NOTHING;

INSERT INTO lineas (id, area_id, name, process, shift1_start, shift1_target, shift2_start, shift2_target, shift3_start, shift3_target, status) VALUES
  ('l0000000-0000-0000-0000-000000000014', 'a0000000-0000-0000-0000-000000000001', 'Línea 14', 'SIPLACE Assembly SMT', '06:00:00', 6, '14:00:00', 6, '22:00:00', 4, 'FALTA PERSONAL'),
  ('l0000000-0000-0000-0000-000000000015', 'a0000000-0000-0000-0000-000000000001', 'Línea 15', 'AOI & Solder Reflow', '06:00:00', 5, '14:00:00', 5, '22:00:00', 3, 'COMPLETO'),
  ('l0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'Línea 01', 'THT & Manual Solder', '06:00:00', 8, '14:00:00', 8, '22:00:00', 6, 'FALTA PERSONAL')
ON CONFLICT DO NOTHING;

INSERT INTO empleados (id, badge_id, name) VALUES
  ('e0000000-0000-0000-0000-000000000001', '100234', 'Juan Pérez'),
  ('e0000000-0000-0000-0000-000000000002', '100112', 'María López'),
  ('e0000000-0000-0000-0000-000000000003', '100876', 'Carlos Ruiz'),
  ('e0000000-0000-0000-0000-000000000004', '100999', 'Ana García'),
  ('e0000000-0000-0000-0000-000000000005', '100777', 'Miguel Torres'),
  ('e0000000-0000-0000-0000-000000000006', '100555', 'Patricia Rivas')
ON CONFLICT (badge_id) DO NOTHING;

INSERT INTO line_positions (line_id, code, station_name, employee_id, x_percent, y_percent) VALUES
  ('l0000000-0000-0000-0000-000000000014', 'POS01', 'Stencil Printer', 'e0000000-0000-0000-0000-000000000001', 11.0, 50.0),
  ('l0000000-0000-0000-0000-000000000014', 'POS02', 'SIPLACE 01', 'e0000000-0000-0000-0000-000000000002', 26.0, 50.0),
  ('l0000000-0000-0000-0000-000000000014', 'POS03', 'SIPLACE 02', 'e0000000-0000-0000-0000-000000000003', 42.0, 50.0),
  ('l0000000-0000-0000-0000-000000000014', 'POS04', 'Horno Reflow', 'e0000000-0000-0000-0000-000000000004', 63.0, 50.0),
  ('l0000000-0000-0000-0000-000000000014', 'POS05', 'Inspección AOI', 'e0000000-0000-0000-0000-000000000005', 80.0, 50.0),
  ('l0000000-0000-0000-0000-000000000014', 'POS06', 'Empaque', 'e0000000-0000-0000-0000-000000000006', 91.0, 50.0)
ON CONFLICT DO NOTHING;

INSERT INTO posiciones (line_id, code, station_name, employee_id, x_percent, y_percent) VALUES
  ('l0000000-0000-0000-0000-000000000014', 'POS01', 'Stencil Printer', 'e0000000-0000-0000-0000-000000000001', 11.0, 50.0),
  ('l0000000-0000-0000-0000-000000000014', 'POS02', 'SIPLACE 01', 'e0000000-0000-0000-0000-000000000002', 26.0, 50.0),
  ('l0000000-0000-0000-0000-000000000014', 'POS03', 'SIPLACE 02', 'e0000000-0000-0000-0000-000000000003', 42.0, 50.0),
  ('l0000000-0000-0000-0000-000000000014', 'POS04', 'Horno Reflow', 'e0000000-0000-0000-0000-000000000004', 63.0, 50.0),
  ('l0000000-0000-0000-0000-000000000014', 'POS05', 'Inspección AOI', 'e0000000-0000-0000-0000-000000000005', 80.0, 50.0),
  ('l0000000-0000-0000-0000-000000000014', 'POS06', 'Empaque', 'e0000000-0000-0000-0000-000000000006', 91.0, 50.0)
ON CONFLICT DO NOTHING;

INSERT INTO coberturas (line_id, start_time, end_time, required_operators) VALUES
  ('l0000000-0000-0000-0000-000000000014', '12:00:00', '12:30:00', 3)
ON CONFLICT DO NOTHING;
