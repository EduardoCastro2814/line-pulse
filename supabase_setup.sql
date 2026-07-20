-- ==============================================================================
-- LINEPULSE MES - SUPABASE DATABASE SETUP SCRIPT
-- Pegar este script completo en el Supabase SQL Editor para crear las tablas,
-- índices, políticas de seguridad RLS y datos iniciales de prueba (seeds).
-- ==============================================================================

-- Habilitar extensión UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------------------------
-- 1. TABLA: AREAS (Áreas de Producción)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS areas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------------------------
-- 2. TABLA: LINEAS (Líneas de Producción)
-- ------------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------------
-- 3. TABLA: EMPLEADOS (Catálogo de Personal)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS empleados (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    badge_id VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(150) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------------------------
-- 4. TABLA: EMPLEADOS_LINEA (Plantilla Asignada por Línea)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS empleados_linea (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID REFERENCES empleados(id) ON DELETE CASCADE NOT NULL,
    line_id UUID REFERENCES lineas(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(employee_id, line_id)
);

-- ------------------------------------------------------------------------------
-- 5. TABLA: LINE_POSITIONS (Posiciones / Estaciones de Trabajo)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS line_positions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    line_id UUID REFERENCES lineas(id) ON DELETE CASCADE NOT NULL,
    code VARCHAR(50) NOT NULL,           -- Ej. POS01
    station_name VARCHAR(100) NOT NULL, -- Ej. Stencil Printer
    employee_id UUID REFERENCES empleados(id) ON DELETE SET NULL,
    x_percent NUMERIC(5,2) NOT NULL DEFAULT 50.0,
    y_percent NUMERIC(5,2) NOT NULL DEFAULT 50.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Alias/Tabla POSICIONES (Garantiza compatibilidad total)
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

-- ------------------------------------------------------------------------------
-- 6. TABLA: LINE_LAYOUTS (Planos de Layout por Línea)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS line_layouts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    line_id UUID REFERENCES lineas(id) ON DELETE CASCADE NOT NULL,
    image_url TEXT NOT NULL,
    description VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------------------------
-- 7. TABLA: COBERTURAS (Reglas de Alivio de Comedor)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS coberturas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    line_id UUID REFERENCES lineas(id) ON DELETE CASCADE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    required_operators INTEGER NOT NULL DEFAULT 3,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------------------------
-- 8. TABLA: ESCANEOS (Registros de Gafete y Asistencia)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS escaneos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    badge_id VARCHAR(50) NOT NULL,
    employee_name VARCHAR(150) NOT NULL,
    line_id UUID REFERENCES lineas(id) ON DELETE CASCADE,
    event_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    event_type VARCHAR(50) NOT NULL, -- 'shift_start', 'lunch_start', 'lunch_return', 'shift_end'
    was_successful BOOLEAN DEFAULT TRUE,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------------------------
-- 9. TABLA: TIEMPOS_MUERTOS (Registros de Downtime)
-- ------------------------------------------------------------------------------
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
-- CONFIGURACIÓN DE POLÍTICAS DE SEGURIDAD (RLS) - PERMISOS PÚBLICOS DE LECTURA/ESCRITURA
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

-- Políticas de acceso completo para cliente anon de Supabase
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

-- ==============================================================================
-- POBLADO DE DATOS INICIALES (SEED DATA)
-- ==============================================================================

-- Insertar Áreas
INSERT INTO areas (id, name, description) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'SMT', 'Surface Mount Technology Line'),
  ('a0000000-0000-0000-0000-000000000002', 'Ensamble', 'Assembly and Packaging Line'),
  ('a0000000-0000-0000-0000-000000000003', 'Pruebas', 'Functional & ICT Testing Line')
ON CONFLICT (name) DO NOTHING;

-- Insertar Línea 14 SMT
INSERT INTO lineas (id, area_id, name, process, shift1_start, shift1_target, shift2_start, shift2_target, shift3_start, shift3_target, status) VALUES
  ('l0000000-0000-0000-0000-000000000014', 'a0000000-0000-0000-0000-000000000001', 'Línea 14', 'SIPLACE Assembly SMT', '06:00:00', 6, '14:00:00', 6, '22:00:00', 4, 'FALTA PERSONAL'),
  ('l0000000-0000-0000-0000-000000000015', 'a0000000-0000-0000-0000-000000000001', 'Línea 15', 'AOI & Solder Reflow', '06:00:00', 5, '14:00:00', 5, '22:00:00', 3, 'COMPLETO'),
  ('l0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'Línea 01', 'THT & Manual Solder', '06:00:00', 8, '14:00:00', 8, '22:00:00', 6, 'FALTA PERSONAL')
ON CONFLICT DO NOTHING;

-- Insertar Empleados
INSERT INTO empleados (id, badge_id, name) VALUES
  ('e0000000-0000-0000-0000-000000000001', '100234', 'Juan Pérez'),
  ('e0000000-0000-0000-0000-000000000002', '100112', 'María López'),
  ('e0000000-0000-0000-0000-000000000003', '100876', 'Carlos Ruiz'),
  ('e0000000-0000-0000-0000-000000000004', '100999', 'Ana García'),
  ('e0000000-0000-0000-0000-000000000005', '100777', 'Miguel Torres'),
  ('e0000000-0000-0000-0000-000000000006', '100555', 'Patricia Rivas')
ON CONFLICT (badge_id) DO NOTHING;

-- Insertar Posiciones para Línea 14
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

-- Insertar Coberturas de Comedor
INSERT INTO coberturas (line_id, start_time, end_time, required_operators) VALUES
  ('l0000000-0000-0000-0000-000000000014', '12:00:00', '12:30:00', 3)
ON CONFLICT DO NOTHING;
