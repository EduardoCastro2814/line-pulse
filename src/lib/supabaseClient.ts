import { createClient } from '@supabase/supabase-js';

// Detect Supabase Environment Variables from Vite (.env)
export const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL || '';
export const supabaseAnonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY || '';

// Determine if environment variables are configured
export const isConfigured = Boolean(supabaseUrl && supabaseAnonKey && !supabaseUrl.includes('your-project'));
export const isMock = !isConfigured;

// LocalStorage Keys
const MOCK_STORAGE_PREFIX = 'linepulse_v2_';
const getStorageKey = (table: string) => `${MOCK_STORAGE_PREFIX}${table}`;

export const DEFAULT_SMT_LAYOUT = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" width="1200" height="400"><rect width="1200" height="400" fill="%23F8FAFC" rx="12"/><path d="M0 50 H1200 M0 100 H1200 M0 150 H1200 M0 200 H1200 M0 250 H1200 M0 300 H1200 M0 350 H1200" stroke="%23E2E8F0" stroke-width="1" stroke-dasharray="4 4"/><path d="M100 0 V400 M200 0 V400 M300 0 V400 M400 0 V400 M500 0 V400 M600 0 V400 M700 0 V400 M800 0 V400 M900 0 V400 M1000 0 V400 M1100 0 V400" stroke="%23E2E8F0" stroke-width="1" stroke-dasharray="4 4"/><rect x="40" y="80" width="1120" height="240" fill="none" stroke="%2394A3B8" stroke-width="2" stroke-dasharray="8 6" rx="8"/><rect x="70" y="140" width="120" height="120" fill="%23FFFFFF" stroke="%230284C7" stroke-width="2.5" rx="6"/><text x="130" y="205" fill="%23334155" font-size="13" font-weight="bold" font-family="monospace" text-anchor="middle">STENCIL PRINTER</text><line x1="190" y1="200" x2="230" y2="200" stroke="%230284C7" stroke-width="4" stroke-dasharray="4 4"/><rect x="230" y="130" width="160" height="140" fill="%23FFFFFF" stroke="%230284C7" stroke-width="2.5" rx="6"/><text x="310" y="205" fill="%230284C7" font-size="14" font-weight="bold" font-family="monospace" text-anchor="middle">SIPLACE 01</text><line x1="390" y1="200" x2="430" y2="200" stroke="%230284C7" stroke-width="4" stroke-dasharray="4 4"/><rect x="430" y="130" width="160" height="140" fill="%23FFFFFF" stroke="%230284C7" stroke-width="2.5" rx="6"/><text x="510" y="205" fill="%230284C7" font-size="14" font-weight="bold" font-family="monospace" text-anchor="middle">SIPLACE 02</text><line x1="590" y1="200" x2="630" y2="200" stroke="%230284C7" stroke-width="4" stroke-dasharray="4 4"/><rect x="630" y="120" width="240" height="160" fill="%23FFFFFF" stroke="%23D97706" stroke-width="2.5" rx="6"/><text x="750" y="205" fill="%23D97706" font-size="14" font-weight="bold" font-family="monospace" text-anchor="middle">HORNO REFLOW</text><line x1="870" y1="200" x2="910" y2="200" stroke="%230284C7" stroke-width="4" stroke-dasharray="4 4"/><rect x="910" y="140" width="110" height="120" fill="%23FFFFFF" stroke="%23059669" stroke-width="2.5" rx="6"/><text x="965" y="205" fill="%23059669" font-size="13" font-weight="bold" font-family="monospace" text-anchor="middle">INSPECCION AOI</text><line x1="1020" y1="200" x2="1050" y2="200" stroke="%230284C7" stroke-width="4" stroke-dasharray="4 4"/><rect x="1050" y="140" width="90" height="120" fill="%23FFFFFF" stroke="%237C3AED" stroke-width="2.5" rx="6"/><text x="1095" y="205" fill="%237C3AED" font-size="13" font-weight="bold" font-family="monospace" text-anchor="middle">EMPAQUE</text></svg>`;

// Helper to load table from localStorage or initialize with seed data
export const loadTable = (tableName: string): any[] => {
  const stored = localStorage.getItem(getStorageKey(tableName));
  if (stored) {
    const parsed = JSON.parse(stored);
    // Force re-seeding if the old seed data (less than 12 lines) or missing posiciones table is present in local storage
    if (tableName === 'lineas' && parsed.length < 12) {
      localStorage.removeItem(getStorageKey('lineas'));
      localStorage.removeItem(getStorageKey('empleados'));
      localStorage.removeItem(getStorageKey('empleados_linea'));
      localStorage.removeItem(getStorageKey('escaneos'));
      localStorage.removeItem(getStorageKey('tiempos_muertos'));
      localStorage.removeItem(getStorageKey('historial_eventos'));
      localStorage.removeItem(getStorageKey('posiciones'));
      // Fall through to seed
    } else {
      return parsed;
    }
  }
  
  // Seed data if empty
  const seeds = getSeedData();
  const seed = seeds[tableName] || [];
  localStorage.setItem(getStorageKey(tableName), JSON.stringify(seed));
  return seed;
};

// Helper to save table to localStorage
export const saveTable = (tableName: string, data: any[]) => {
  localStorage.setItem(getStorageKey(tableName), JSON.stringify(data));
};

