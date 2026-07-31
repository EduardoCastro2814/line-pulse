-- ==============================================================================
-- LINEPULSE MES - MIGRACIÓN PARA MÓDULO DE COMPETENCIAS Y ENTRENAMIENTOS
-- Ejecutar en el SQL Editor de Supabase
-- ==============================================================================

-- 1. TABLA: STATIONS (Catálogo de estaciones)
CREATE TABLE IF NOT EXISTS stations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

COMMENT ON TABLE stations IS 'Catálogo de estaciones de trabajo cargadas automáticamente';

-- 2. TABLA: STATION_REQUIREMENTS (Cursos requeridos por estación)
CREATE TABLE IF NOT EXISTS station_requirements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    station_name VARCHAR(100) NOT NULL,
    training_name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    UNIQUE(station_name, training_name)
);

COMMENT ON TABLE station_requirements IS 'Requerimientos de capacitación por estación de trabajo';

-- 3. TABLA: TRAINING_RECORDS (Entrenamientos completados por operador)
CREATE TABLE IF NOT EXISTS training_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_number VARCHAR(50) NOT NULL,
    employee_name VARCHAR(150) NOT NULL,
    training_name VARCHAR(100) NOT NULL,
    status VARCHAR(50) DEFAULT 'Completado' NOT NULL,
    completion_date DATE DEFAULT CURRENT_DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    UNIQUE(employee_number, training_name)
);

COMMENT ON TABLE training_records IS 'Historial e registros de entrenamientos completados por operadores';

-- 4. TABLA: EMPLOYEE_COMPETENCIES (Habilidades activas y mapeos rápidos)
CREATE TABLE IF NOT EXISTS employee_competencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_number VARCHAR(50) NOT NULL,
    training_name VARCHAR(100) NOT NULL,
    certified BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    UNIQUE(employee_number, training_name)
);

COMMENT ON TABLE employee_competencies IS 'Competencias activas y estatus de certificación por empleado';

-- TRIGGERS PARA ACTUALIZAR COLUMNA UPDATED_AT
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_stations_updated_at ON stations;
CREATE TRIGGER update_stations_updated_at BEFORE UPDATE ON stations FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_station_requirements_updated_at ON station_requirements;
CREATE TRIGGER update_station_requirements_updated_at BEFORE UPDATE ON station_requirements FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_training_records_updated_at ON training_records;
CREATE TRIGGER update_training_records_updated_at BEFORE UPDATE ON training_records FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_employee_competencies_updated_at ON employee_competencies;
CREATE TRIGGER update_employee_competencies_updated_at BEFORE UPDATE ON employee_competencies FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- INDICES DE RENDIMIENTO Y OPTIMIZACIÓN
CREATE INDEX IF NOT EXISTS idx_station_requirements_station ON station_requirements(station_name);
CREATE INDEX IF NOT EXISTS idx_training_records_employee ON training_records(employee_number);
CREATE INDEX IF NOT EXISTS idx_employee_competencies_employee ON employee_competencies(employee_number);

-- POLÍTICAS RLS (ROW LEVEL SECURITY) - PÚBLICAS PARA HABILITAR OPERACIONES DIRECTAS
ALTER TABLE stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE station_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_competencies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir todo a anon en stations" ON stations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir todo a anon en station_requirements" ON station_requirements FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir todo a anon en training_records" ON training_records FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir todo a anon en employee_competencies" ON employee_competencies FOR ALL USING (true) WITH CHECK (true);
