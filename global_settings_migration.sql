-- ==============================================================================
-- LINEPULSE MES - SQL MIGRACIÓN PARA CONFIGURACIÓN GLOBAL
-- Ejecutar en el SQL Editor de Supabase
-- ==============================================================================

CREATE TABLE IF NOT EXISTS global_settings (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

COMMENT ON TABLE global_settings IS 'Configuraciones globales de LinePulse';

-- HABILITAR RLS (ROW LEVEL SECURITY) Y CREAR POLÍTICA PÚBLICA DE ACCESO
ALTER TABLE global_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public access global_settings" ON global_settings;
CREATE POLICY "Public access global_settings" ON global_settings FOR ALL USING (true) WITH CHECK (true);

-- INSERTAR VALOR PREDETERMINADO SI NO EXISTE
INSERT INTO global_settings (key, value) 
VALUES ('modo_certificaciones', 'Activado') 
ON CONFLICT (key) DO NOTHING;
