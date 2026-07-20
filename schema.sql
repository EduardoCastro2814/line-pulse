-- ==============================================================================
-- LINEPULSE MES - SCRIPT SQL MAESTRO COMPLETO PARA SUPABASE
-- Copiar y pegar este script en el Supabase SQL Editor (SQL Editor -> New Query -> Run)
-- ==============================================================================

-- 0. EXTENSIONES Y FUNCIONES AUXILIARES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 1. TABLA: AREAS
CREATE TABLE IF NOT EXISTS areas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 2. TABLA: LINEAS
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

-- 3. TABLA: EMPLEADOS
CREATE TABLE IF NOT EXISTS empleados (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    badge_id VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(150) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 4. TABLA: EMPLEADOS_LINEA
CREATE TABLE IF NOT EXISTS empleados_linea (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID REFERENCES empleados(id) ON DELETE CASCADE NOT NULL,
    line_id UUID REFERENCES lineas(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    UNIQUE(employee_id, line_id)
);

-- 5. TABLA: LINE_POSITIONS (Y POSICIONES)
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

-- 6. TABLA: LINE_LAYOUTS
CREATE TABLE IF NOT EXISTS line_layouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    line_id UUID REFERENCES lineas(id) ON DELETE CASCADE NOT NULL,
    image_url TEXT NOT NULL,
    description VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 7. TABLA: COBERTURAS
CREATE TABLE IF NOT EXISTS coberturas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    line_id UUID REFERENCES lineas(id) ON DELETE CASCADE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    required_operators INTEGER NOT NULL DEFAULT 3,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 8. TABLA: ESCANEOS
CREATE TABLE IF NOT EXISTS escaneos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    badge_id VARCHAR(50) NOT NULL,
    employee_name VARCHAR(150) NOT NULL,
    line_id UUID REFERENCES lineas(id) ON DELETE CASCADE,
    event_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    was_successful BOOLEAN DEFAULT TRUE NOT NULL,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 9. TABLA: TIEMPOS_MUERTOS
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

-- TRIGGERS DE UPDATED_AT
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

-- INDICES
CREATE INDEX IF NOT EXISTS idx_lineas_area ON lineas(area_id);
CREATE INDEX IF NOT EXISTS idx_line_positions_line ON line_positions(line_id);
CREATE INDEX IF NOT EXISTS idx_posiciones_line ON posiciones(line_id);
CREATE INDEX IF NOT EXISTS idx_coberturas_line ON coberturas(line_id);
CREATE INDEX IF NOT EXISTS idx_escaneos_line ON escaneos(line_id);
CREATE INDEX IF NOT EXISTS idx_escaneos_badge ON escaneos(badge_id);
CREATE INDEX IF NOT EXISTS idx_escaneos_time ON escaneos(event_time);
CREATE INDEX IF NOT EXISTS idx_tiempos_muertos_line ON tiempos_muertos(line_id);

-- RLS POLICIES
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

CREATE POLICY "Public access areas" ON areas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access lineas" ON lineas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access empleados" ON empleados FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access empleados_linea" ON empleados_linea FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access line_positions" ON line_positions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access posiciones" ON posiciones FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access line_layouts" ON line_layouts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access coberturas" ON coberturas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access escaneos" ON escaneos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access tiempos_muertos" ON tiempos_muertos FOR ALL USING (true) WITH CHECK (true);

-- STORAGE BUCKET
INSERT INTO storage.buckets (id, name, public)
VALUES ('line-layouts', 'line-layouts', true)
ON CONFLICT (id) DO UPDATE SET public = true;

CREATE POLICY "Public Read line-layouts" ON storage.objects FOR SELECT USING (bucket_id = 'line-layouts');
CREATE POLICY "Public Upload line-layouts" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'line-layouts');
CREATE POLICY "Public Update line-layouts" ON storage.objects FOR UPDATE USING (bucket_id = 'line-layouts');
CREATE POLICY "Public Delete line-layouts" ON storage.objects FOR DELETE USING (bucket_id = 'line-layouts');
