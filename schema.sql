-- LinePulse Database Schema v2
-- For use in Supabase PostgreSQL Editor

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. AREAS
CREATE TABLE IF NOT EXISTS areas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. LINEAS
CREATE TABLE IF NOT EXISTS lineas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. EMPLEADOS
CREATE TABLE IF NOT EXISTS empleados (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    badge_id VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(150) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. EMPLEADOS_LINEA
CREATE TABLE IF NOT EXISTS empleados_linea (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID REFERENCES empleados(id) ON DELETE CASCADE NOT NULL,
    line_id UUID REFERENCES lineas(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(employee_id, line_id)
);

-- 5. LINE_POSITIONS / POSICIONES
CREATE TABLE IF NOT EXISTS line_positions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    line_id UUID REFERENCES lineas(id) ON DELETE CASCADE NOT NULL,
    code VARCHAR(50) NOT NULL,
    station_name VARCHAR(100) NOT NULL,
    employee_id UUID REFERENCES empleados(id) ON DELETE SET NULL,
    x_percent NUMERIC(5,2) NOT NULL DEFAULT 50.0,
    y_percent NUMERIC(5,2) NOT NULL DEFAULT 50.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS posiciones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    line_id UUID REFERENCES lineas(id) ON DELETE CASCADE NOT NULL,
    code VARCHAR(50) NOT NULL,
    station_name VARCHAR(100) NOT NULL,
    employee_id UUID REFERENCES empleados(id) ON DELETE SET NULL,
    x_percent NUMERIC(5,2) NOT NULL DEFAULT 50.0,
    y_percent NUMERIC(5,2) NOT NULL DEFAULT 50.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. LINE_LAYOUTS
CREATE TABLE IF NOT EXISTS line_layouts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    line_id UUID REFERENCES lineas(id) ON DELETE CASCADE NOT NULL,
    image_url TEXT NOT NULL,
    description VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. COBERTURAS
CREATE TABLE IF NOT EXISTS coberturas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    line_id UUID REFERENCES lineas(id) ON DELETE CASCADE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    required_operators INTEGER NOT NULL DEFAULT 3,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. ESCANEOS
CREATE TABLE IF NOT EXISTS escaneos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    badge_id VARCHAR(50) NOT NULL,
    employee_name VARCHAR(150) NOT NULL,
    line_id UUID REFERENCES lineas(id) ON DELETE CASCADE,
    event_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    event_type VARCHAR(50) NOT NULL,
    was_successful BOOLEAN DEFAULT TRUE,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. TIEMPOS_MUERTOS
CREATE TABLE IF NOT EXISTS tiempos_muertos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    line_id UUID REFERENCES lineas(id) ON DELETE CASCADE NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMP WITH TIME ZONE,
    duration_minutes INTEGER DEFAULT 0,
    cause TEXT,
    resolved BOOLEAN DEFAULT FALSE,
    date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- INDEXES
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