// Seed Data definition
function getSeedData(): Record<string, any[]> {
  const areas = [
    { id: 'area-smt', name: 'SMT', description: 'Surface Mount Technology Line' },
    { id: 'area-assembly', name: 'Ensamble', description: 'Assembly and Packaging' },
    { id: 'area-testing', name: 'Pruebas', description: 'Functional & ICT Testing' }
  ];

  const turnos = [
    { id: 'turno-1', name: 'Primero', start_time: '06:00:00', end_time: '14:00:00' },
    { id: 'turno-2', name: 'Segundo', start_time: '14:00:00', end_time: '22:00:00' },
    { id: 'turno-3', name: 'Tercero', start_time: '22:00:00', end_time: '06:00:00' }
  ];

  const lineas = [
    // SMT Area (6 lines)
    { id: 'line-11', area_id: 'area-smt', name: 'Línea 11', process: 'Solder Paste Printing', shift1_start: '06:00:00', shift1_target: 4, shift2_start: '14:00:00', shift2_target: 4, shift3_start: '22:00:00', shift3_target: 3, status: 'FALTA PERSONAL' },
    { id: 'line-12', area_id: 'area-smt', name: 'Línea 12', process: 'Chip Shooting SMT', shift1_start: '06:00:00', shift1_target: 4, shift2_start: '14:00:00', shift2_target: 4, shift3_start: '22:00:00', shift3_target: 3, status: 'PLANTILLA COMPLETA' },
    { id: 'line-13', area_id: 'area-smt', name: 'Línea 13', process: 'Reflow Oven Inspection', shift1_start: '06:00:00', shift1_target: 5, shift2_start: '14:00:00', shift2_target: 5, shift3_start: '22:00:00', shift3_target: 3, status: 'FALTA PERSONAL' },
    { id: 'line-14', area_id: 'area-smt', name: 'Línea 14', process: 'SIPLACE Assembly', shift1_start: '06:00:00', shift1_target: 6, shift2_start: '14:00:00', shift2_target: 6, shift3_start: '22:00:00', shift3_target: 4, status: 'FALTA PERSONAL' },
    { id: 'line-15', area_id: 'area-smt', name: 'Línea 15', process: 'AOI & Solder reflow', shift1_start: '06:00:00', shift1_target: 4, shift2_start: '14:00:00', shift2_target: 4, shift3_start: '22:00:00', shift3_target: 2, status: 'PLANTILLA COMPLETA' },
    { id: 'line-16', area_id: 'area-smt', name: 'Línea 16', process: 'X-Ray BGA Check', shift1_start: '06:00:00', shift1_target: 4, shift2_start: '14:00:00', shift2_target: 4, shift3_start: '22:00:00', shift3_target: 2, status: 'PLANTILLA COMPLETA' },
    
    // Assembly Area (6 lines)
    { id: 'line-1', area_id: 'area-assembly', name: 'Línea 01', process: 'THT & Manual Solder', shift1_start: '06:00:00', shift1_target: 8, shift2_start: '14:00:00', shift2_target: 8, shift3_start: '22:00:00', shift3_target: 6, status: 'FALTA PERSONAL' },
    { id: 'line-2', area_id: 'area-assembly', name: 'Línea 02', process: 'Box Build & Test', shift1_start: '06:00:00', shift1_target: 5, shift2_start: '14:00:00', shift2_target: 5, shift3_start: '22:00:00', shift3_target: 4, status: 'PLANTILLA COMPLETA' },
    { id: 'line-3', area_id: 'area-assembly', name: 'Línea 03', process: 'Cable Harness Routing', shift1_start: '06:00:00', shift1_target: 6, shift2_start: '14:00:00', shift2_target: 6, shift3_start: '22:00:00', shift3_target: 4, status: 'FALTA PERSONAL' },
    { id: 'line-4', area_id: 'area-assembly', name: 'Línea 04', process: 'Mechanical Fasteners', shift1_start: '06:00:00', shift1_target: 6, shift2_start: '14:00:00', shift2_target: 6, shift3_start: '22:00:00', shift3_target: 4, status: 'PLANTILLA COMPLETA' },
    { id: 'line-5', area_id: 'area-assembly', name: 'Línea 05', process: 'Labeling & Packaging', shift1_start: '06:00:00', shift1_target: 8, shift2_start: '14:00:00', shift2_target: 8, shift3_start: '22:00:00', shift3_target: 6, status: 'FALTA PERSONAL' },
    { id: 'line-6', area_id: 'area-assembly', name: 'Línea 06', process: 'Final Quality Audit', shift1_start: '06:00:00', shift1_target: 5, shift2_start: '14:00:00', shift2_target: 5, shift3_start: '22:00:00', shift3_target: 3, status: 'FALTA PERSONAL' },
    
    // Testing Area (4 lines)
    { id: 'line-test-a', area_id: 'area-testing', name: 'Test Cell Alpha', process: 'ICT Test Fixtures', shift1_start: '06:00:00', shift1_target: 3, shift2_start: '14:00:00', shift2_target: 3, shift3_start: '22:00:00', shift3_target: 2, status: 'FALTA PERSONAL' },
    { id: 'line-test-b', area_id: 'area-testing', name: 'Test Cell Beta', process: 'Functional Board testing', shift1_start: '06:00:00', shift1_target: 2, shift2_start: '14:00:00', shift2_target: 2, shift3_start: '22:00:00', shift3_target: 1, status: 'PLANTILLA COMPLETA' },
    { id: 'line-test-c', area_id: 'area-testing', name: 'Test Cell Gamma', process: 'Burn-in Chamber testing', shift1_start: '06:00:00', shift1_target: 3, shift2_start: '14:00:00', shift2_target: 3, shift3_start: '22:00:00', shift3_target: 2, status: 'PLANTILLA COMPLETA' },
    { id: 'line-test-d', area_id: 'area-testing', name: 'Test Cell Delta', process: 'RF & Calibration Lab', shift1_start: '06:00:00', shift1_target: 2, shift2_start: '14:00:00', shift2_target: 2, shift3_start: '22:00:00', shift3_target: 1, status: 'FALTA PERSONAL' }
  ];

  const empleados = [
    { id: 'emp-1001', badge_id: '100234', name: 'Juan Pérez' },
    { id: 'emp-1002', badge_id: '100112', name: 'María López' },
    { id: 'emp-1003', badge_id: '100876', name: 'Carlos Ruiz' },
    { id: 'emp-1004', badge_id: '100999', name: 'Ana García' },
    { id: 'emp-1005', badge_id: '100777', name: 'Miguel Torres' },
    { id: 'emp-1006', badge_id: '100555', name: 'Patricia Rivas' },
    { id: 'emp-1007', badge_id: '100444', name: 'Jorge Castro' },
    { id: 'emp-1008', badge_id: '100333', name: 'Lucía Medina' },
    { id: 'emp-1009', badge_id: '100222', name: 'Héctor Santos' },
    { id: 'emp-1010', badge_id: '100111', name: 'Sofía Ortiz' },
    { id: 'emp-1011', badge_id: '100888', name: 'David Vázquez' },
    { id: 'emp-1012', badge_id: '100550', name: 'Gabriela Díaz' },
    { id: 'emp-1013', badge_id: '100660', name: 'José Herrera' },
    { id: 'emp-1014', badge_id: '100770', name: 'Rosa Ramos' },
    { id: 'emp-1015', badge_id: '100880', name: 'Luis Salazar' },
    { id: 'emp-1016', badge_id: '100990', name: 'Carmen Flores' },
    { id: 'emp-1017', badge_id: '100200', name: 'Pedro Silva' },
    { id: 'emp-1018', badge_id: '100300', name: 'Elena Gómez' },
    { id: 'emp-1019', badge_id: '100400', name: 'Francisco Luna' },
    { id: 'emp-1020', badge_id: '100500', name: 'Alicia Ortega' },
    { id: 'emp-1021', badge_id: '100600', name: 'Roberto Rojas' },
    { id: 'emp-1022', badge_id: '100700', name: 'Marta Juárez' },
    { id: 'emp-1023', badge_id: '100800', name: 'Julio Espinoza' },
    { id: 'emp-1024', badge_id: '100900', name: 'Teresa Domínguez' },
    { id: 'emp-1025', badge_id: '100120', name: 'Gonzalo Rangel' },
    { id: 'emp-1026', badge_id: '100130', name: 'Maribel Peña' },
    { id: 'emp-1027', badge_id: '100140', name: 'Andrés Ramos' },
    { id: 'emp-1028', badge_id: '100150', name: 'Silvia Garza' },
    { id: 'emp-1029', badge_id: '1009999', name: 'Claudio Martínez' },
    { id: 'emp-1030', badge_id: '1008888', name: 'Fernanda Beltrán' },

    // Additional operators
    { id: 'emp-1031', badge_id: '100310', name: 'Eduardo Flores' },
    { id: 'emp-1032', badge_id: '100320', name: 'Laura Palacios' },
    { id: 'emp-1033', badge_id: '100330', name: 'Ricardo Ramos' },
    { id: 'emp-1034', badge_id: '100340', name: 'Verónica Luna' },
    { id: 'emp-1035', badge_id: '100350', name: 'Gabriel Soto' },
    { id: 'emp-1036', badge_id: '100360', name: 'Daniela Miranda' },
    { id: 'emp-1037', badge_id: '100370', name: 'Alejandro Cruz' },
    { id: 'emp-1038', badge_id: '100380', name: 'Guadalupe Reyes' },
    { id: 'emp-1039', badge_id: '100390', name: 'Mauricio Méndez' },
    { id: 'emp-1040', badge_id: '100401', name: 'Beatriz Solís' },
    { id: 'emp-1041', badge_id: '100410', name: 'Felipe Mendoza' },
    { id: 'emp-1042', badge_id: '100420', name: 'Diana Moreno' },
    { id: 'emp-1043', badge_id: '100430', name: 'Manuel Ortiz' },
    { id: 'emp-1044', badge_id: '100440', name: 'Sandra Delgado' },
    { id: 'emp-1045', badge_id: '100450', name: 'Ángel Cabrera' },
    { id: 'emp-1046', badge_id: '100460', name: 'Mónica Vega' },
    { id: 'emp-1047', badge_id: '100470', name: 'Javier Navarro' },
    { id: 'emp-1048', badge_id: '100480', name: 'Karla Ríos' },
    { id: 'emp-1049', badge_id: '100490', name: 'Ramón Rojas' },
    { id: 'emp-1050', badge_id: '100501', name: 'Estela Morales' },
    { id: 'emp-1051', badge_id: '100510', name: 'Hugo Sandoval' },
    { id: 'emp-1052', badge_id: '100520', name: 'Lorena Fuentes' },
    { id: 'emp-1053', badge_id: '100530', name: 'Fernando Aguilar' },
    { id: 'emp-1054', badge_id: '100540', name: 'Adela Castillo' },
    { id: 'emp-1055', badge_id: '100551', name: 'Arturo Guerrero' },
    { id: 'emp-1056', badge_id: '100560', name: 'Yolanda Vargas' },
    { id: 'emp-1057', badge_id: '100570', name: 'César Guzmán' },
    { id: 'emp-1058', badge_id: '100580', name: 'Rocío Núñez' },
    { id: 'emp-1059', badge_id: '100590', name: 'Víctor Salazar' },
    { id: 'emp-1060', badge_id: '100601', name: 'Isabel Paredes' }
  ];

  // Assign operators to line templates
  const empleados_linea = [
    // Linea 14
    { id: 'el-1', employee_id: 'emp-1001', line_id: 'line-14' },
    { id: 'el-2', employee_id: 'emp-1002', line_id: 'line-14' },
    { id: 'el-3', employee_id: 'emp-1003', line_id: 'line-14' },
    { id: 'el-4', employee_id: 'emp-1004', line_id: 'line-14' },
    { id: 'el-5', employee_id: 'emp-1005', line_id: 'line-14' },
    { id: 'el-6', employee_id: 'emp-1006', line_id: 'line-14' },

    // Linea 15
    { id: 'el-7', employee_id: 'emp-1007', line_id: 'line-15' },
    { id: 'el-8', employee_id: 'emp-1008', line_id: 'line-15' },
    { id: 'el-9', employee_id: 'emp-1009', line_id: 'line-15' },
    { id: 'el-10', employee_id: 'emp-1010', line_id: 'line-15' },

    // Linea 01
    { id: 'el-11', employee_id: 'emp-1011', line_id: 'line-1' },
    { id: 'el-12', employee_id: 'emp-1012', line_id: 'line-1' },
    { id: 'el-13', employee_id: 'emp-1013', line_id: 'line-1' },
    { id: 'el-14', employee_id: 'emp-1014', line_id: 'line-1' },
    { id: 'el-15', employee_id: 'emp-1015', line_id: 'line-1' },
    { id: 'el-16', employee_id: 'emp-1016', line_id: 'line-1' },
    { id: 'el-17', employee_id: 'emp-1017', line_id: 'line-1' },
    { id: 'el-18', employee_id: 'emp-1018', line_id: 'line-1' },

    // Linea 02
    { id: 'el-19', employee_id: 'emp-1019', line_id: 'line-2' },
    { id: 'el-20', employee_id: 'emp-1020', line_id: 'line-2' },
    { id: 'el-21', employee_id: 'emp-1021', line_id: 'line-2' },
    { id: 'el-22', employee_id: 'emp-1022', line_id: 'line-2' },
    { id: 'el-23', employee_id: 'emp-1023', line_id: 'line-2' },

    // Test Cell Alpha
    { id: 'el-24', employee_id: 'emp-1024', line_id: 'line-test-a' },
    { id: 'el-25', employee_id: 'emp-1025', line_id: 'line-test-a' },
    { id: 'el-26', employee_id: 'emp-1026', line_id: 'line-test-a' },

    // Test Cell Beta
    { id: 'el-27', employee_id: 'emp-1027', line_id: 'line-test-b' },
    { id: 'el-28', employee_id: 'emp-1028', line_id: 'line-test-b' },

    // Linea 11
    { id: 'el-29', employee_id: 'emp-1031', line_id: 'line-11' },
    { id: 'el-30', employee_id: 'emp-1032', line_id: 'line-11' },
    { id: 'el-31', employee_id: 'emp-1033', line_id: 'line-11' },
    { id: 'el-32', employee_id: 'emp-1034', line_id: 'line-11' },

    // Linea 12
    { id: 'el-33', employee_id: 'emp-1035', line_id: 'line-12' },
    { id: 'el-34', employee_id: 'emp-1036', line_id: 'line-12' },
    { id: 'el-35', employee_id: 'emp-1037', line_id: 'line-12' },
    { id: 'el-36', employee_id: 'emp-1038', line_id: 'line-12' },

    // Linea 13
    { id: 'el-37', employee_id: 'emp-1039', line_id: 'line-13' },
    { id: 'el-38', employee_id: 'emp-1040', line_id: 'line-13' },
    { id: 'el-39', employee_id: 'emp-1041', line_id: 'line-13' },
    { id: 'el-40', employee_id: 'emp-1042', line_id: 'line-13' },
    { id: 'el-41', employee_id: 'emp-1043', line_id: 'line-13' },

    // Linea 16
    { id: 'el-42', employee_id: 'emp-1044', line_id: 'line-16' },
    { id: 'el-43', employee_id: 'emp-1045', line_id: 'line-16' },
    { id: 'el-44', employee_id: 'emp-1046', line_id: 'line-16' },
    { id: 'el-45', employee_id: 'emp-1047', line_id: 'line-16' },

    // Linea 03
    { id: 'el-46', employee_id: 'emp-1048', line_id: 'line-3' },
    { id: 'el-47', employee_id: 'emp-1049', line_id: 'line-3' },
    { id: 'el-48', employee_id: 'emp-1050', line_id: 'line-3' },
    { id: 'el-49', employee_id: 'emp-1051', line_id: 'line-3' },
    { id: 'el-50', employee_id: 'emp-1052', line_id: 'line-3' },
    { id: 'el-51', employee_id: 'emp-1053', line_id: 'line-3' },

    // Linea 04
    { id: 'el-52', employee_id: 'emp-1054', line_id: 'line-4' },
    { id: 'el-53', employee_id: 'emp-1055', line_id: 'line-4' },
    { id: 'el-54', employee_id: 'emp-1056', line_id: 'line-4' },
    { id: 'el-55', employee_id: 'emp-1057', line_id: 'line-4' },
    { id: 'el-56', employee_id: 'emp-1058', line_id: 'line-4' },
    { id: 'el-57', employee_id: 'emp-1059', line_id: 'line-4' },

    // Linea 05
    { id: 'el-58', employee_id: 'emp-1060', line_id: 'line-5' },
    { id: 'el-59', employee_id: 'emp-1011', line_id: 'line-5' },
    { id: 'el-60', employee_id: 'emp-1012', line_id: 'line-5' },
    { id: 'el-61', employee_id: 'emp-1013', line_id: 'line-5' },
    { id: 'el-62', employee_id: 'emp-1014', line_id: 'line-5' },
    { id: 'el-63', employee_id: 'emp-1015', line_id: 'line-5' },
    { id: 'el-64', employee_id: 'emp-1016', line_id: 'line-5' },
    { id: 'el-65', employee_id: 'emp-1017', line_id: 'line-5' },

    // Linea 06
    { id: 'el-66', employee_id: 'emp-1018', line_id: 'line-6' },
    { id: 'el-67', employee_id: 'emp-1019', line_id: 'line-6' },
    { id: 'el-68', employee_id: 'emp-1020', line_id: 'line-6' },
    { id: 'el-69', employee_id: 'emp-1021', line_id: 'line-6' },
    { id: 'el-70', employee_id: 'emp-1022', line_id: 'line-6' },

    // Test Cell Gamma
    { id: 'el-71', employee_id: 'emp-1023', line_id: 'line-test-c' },
    { id: 'el-72', employee_id: 'emp-1024', line_id: 'line-test-c' },
    { id: 'el-73', employee_id: 'emp-1025', line_id: 'line-test-c' },

    // Test Cell Delta
    { id: 'el-74', employee_id: 'emp-1026', line_id: 'line-test-d' },
    { id: 'el-75', employee_id: 'emp-1027', line_id: 'line-test-d' }
  ];

  const todayStr = new Date().toISOString().split('T')[0];

  const escaneos = [
    // Line 14: Target 6, Present: 4 (67% - Red)
    { id: 'esc-1', badge_id: '100234', employee_name: 'Juan Pérez', line_id: 'line-14', event_time: `${todayStr}T05:50:00.000Z`, event_type: 'shift_start', was_successful: true, error_message: null },
    { id: 'esc-2', badge_id: '100112', employee_name: 'María López', line_id: 'line-14', event_time: `${todayStr}T05:52:00.000Z`, event_type: 'shift_start', was_successful: true, error_message: null },
    { id: 'esc-3', badge_id: '100999', employee_name: 'Ana García', line_id: 'line-14', event_time: `${todayStr}T05:55:00.000Z`, event_type: 'shift_start', was_successful: true, error_message: null },
    { id: 'esc-4', badge_id: '100555', employee_name: 'Patricia Rivas', line_id: 'line-14', event_time: `${todayStr}T06:02:00.000Z`, event_type: 'shift_start', was_successful: true, error_message: null },

    // Line 15: Target 4, Present: 4 (100% - Green)
    { id: 'esc-5', badge_id: '100444', employee_name: 'Jorge Castro', line_id: 'line-15', event_time: `${todayStr}T05:48:00.000Z`, event_type: 'shift_start', was_successful: true, error_message: null },
    { id: 'esc-6', badge_id: '100333', employee_name: 'Lucía Medina', line_id: 'line-15', event_time: `${todayStr}T05:51:00.000Z`, event_type: 'shift_start', was_successful: true, error_message: null },
    { id: 'esc-7', badge_id: '100222', employee_name: 'Héctor Santos', line_id: 'line-15', event_time: `${todayStr}T05:56:00.000Z`, event_type: 'shift_start', was_successful: true, error_message: null },
    { id: 'esc-8', badge_id: '100111', employee_name: 'Sofía Ortiz', line_id: 'line-15', event_time: `${todayStr}T05:59:00.000Z`, event_type: 'shift_start', was_successful: true, error_message: null },

    // Line 01: Target 8, Present: 6 (75% - Red)
    { id: 'esc-9', badge_id: '100888', employee_name: 'David Vázquez', line_id: 'line-1', event_time: `${todayStr}T05:53:00.000Z`, event_type: 'shift_start', was_successful: true, error_message: null },
    { id: 'esc-10', badge_id: '100550', employee_name: 'Gabriela Díaz', line_id: 'line-1', event_time: `${todayStr}T05:54:00.000Z`, event_type: 'shift_start', was_successful: true, error_message: null },
    { id: 'esc-11', badge_id: '100660', employee_name: 'José Herrera', line_id: 'line-1', event_time: `${todayStr}T05:57:00.000Z`, event_type: 'shift_start', was_successful: true, error_message: null },
    { id: 'esc-12', badge_id: '100880', employee_name: 'Luis Salazar', line_id: 'line-1', event_time: `${todayStr}T05:59:00.000Z`, event_type: 'shift_start', was_successful: true, error_message: null },
    { id: 'esc-13', badge_id: '100990', employee_name: 'Carmen Flores', line_id: 'line-1', event_time: `${todayStr}T06:01:00.000Z`, event_type: 'shift_start', was_successful: true, error_message: null },
    { id: 'esc-14', badge_id: '100300', employee_name: 'Elena Gómez', line_id: 'line-1', event_time: `${todayStr}T06:05:00.000Z`, event_type: 'shift_start', was_successful: true, error_message: null },

    // Line 02: Target 5, Present: 5 (100% - Green)
    { id: 'esc-15', badge_id: '100400', employee_name: 'Francisco Luna', line_id: 'line-2', event_time: `${todayStr}T05:45:00.000Z`, event_type: 'shift_start', was_successful: true, error_message: null },
    { id: 'esc-16', badge_id: '100500', employee_name: 'Alicia Ortega', line_id: 'line-2', event_time: `${todayStr}T05:46:00.000Z`, event_type: 'shift_start', was_successful: true, error_message: null },
    { id: 'esc-17', badge_id: '100600', employee_name: 'Roberto Rojas', line_id: 'line-2', event_time: `${todayStr}T05:50:00.000Z`, event_type: 'shift_start', was_successful: true, error_message: null },
    { id: 'esc-18', badge_id: '100700', employee_name: 'Marta Juárez', line_id: 'line-2', event_time: `${todayStr}T05:55:00.000Z`, event_type: 'shift_start', was_successful: true, error_message: null },
    { id: 'esc-19', badge_id: '100800', employee_name: 'Julio Espinoza', line_id: 'line-2', event_time: `${todayStr}T05:58:00.000Z`, event_type: 'shift_start', was_successful: true, error_message: null },

    // Test Cell Alpha: Target 3, Present: 2 (67% - Red)
    { id: 'esc-20', badge_id: '100900', employee_name: 'Teresa Domínguez', line_id: 'line-test-a', event_time: `${todayStr}T05:58:00.000Z`, event_type: 'shift_start', was_successful: true, error_message: null },
    { id: 'esc-21', badge_id: '100120', employee_name: 'Gonzalo Rangel', line_id: 'line-test-a', event_time: `${todayStr}T06:03:00.000Z`, event_type: 'shift_start', was_successful: true, error_message: null },

    // Test Cell Beta: Target 2, Present: 2 (100% - Green)
    { id: 'esc-22', badge_id: '100140', employee_name: 'Andrés Ramos', line_id: 'line-test-b', event_time: `${todayStr}T05:52:00.000Z`, event_type: 'shift_start', was_successful: true, error_message: null },
    { id: 'esc-23', badge_id: '100150', employee_name: 'Silvia Garza', line_id: 'line-test-b', event_time: `${todayStr}T05:55:00.000Z`, event_type: 'shift_start', was_successful: true, error_message: null },

    // Linea 11: Target 4, Present: 3 (75% - Red)
    { id: 'esc-24', badge_id: '100310', employee_name: 'Eduardo Flores', line_id: 'line-11', event_time: `${todayStr}T05:50:00.000Z`, event_type: 'shift_start', was_successful: true, error_message: null },
    { id: 'esc-25', badge_id: '100320', employee_name: 'Laura Palacios', line_id: 'line-11', event_time: `${todayStr}T05:53:00.000Z`, event_type: 'shift_start', was_successful: true, error_message: null },
    { id: 'esc-26', badge_id: '100330', employee_name: 'Ricardo Ramos', line_id: 'line-11', event_time: `${todayStr}T05:57:00.000Z`, event_type: 'shift_start', was_successful: true, error_message: null },

    // Linea 12: Target 4, Present: 4 (100% - Green)
    { id: 'esc-27', badge_id: '100350', employee_name: 'Gabriel Soto', line_id: 'line-12', event_time: `${todayStr}T05:46:00.000Z`, event_type: 'shift_start', was_successful: true, error_message: null },
    { id: 'esc-28', badge_id: '100360', employee_name: 'Daniela Miranda', line_id: 'line-12', event_time: `${todayStr}T05:49:00.000Z`, event_type: 'shift_start', was_successful: true, error_message: null },
    { id: 'esc-29', badge_id: '100370', employee_name: 'Alejandro Cruz', line_id: 'line-12', event_time: `${todayStr}T05:52:00.000Z`, event_type: 'shift_start', was_successful: true, error_message: null },
    { id: 'esc-30', badge_id: '100380', employee_name: 'Guadalupe Reyes', line_id: 'line-12', event_time: `${todayStr}T05:55:00.000Z`, event_type: 'shift_start', was_successful: true, error_message: null },

    // Linea 13: Target 5, Present: 3 (60% - Red)
    { id: 'esc-31', badge_id: '100390', employee_name: 'Mauricio Méndez', line_id: 'line-13', event_time: `${todayStr}T05:54:00.000Z`, event_type: 'shift_start', was_successful: true, error_message: null },
    { id: 'esc-32', badge_id: '100401', employee_name: 'Beatriz Solís', line_id: 'line-13', event_time: `${todayStr}T05:57:00.000Z`, event_type: 'shift_start', was_successful: true, error_message: null },
    { id: 'esc-33', badge_id: '100410', employee_name: 'Felipe Mendoza', line_id: 'line-13', event_time: `${todayStr}T05:59:00.000Z`, event_type: 'shift_start', was_successful: true, error_message: null },

    // Linea 16: Target 4, Present: 4 (100% - Green)
    { id: 'esc-34', badge_id: '100440', employee_name: 'Sandra Delgado', line_id: 'line-16', event_time: `${todayStr}T05:44:00.000Z`, event_type: 'shift_start', was_successful: true, error_message: null },
    { id: 'esc-35', badge_id: '100450', employee_name: 'Ángel Cabrera', line_id: 'line-16', event_time: `${todayStr}T05:47:00.000Z`, event_type: 'shift_start', was_successful: true, error_message: null },
    { id: 'esc-36', badge_id: '100460', employee_name: 'Mónica Vega', line_id: 'line-16', event_time: `${todayStr}T05:51:00.000Z`, event_type: 'shift_start', was_successful: true, error_message: null },
    { id: 'esc-37', badge_id: '100470', employee_name: 'Javier Navarro', line_id: 'line-16', event_time: `${todayStr}T05:55:00.000Z`, event_type: 'shift_start', was_successful: true, error_message: null },

    // Linea 03: Target 6, Present: 5 (83% - Yellow)
    { id: 'esc-38', badge_id: '100480', employee_name: 'Karla Ríos', line_id: 'line-3', event_time: `${todayStr}T05:50:00.000Z`, event_type: 'shift_start', was_successful: true, error_message: null },
    { id: 'esc-39', badge_id: '100490', employee_name: 'Ramón Rojas', line_id: 'line-3', event_time: `${todayStr}T05:52:00.000Z`, event_type: 'shift_start', was_successful: true, error_message: null },
    { id: 'esc-40', badge_id: '100501', employee_name: 'Estela Morales', line_id: 'line-3', event_time: `${todayStr}T05:55:00.000Z`, event_type: 'shift_start', was_successful: true, error_message: null },
    { id: 'esc-41', badge_id: '100510', employee_name: 'Hugo Sandoval', line_id: 'line-3', event_time: `${todayStr}T05:58:00.000Z`, event_type: 'shift_start', was_successful: true, error_message: null },
    { id: 'esc-42', badge_id: '100520', employee_name: 'Lorena Fuentes', line_id: 'line-3', event_time: `${todayStr}T06:01:00.000Z`, event_type: 'shift_start', was_successful: true, error_message: null },

    // Linea 04: Target 6, Present: 6 (100% - Green)
    { id: 'esc-43', badge_id: '100540', employee_name: 'Adela Castillo', line_id: 'line-4', event_time: `${todayStr}T05:48:00.000Z`, event_type: 'shift_start', was_successful: true, error_message: null },
    { id: 'esc-44', badge_id: '100551', employee_name: 'Arturo Guerrero', line_id: 'line-4', event_time: `${todayStr}T05:51:00.000Z`, event_type: 'shift_start', was_successful: true, error_message: null },
    { id: 'esc-45', badge_id: '100560', employee_name: 'Yolanda Vargas', line_id: 'line-4', event_time: `${todayStr}T05:53:00.000Z`, event_type: 'shift_start', was_successful: true, error_message: null },
    { id: 'esc-46', badge_id: '100570', employee_name: 'César Guzmán', line_id: 'line-4', event_time: `${todayStr}T05:56:00.000Z`, event_type: 'shift_start', was_successful: true, error_message: null },
    { id: 'esc-47', badge_id: '100580', employee_name: 'Rocío Núñez', line_id: 'line-4', event_time: `${todayStr}T05:58:00.000Z`, event_type: 'shift_start', was_successful: true, error_message: null },
    { id: 'esc-48', badge_id: '100590', employee_name: 'Víctor Salazar', line_id: 'line-4', event_time: `${todayStr}T06:00:00.000Z`, event_type: 'shift_start', was_successful: true, error_message: null },

    // Linea 05: Target 8, Present: 7 (88% - Yellow)
    { id: 'esc-49', badge_id: '100601', employee_name: 'Isabel Paredes', line_id: 'line-5', event_time: `${todayStr}T05:49:00.000Z`, event_type: 'shift_start', was_successful: true, error_message: null },
    { id: 'esc-50', badge_id: '100888', employee_name: 'David Vázquez', line_id: 'line-5', event_time: `${todayStr}T05:51:00.000Z`, event_type: 'shift_start', was_successful: true, error_message: null },
    { id: 'esc-51', badge_id: '100550', employee_name: 'Gabriela Díaz', line_id: 'line-5', event_time: `${todayStr}T05:54:00.000Z`, event_type: 'shift_start', was_successful: true, error_message: null },
    { id: 'esc-52', badge_id: '100660', employee_name: 'José Herrera', line_id: 'line-5', event_time: `${todayStr}T05:56:00.000Z`, event_type: 'shift_start', was_successful: true, error_message: null },
    { id: 'esc-53', badge_id: '100770', employee_name: 'Rosa Ramos', line_id: 'line-5', event_time: `${todayStr}T05:58:00.000Z`, event_type: 'shift_start', was_successful: true, error_message: null },
    { id: 'esc-54', badge_id: '100880', employee_name: 'Luis Salazar', line_id: 'line-5', event_time: `${todayStr}T06:01:00.000Z`, event_type: 'shift_start', was_successful: true, error_message: null },
    { id: 'esc-55', badge_id: '100990', employee_name: 'Carmen Flores', line_id: 'line-5', event_time: `${todayStr}T06:03:00.000Z`, event_type: 'shift_start', was_successful: true, error_message: null },

    // Linea 06: Target 5, Present: 4 (80% - Yellow)
    { id: 'esc-56', badge_id: '100300', employee_name: 'Elena Gómez', line_id: 'line-6', event_time: `${todayStr}T05:51:00.000Z`, event_type: 'shift_start', was_successful: true, error_message: null },
    { id: 'esc-57', badge_id: '100400', employee_name: 'Francisco Luna', line_id: 'line-6', event_time: `${todayStr}T05:54:00.000Z`, event_type: 'shift_start', was_successful: true, error_message: null },
    { id: 'esc-58', badge_id: '100500', employee_name: 'Alicia Ortega', line_id: 'line-6', event_time: `${todayStr}T05:57:00.000Z`, event_type: 'shift_start', was_successful: true, error_message: null },
    { id: 'esc-59', badge_id: '100600', employee_name: 'Roberto Rojas', line_id: 'line-6', event_time: `${todayStr}T06:00:00.000Z`, event_type: 'shift_start', was_successful: true, error_message: null },

    // Test Cell Gamma: Target 3, Present: 3 (100% - Green)
    { id: 'esc-60', badge_id: '100800', employee_name: 'Julio Espinoza', line_id: 'line-test-c', event_time: `${todayStr}T05:51:00.000Z`, event_type: 'shift_start', was_successful: true, error_message: null },
    { id: 'esc-61', badge_id: '100900', employee_name: 'Teresa Domínguez', line_id: 'line-test-c', event_time: `${todayStr}T05:54:00.000Z`, event_type: 'shift_start', was_successful: true, error_message: null },
    { id: 'esc-62', badge_id: '100120', employee_name: 'Gonzalo Rangel', line_id: 'line-test-c', event_time: `${todayStr}T05:58:00.000Z`, event_type: 'shift_start', was_successful: true, error_message: null },

    // Test Cell Delta: Target 2, Present: 1 (50% - Red)
    { id: 'esc-63', badge_id: '100130', employee_name: 'Maribel Peña', line_id: 'line-test-d', event_time: `${todayStr}T05:58:00.000Z`, event_type: 'shift_start', was_successful: true, error_message: null }
  ];

  const tiempos_muertos = [
    { id: 'tm-1', line_id: 'line-14', start_time: '2026-07-10T06:00:00.000Z', end_time: '2026-07-10T06:25:00.000Z', duration_minutes: 25, date: '2026-07-10', resolved: true },
    { id: 'tm-2', line_id: 'line-1', start_time: '2026-07-11T06:00:00.000Z', end_time: '2026-07-11T06:45:00.000Z', duration_minutes: 45, date: '2026-07-11', resolved: true },
    { id: 'tm-3', line_id: 'line-test-a', start_time: '2026-07-12T06:00:00.000Z', end_time: '2026-07-12T06:18:00.000Z', duration_minutes: 18, date: '2026-07-12', resolved: true },
    
    // Active downtime tickers
    { id: 'tm-active-14', line_id: 'line-14', start_time: `${todayStr}T06:00:00.000Z`, end_time: null, duration_minutes: null, date: todayStr, resolved: false },
    { id: 'tm-active-1', line_id: 'line-1', start_time: `${todayStr}T06:00:00.000Z`, end_time: null, duration_minutes: null, date: todayStr, resolved: false },
    { id: 'tm-active-ta', line_id: 'line-test-a', start_time: `${todayStr}T06:00:00.000Z`, end_time: null, duration_minutes: null, date: todayStr, resolved: false },
    { id: 'tm-active-11', line_id: 'line-11', start_time: `${todayStr}T06:00:00.000Z`, end_time: null, duration_minutes: null, date: todayStr, resolved: false },
    { id: 'tm-active-13', line_id: 'line-13', start_time: `${todayStr}T06:00:00.000Z`, end_time: null, duration_minutes: null, date: todayStr, resolved: false },
    { id: 'tm-active-td', line_id: 'line-test-d', start_time: `${todayStr}T06:00:00.000Z`, end_time: null, duration_minutes: null, date: todayStr, resolved: false }
  ];

  const coberturas = [
    { id: 'lc-1', line_id: 'line-14', start_time: '12:00:00', end_time: '12:30:00', required_operators: 3 }
  ];

  const historial_eventos = [
    { id: 'he-1', event_type: 'inicio_turno', line_id: 'line-14', description: 'Arranque de turno Primero para Línea 14. Meta: 6 operadores.', timestamp: `${todayStr}T06:00:00.000Z` },
    { id: 'he-2', event_type: 'escaneo', line_id: 'line-14', description: 'Juan Pérez (100234) escaneó: Ingresó a línea.', timestamp: `${todayStr}T06:00:10.000Z` },
    { id: 'he-3', event_type: 'inicio_turno', line_id: 'line-15', description: 'Arranque de turno Primero para Línea 15. Meta: 4 operadores.', timestamp: `${todayStr}T06:00:00.000Z` },
    { id: 'he-4', event_type: 'plantilla_completa', line_id: 'line-15', description: 'Línea Línea 15 completó su plantilla requerida.', timestamp: `${todayStr}T06:01:00.000Z` }
  ];

  const posiciones = [
    // Linea 14 (SMT) - 6 posiciones mapeadas sobre el layout blueprint
    { id: 'pos-14-1', line_id: 'line-14', code: 'POS01', station_name: 'Stencil', employee_id: 'emp-1001', x_percent: 11, y_percent: 72 },
    { id: 'pos-14-2', line_id: 'line-14', code: 'POS02', station_name: 'SIPLACE 01', employee_id: 'emp-1002', x_percent: 26, y_percent: 72 },
    { id: 'pos-14-3', line_id: 'line-14', code: 'POS03', station_name: 'SIPLACE 02', employee_id: 'emp-1003', x_percent: 42, y_percent: 72 },
    { id: 'pos-14-4', line_id: 'line-14', code: 'POS04', station_name: 'Horno Reflow', employee_id: 'emp-1004', x_percent: 63, y_percent: 72 },
    { id: 'pos-14-5', line_id: 'line-14', code: 'POS05', station_name: 'Inspección AOI', employee_id: 'emp-1005', x_percent: 80, y_percent: 72 },
    { id: 'pos-14-6', line_id: 'line-14', code: 'POS06', station_name: 'Empaque Final', employee_id: 'emp-1006', x_percent: 92, y_percent: 72 },

    // Linea 15 (SMT)
    { id: 'pos-15-1', line_id: 'line-15', code: 'POS01', station_name: 'Impresora Solder', employee_id: 'emp-1007', x_percent: 15, y_percent: 70 },
    { id: 'pos-15-2', line_id: 'line-15', code: 'POS02', station_name: 'SMT Picker', employee_id: 'emp-1008', x_percent: 40, y_percent: 70 },
    { id: 'pos-15-3', line_id: 'line-15', code: 'POS03', station_name: 'Horno Solder', employee_id: 'emp-1009', x_percent: 65, y_percent: 70 },
    { id: 'pos-15-4', line_id: 'line-15', code: 'POS04', station_name: 'Inspección Final', employee_id: 'emp-1010', x_percent: 85, y_percent: 70 },

    // Linea 01 (Ensamble)
    { id: 'pos-1-1', line_id: 'line-1', code: 'POS01', station_name: 'Inserción THT 1', employee_id: 'emp-1011', x_percent: 12, y_percent: 50 },
    { id: 'pos-1-2', line_id: 'line-1', code: 'POS02', station_name: 'Inserción THT 2', employee_id: 'emp-1012', x_percent: 24, y_percent: 50 },
    { id: 'pos-1-3', line_id: 'line-1', code: 'POS03', station_name: 'Soldadura Manual 1', employee_id: 'emp-1013', x_percent: 36, y_percent: 50 },
    { id: 'pos-1-4', line_id: 'line-1', code: 'POS04', station_name: 'Soldadura Manual 2', employee_id: 'emp-1014', x_percent: 48, y_percent: 50 },
    { id: 'pos-1-5', line_id: 'line-1', code: 'POS05', station_name: 'Ensamble Mecánico', employee_id: 'emp-1015', x_percent: 60, y_percent: 50 },
    { id: 'pos-1-6', line_id: 'line-1', code: 'POS06', station_name: 'Prueba Eléctrica', employee_id: 'emp-1016', x_percent: 72, y_percent: 50 },
    { id: 'pos-1-7', line_id: 'line-1', code: 'POS07', station_name: 'Empaque Inicial', employee_id: 'emp-1017', x_percent: 84, y_percent: 50 },
    { id: 'pos-1-8', line_id: 'line-1', code: 'POS08', station_name: 'Auditoría Calidad', employee_id: 'emp-1018', x_percent: 94, y_percent: 50 }
  ];

  return {
    areas,
    turnos,
    lineas,
    empleados,
    empleados_linea,
    posiciones,
    escaneos,
    tiempos_muertos,
    coberturas,
    historial_eventos
  };
}

// Global Event Dispatcher
const dispatchDbChange = (table: string, eventType: 'INSERT' | 'UPDATE' | 'DELETE', newRecord: any, oldRecord?: any) => {
  const event = new CustomEvent('supabase-db-change', {
    detail: { table, eventType, newRecord, oldRecord }
  });
  window.dispatchEvent(event);
};

// Recalculates if a line is complete, manages downtime logs, and records complete events
export const recalculateLineState = (lineId: string) => {
  const lineas = loadTable('lineas');
  const lineIdx = lineas.findIndex(l => l.id === lineId);
  if (lineIdx === -1) return;

  const line = lineas[lineIdx];
  const escaneosList = loadTable('escaneos');

  // Filter only successful scans on this line
  const lineScans = escaneosList.filter(s => s.line_id === lineId && s.was_successful);
  
  // Group by badge_id to find most recent state
  const badgeLastEventMap: Record<string, any> = {};
  lineScans
    .sort((a, b) => new Date(a.event_time).getTime() - new Date(b.event_time).getTime())
    .forEach(scan => {
      badgeLastEventMap[scan.badge_id] = scan;
    });

  const presentOperators = Object.values(badgeLastEventMap).filter((scan: any) => 
    scan.event_type === 'shift_start' || scan.event_type === 'lunch_return'
  );
  
  const presentCount = presentOperators.length;
  const { target } = getActiveStaffingTarget(lineId);

  // Update status based on ratio
  let newStatus = 'FALTA PERSONAL';
  if (presentCount >= target) {
    newStatus = 'PLANTILLA COMPLETA';
  } else {
    newStatus = 'FALTA PERSONAL';
  }

  // Check if target was completed
  if (newStatus === 'PLANTILLA COMPLETA' && line.status !== 'PLANTILLA COMPLETA') {
    const events = loadTable('historial_eventos');
    const compEvent = {
      id: Math.random().toString(36).substring(2, 11),
      event_type: 'plantilla_completa',
      line_id: lineId,
      description: `Línea ${line.name} completó su plantilla requerida.`,
      timestamp: new Date().toISOString()
    };
    events.push(compEvent);
    saveTable('historial_eventos', events);
    dispatchDbChange('historial_eventos', 'INSERT', compEvent);
  }

  if (line.status !== newStatus) {
    line.status = newStatus;
    lineas[lineIdx] = line;
    saveTable('lineas', lineas);
    dispatchDbChange('lineas', 'UPDATE', line);

    // Downtime log tick management
    const downtimeLogs = loadTable('tiempos_muertos');
    
    if (newStatus === 'PLANTILLA COMPLETA') {
      const activeLogIdx = downtimeLogs.findIndex(log => log.line_id === lineId && !log.resolved);
      if (activeLogIdx !== -1) {
        const log = downtimeLogs[activeLogIdx];
        const now = new Date();
        const start = new Date(log.start_time);
        const duration = Math.max(1, Math.round((now.getTime() - start.getTime()) / (60 * 1000)));

        log.end_time = now.toISOString();
        log.duration_minutes = duration;
        log.resolved = true;
        downtimeLogs[activeLogIdx] = log;
        saveTable('tiempos_muertos', downtimeLogs);
        dispatchDbChange('tiempos_muertos', 'UPDATE', log);
      }
    } else {
      const activeLogExists = downtimeLogs.some(log => log.line_id === lineId && !log.resolved);
      if (!activeLogExists) {
        const newLog = {
          id: Math.random().toString(36).substring(2, 11),
          line_id: lineId,
          start_time: new Date().toISOString(),
          end_time: null,
          duration_minutes: null,
          date: new Date().toISOString().split('T')[0],
          resolved: false,
          created_at: new Date().toISOString()
        };
        downtimeLogs.push(newLog);
        saveTable('tiempos_muertos', downtimeLogs);
        dispatchDbChange('tiempos_muertos', 'INSERT', newLog);
      }
    }
  }
};

// Helper to determine active staffing target for a line at the current time
export const getActiveStaffingTarget = (lineId: string): { target: number; isCoverageActive: boolean; coverageDetails?: any; activeShiftName: string } => {
  const line = loadTable('lineas').find(l => l.id === lineId);
  if (!line) return { target: 0, isCoverageActive: false, activeShiftName: 'Primero' };

  // Calculate current active shift
  const now = new Date();
  const nowStr = now.toTimeString().split(' ')[0]; // "12:15:32"
  
  let activeShiftName = 'Primero';
  let normalTarget = line.shift1_target;

  const s1 = line.shift1_start;
  const s2 = line.shift2_start;
  const s3 = line.shift3_start;

  // Handles shift wraps around midnight
  if (s2 > s1) {
    if (nowStr >= s1 && nowStr < s2) {
      activeShiftName = 'Primero';
      normalTarget = line.shift1_target;
    } else if (nowStr >= s2 && nowStr < s3) {
      activeShiftName = 'Segundo';
      normalTarget = line.shift2_target;
    } else {
      activeShiftName = 'Tercero';
      normalTarget = line.shift3_target;
    }
  } else {
    // Edge-cases fallback
    activeShiftName = 'Primero';
    normalTarget = line.shift1_target;
  }

  // Check if lunch coverage is active
  const coverages = loadTable('coberturas').filter(c => c.line_id === lineId);
  for (const cov of coverages) {
    if (nowStr >= cov.start_time && nowStr <= cov.end_time) {
      return { target: cov.required_operators, isCoverageActive: true, coverageDetails: cov, activeShiftName };
    }
  }

  // Fallback if normalTarget is 0 or undefined
  if (!normalTarget || normalTarget <= 0) {
    const posiciones = loadTable('posiciones').filter(p => p.line_id === lineId);
    if (posiciones.length > 0) {
      normalTarget = posiciones.length;
    } else {
      normalTarget = 6;
    }
  }

  return { target: normalTarget, isCoverageActive: false, activeShiftName };
};

// Automatic Shift Ticker Checker (Arranque Automático)
if (typeof window !== 'undefined') {
  let lastCheckedTime = '';
  
  setInterval(() => {
    const now = new Date();
    const nowStr = now.toTimeString().split(' ')[0].substring(0, 5); // "HH:MM"
    
    if (nowStr === lastCheckedTime) return;
    lastCheckedTime = nowStr;
    
    const lineas = loadTable('lineas');
    const escaneosList = loadTable('escaneos');
    const events = loadTable('historial_eventos');
    const tiemposMuertosList = loadTable('tiempos_muertos');
    
    let changeMade = false;
    
    lineas.forEach(line => {
      // Check if current time matches shift 1, 2, or 3 start times (HH:MM)
      const s1 = line.shift1_start.substring(0, 5);
      const s2 = line.shift2_start.substring(0, 5);
      const s3 = line.shift3_start.substring(0, 5);
      
      let matchedShiftName = '';
      let matchedTarget = 0;
      
      if (nowStr === s1) { matchedShiftName = 'Primero'; matchedTarget = line.shift1_target; }
      else if (nowStr === s2) { matchedShiftName = 'Segundo'; matchedTarget = line.shift2_target; }
      else if (nowStr === s3) { matchedShiftName = 'Tercero'; matchedTarget = line.shift3_target; }
      
      if (matchedShiftName) {
        changeMade = true;
        // 1. Log Shift Start Event
        const shiftEvent = {
          id: Math.random().toString(36).substring(2, 11),
          event_type: 'inicio_turno',
          line_id: line.id,
          description: `Inicio automático de turno ${matchedShiftName} para ${line.name}. Meta: ${matchedTarget} operadores.`,
          timestamp: new Date().toISOString()
        };
        events.push(shiftEvent);
        
        // 2. Clear present scans for today on this line (operators checkout)
        // For simulation, we remove today's check-ins to reset assistance count
        const remainingScans = escaneosList.filter(s => s.line_id !== line.id);
        saveTable('escaneos', remainingScans);
        
        // 3. Reset line status to FALTA PERSONAL
        line.status = 'FALTA PERSONAL';
        
        // 4. Close any open downtime logs
        tiemposMuertosList.forEach((log: any) => {
          if (log.line_id === line.id && !log.resolved) {
            log.end_time = new Date().toISOString();
            log.duration_minutes = Math.max(1, Math.round((new Date().getTime() - new Date(log.start_time).getTime()) / 60000));
            log.resolved = true;
          }
        });
        
        // Open a new downtime log for the new shift
        const newLog = {
          id: Math.random().toString(36).substring(2, 11),
          line_id: line.id,
          start_time: new Date().toISOString(),
          end_time: null,
          duration_minutes: null,
          date: new Date().toISOString().split('T')[0],
          resolved: false,
          created_at: new Date().toISOString()
        };
        tiemposMuertosList.push(newLog);
      }
    });
    
    if (changeMade) {
      saveTable('lineas', lineas);
      saveTable('historial_eventos', events);
      saveTable('tiempos_muertos', tiemposMuertosList);
      
      // Dispatch overall updates
      dispatchDbChange('lineas', 'UPDATE', {});
      dispatchDbChange('historial_eventos', 'INSERT', {});
      dispatchDbChange('tiempos_muertos', 'INSERT', {});
    }
  }, 10000); // Check every 10 seconds
}

// Mock Query Builder
class MockSupabaseQuery {
  private tableName: string;
  private action: 'select' | 'insert' | 'update' | 'delete' = 'select';
  private payload: any = null;
  private filters: ((item: any) => boolean)[] = [];
  private orderByColumn: string | null = null;
  private orderByAscending = true;

  constructor(tableName: string) {
    this.tableName = tableName;
  }

  select(_queryStr = '*') {
    this.action = 'select';
    return this;
  }

  insert(payload: any) {
    this.action = 'insert';
    this.payload = payload;
    return this;
  }

  update(payload: any) {
    this.action = 'update';
    this.payload = payload;
    return this;
  }

  delete() {
    this.action = 'delete';
    return this;
  }

  eq(column: string, value: any) {
    this.filters.push((item) => item[column] === value);
    return this;
  }

  neq(column: string, value: any) {
    this.filters.push((item) => item[column] !== value);
    return this;
  }

  in(column: string, values: any[]) {
    this.filters.push((item) => values.includes(item[column]));
    return this;
  }

  gte(column: string, value: any) {
    this.filters.push((item) => {
      const fieldVal = item[column];
      if (typeof fieldVal === 'string' && typeof value === 'string') {
        return fieldVal.localeCompare(value) >= 0;
      }
      return fieldVal >= value;
    });
    return this;
  }

  lte(column: string, value: any) {
    this.filters.push((item) => {
      const fieldVal = item[column];
      if (typeof fieldVal === 'string' && typeof value === 'string') {
        return fieldVal.localeCompare(value) <= 0;
      }
      return fieldVal <= value;
    });
    return this;
  }

  order(column: string, { ascending = true } = {}) {
    this.orderByColumn = column;
    this.orderByAscending = ascending;
    return this;
  }

  async executeQuery() {
    let data = loadTable(this.tableName);

    if (this.action === 'select') {
      let result = data.filter(item => this.filters.every(f => f(item)));

      if (this.orderByColumn) {
        result.sort((a, b) => {
          const valA = a[this.orderByColumn!];
          const valB = b[this.orderByColumn!];
          
          if (valA === undefined || valA === null) return 1;
          if (valB === undefined || valB === null) return -1;
          
          if (valA < valB) return this.orderByAscending ? -1 : 1;
          if (valA > valB) return this.orderByAscending ? 1 : -1;
          return 0;
        });
      }

      // Joins simulations
      if (this.tableName === 'lineas') {
        const areas = loadTable('areas');
        result = result.map(line => ({
          ...line,
          area: areas.find((a: any) => a.id === line.area_id)
        }));
      } else if (this.tableName === 'empleados_linea') {
        const empleados = loadTable('empleados');
        result = result.map(el => ({
          ...el,
          empleado: empleados.find((e: any) => e.id === el.employee_id)
        }));
      } else if (this.tableName === 'escaneos') {
        const lineas = loadTable('lineas');
        result = result.map(scan => ({
          ...scan,
          linea: lineas.find((l: any) => l.id === scan.line_id)
        }));
      } else if (this.tableName === 'tiempos_muertos') {
        const lineas = loadTable('lineas');
        result = result.map(log => ({
          ...log,
          linea: lineas.find((l: any) => l.id === log.line_id)
        }));
      } else if (this.tableName === 'posiciones') {
        const lineas = loadTable('lineas');
        const empleados = loadTable('empleados');
        result = result.map(pos => ({
          ...pos,
          linea: lineas.find((l: any) => l.id === pos.line_id),
          empleado: empleados.find((e: any) => e.id === pos.employee_id)
        }));
      }

      return { data: result, error: null };
    }

    if (this.action === 'insert') {
      const itemsToInsert = Array.isArray(this.payload) ? this.payload : [this.payload];

      // If table is escaneos, execute scan validation check
      if (this.tableName === 'escaneos') {
        const item = itemsToInsert[0];
        const badgeId = item.badge_id;
        const lineId = item.line_id;
        
        const empleados = loadTable('empleados');
        const emp = empleados.find((e: any) => e.badge_id === badgeId);
        
        if (!emp) {
          // Log failed scan: Badge not found
          const scanRecord = {
            id: Math.random().toString(36).substring(2, 11),
            badge_id: badgeId,
            employee_name: 'Desconocido',
            line_id: lineId,
            event_time: new Date().toISOString(),
            event_type: item.event_type || 'shift_start',
            was_successful: false,
            error_message: 'Empleado no existe en el catálogo',
            created_at: new Date().toISOString()
          };
          data.push(scanRecord);
          saveTable('escaneos', data);
          dispatchDbChange('escaneos', 'INSERT', scanRecord);
          
          return { data: scanRecord, error: { message: 'Empleado no existe en el catálogo' } };
        }

        // Check line assignment template
        const assignments = loadTable('empleados_linea');
        const isAssigned = assignments.some((a: any) => a.employee_id === emp.id && a.line_id === lineId);
        
        const scanRecord = {
          id: Math.random().toString(36).substring(2, 11),
          badge_id: emp.badge_id,
          employee_name: emp.name,
          line_id: lineId,
          event_time: new Date().toISOString(),
          event_type: item.event_type || 'shift_start',
          was_successful: isAssigned,
          error_message: isAssigned ? null : 'Empleado no asignado a esta línea',
          created_at: new Date().toISOString()
        };

        data.push(scanRecord);
        saveTable('escaneos', data);
        dispatchDbChange('escaneos', 'INSERT', scanRecord);

        // Record history event
        const events = loadTable('historial_eventos');
        const linesList = loadTable('lineas');
        const lineName = linesList.find((l: any) => l.id === lineId)?.name || 'N/A';

        if (!isAssigned) {
          const failEvent = {
            id: Math.random().toString(36).substring(2, 11),
            event_type: 'escaneo_fallido',
            line_id: lineId,
            description: `Intento fallido de escaneo: ${emp.name} (${emp.badge_id}) no asignado a ${lineName}`,
            timestamp: new Date().toISOString()
          };
          events.push(failEvent);
          saveTable('historial_eventos', events);
          dispatchDbChange('historial_eventos', 'INSERT', failEvent);

          return { data: scanRecord, error: { message: 'Empleado no asignado a esta línea' } };
        } else {
          let actionStr = 'Ingresó a línea';
          if (item.event_type === 'lunch_start') actionStr = 'Salida a comedor';
          if (item.event_type === 'lunch_return') actionStr = 'Regreso de comedor';
          if (item.event_type === 'shift_end') actionStr = 'Salida de turno';

          const successEvent = {
            id: Math.random().toString(36).substring(2, 11),
            event_type: 'escaneo',
            line_id: lineId,
            description: `${emp.name} (${emp.badge_id}) escaneó: ${actionStr} en ${lineName}`,
            timestamp: new Date().toISOString()
          };
          events.push(successEvent);
          saveTable('historial_eventos', events);
          dispatchDbChange('historial_eventos', 'INSERT', successEvent);

          // Recalculate Andon values
          recalculateLineState(lineId);
          return { data: scanRecord, error: null };
        }
      }

      // Standard insert
      const newItems = itemsToInsert.map(item => ({
        id: item.id || Math.random().toString(36).substring(2, 11),
        created_at: new Date().toISOString(),
        ...item
      }));
      data.push(...newItems);
      saveTable(this.tableName, data);
      
      newItems.forEach(item => {
        dispatchDbChange(this.tableName, 'INSERT', item);
        
        // Recalculate checks
        if (this.tableName === 'empleados_linea') {
          recalculateLineState(item.line_id);
        }
      });

      return { data: Array.isArray(this.payload) ? newItems : newItems[0], error: null };
    }

    if (this.action === 'update') {
      let updatedItems: any[] = [];
      data = data.map(item => {
        const matches = this.filters.every(f => f(item));
        if (matches) {
          const updated = { ...item, ...this.payload };
          updatedItems.push(updated);
          return updated;
        }
        return item;
      });
      saveTable(this.tableName, data);

      updatedItems.forEach(item => {
        dispatchDbChange(this.tableName, 'UPDATE', item);
        
        if (this.tableName === 'lineas') {
          recalculateLineState(item.id);
        }
        if (this.tableName === 'coberturas') {
          recalculateLineState(item.line_id);
        }
      });

      return { data: updatedItems, error: null, count: updatedItems.length };
    }

    if (this.action === 'delete') {
      const deletedItems = data.filter(item => this.filters.every(f => f(item)));
      const remaining = data.filter(item => !this.filters.every(f => f(item)));
      saveTable(this.tableName, remaining);

      deletedItems.forEach(item => {
        dispatchDbChange(this.tableName, 'DELETE', null, item);
        
        if (this.tableName === 'coberturas') {
          recalculateLineState(item.line_id);
        }
        if (this.tableName === 'empleados_linea') {
          recalculateLineState(item.line_id);
        }
        if (this.tableName === 'lineas') {
          // Cascade deletions to related assignments
          let ass = loadTable('empleados_linea').filter(a => a.line_id !== item.id);
          saveTable('empleados_linea', ass);
        }
      });

      return { data: deletedItems, error: null };
    }

    return { data: null, error: 'Unknown action' };
  }

  then(onfulfilled?: (value: any) => any, onrejected?: (reason: any) => any) {
    return this.executeQuery().then(onfulfilled, onrejected);
  }
}

// Simulated supabase client
const mockSupabase = {
  from(tableName: string) {
    return new MockSupabaseQuery(tableName);
  },
  channel(_name: string) {
    return new (class {
      private listeners: any[] = [];
      constructor() {}
      on(event: string, filter: any, callback: any) {
        this.listeners.push({ event, filter, callback });
        return this;
      }
      subscribe(callback?: any) {
        if (callback) setTimeout(() => callback('SUBSCRIBED'), 10);
        const handler = (e: Event) => {
          const { table, eventType, newRecord, oldRecord } = (e as CustomEvent).detail;
          this.listeners.forEach(l => {
            if (l.event === 'postgres_changes' && (!l.filter.table || l.filter.table === table)) {
              l.callback({ schema: 'public', table, eventType, new: newRecord, old: oldRecord });
            }
          });
        };
        window.addEventListener('supabase-db-change', handler);
        return {
          unsubscribe: () => {
            window.removeEventListener('supabase-db-change', handler);
          }
        };
      }
    })();
  }
};

export const realSupabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key'
);

export const supabase = isMock
  ? (mockSupabase as any)
  : realSupabase;

export interface SupabaseConnectionStatus {
  isConfigured: boolean;
  isConnected: boolean;
  message: string;
}

export async function checkSupabaseConnection(): Promise<SupabaseConnectionStatus> {
  if (!isConfigured) {
    return {
      isConfigured: false,
      isConnected: false,
      message: 'Variables VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY no configuradas en .env. Modo Demostración Local activo.'
    };
  }

  try {
    const { error } = await realSupabase.from('lineas').select('id').limit(1);
    if (error) {
      return {
        isConfigured: true,
        isConnected: false,
        message: `Error al conectar con Supabase: ${error.message}`
      };
    }
    return {
      isConfigured: true,
      isConnected: true,
      message: 'Conexión exitosa con base de datos PostgreSQL Supabase.'
    };
  } catch (err: any) {
    return {
      isConfigured: true,
      isConnected: false,
      message: `No se pudo conectar con Supabase (${err?.message || 'Error de Red'}). Usando almacenamiento local.`
    };
  }
}

export const getLocalTable = (tableName: string) => {
  return loadTable(tableName);
};

// Automated random simulator to emulate floor operator activity (checks in/out assigned workers)
if (isMock && typeof window !== 'undefined') {
  setInterval(() => {
    if (document.hidden) return;
    if (Math.random() > 0.12) return; // 12% probability every 10 seconds
    
    const lineas = loadTable('lineas');
    const assignments = loadTable('empleados_linea');
    const empleados = loadTable('empleados');
    const escaneosList = loadTable('escaneos');

    if (lineas.length === 0 || assignments.length === 0) return;

    // Pick a random line assignment
    const assoc = assignments[Math.floor(Math.random() * assignments.length)];
    const emp = empleados.find(e => e.id === assoc.employee_id);
    if (!emp) return;

    // Determine current operator checkout status
    const opScans = escaneosList.filter(s => s.badge_id === emp.badge_id && s.was_successful);
    const lastScan = opScans.sort((a, b) => new Date(a.event_time).getTime() - new Date(b.event_time).getTime())[opScans.length - 1];

    let nextEventType = 'shift_start';
    if (lastScan) {
      if (lastScan.event_type === 'shift_start') {
        nextEventType = Math.random() > 0.55 ? 'lunch_start' : 'shift_end';
      } else if (lastScan.event_type === 'lunch_start') {
        nextEventType = 'lunch_return';
      } else if (lastScan.event_type === 'lunch_return') {
        nextEventType = 'shift_end';
      } else {
        nextEventType = 'shift_start';
      }
    }

    const newScan = {
      id: Math.random().toString(36).substring(2, 11),
      badge_id: emp.badge_id,
      employee_name: emp.name,
      line_id: assoc.line_id,
      event_time: new Date().toISOString(),
      event_type: nextEventType,
      was_successful: true,
      error_message: null,
      created_at: new Date().toISOString()
    };

    escaneosList.push(newScan);
    saveTable('escaneos', escaneosList);
    dispatchDbChange('escaneos', 'INSERT', newScan);

    // Event logger
    const events = loadTable('historial_eventos');
    const lineName = lineas.find(l => l.id === assoc.line_id)?.name || 'N/A';
    
    let actionStr = 'Ingresó a línea';
    if (nextEventType === 'lunch_start') actionStr = 'Salida a comedor';
    if (nextEventType === 'lunch_return') actionStr = 'Regreso de comedor';
    if (nextEventType === 'shift_end') actionStr = 'Salida de turno';

    const successEvent = {
      id: Math.random().toString(36).substring(2, 11),
      event_type: 'escaneo',
      line_id: assoc.line_id,
      description: `${emp.name} (${emp.badge_id}) escaneó: ${actionStr} en ${lineName}`,
      timestamp: new Date().toISOString()
    };
    events.push(successEvent);
    saveTable('historial_eventos', events);
    dispatchDbChange('historial_eventos', 'INSERT', successEvent);

    recalculateLineState(assoc.line_id);
  }, 12000);
}

// ============================================================
// DATA MAPPER AND PRE-INSERT VALIDATIONS FOR SUPABASE ESCANEOS
// ============================================================

export interface ScanDataPayload {
  line_id: string;
  employee_number: string;
  event_type?: string;
  was_successful?: boolean;
}

export interface SupabaseEscaneoRecord {
  badge_id: string;
  employee_name: string;
  line_id: string;
  event_time: string;
  event_type: string;
  was_successful: boolean;
}

export function validateAndMapScanInsert(payload: ScanDataPayload): {
  isValid: boolean;
  error?: string;
  mappedRecord?: SupabaseEscaneoRecord;
} {
  console.log('[SUPABASE INSERT PRE-VALIDATION]: Validando payload...', payload);

  if (!payload.line_id || !payload.line_id.trim()) {
    const errorMsg = 'Campo obligatorio faltante: line_id es requerido';
    console.error('[SUPABASE INSERT ERROR]:', errorMsg, payload);
    return { isValid: false, error: errorMsg };
  }

  if (!payload.employee_number || !payload.employee_number.trim()) {
    const errorMsg = 'Campo obligatorio faltante: número de empleado (badge_id) es requerido';
    console.error('[SUPABASE INSERT ERROR]:', errorMsg, payload);
    return { isValid: false, error: errorMsg };
  }

  const cleanBadgeId = payload.employee_number.trim();
  const cleanEventType = (payload.event_type || 'TURN_START').trim();

  // ONLY send columns that physically exist in Supabase 'escaneos' table schema:
  // id, badge_id, employee_name, line_id, event_time, event_type, was_successful
  const mappedRecord: SupabaseEscaneoRecord = {
    badge_id: cleanBadgeId,
    employee_name: `Empleado #${cleanBadgeId}`,
    line_id: payload.line_id.trim(),
    event_time: new Date().toISOString(),
    event_type: cleanEventType,
    was_successful: payload.was_successful ?? true
  };

  console.log('[SUPABASE INSERT PAYLOAD VERIFICADO]: Enviando a Supabase escaneos ->', mappedRecord);
  return { isValid: true, mappedRecord };
}

export function mapScanFromSupabase(row: any) {
  if (!row) return row;
  return {
    ...row,
    employee_number: row.badge_id || row.employee_number || 'N/A',
    scan_time: row.event_time || row.created_at || row.scan_time,
  };
}
