import React, { useState, useEffect } from 'react';
import { 
  Award, UploadCloud, Search, Trash2, ShieldCheck, 
  FileSpreadsheet, HelpCircle, CheckCircle2, AlertCircle, Edit2, Plus, X,
  Activity, ShieldAlert, Check, BookOpen
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase, getLocalDateString, calculateLineMetrics, mapScanFromSupabase } from '../lib/supabaseClient';

export const CompetenciesView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'matrix' | 'records' | 'validation'>('matrix');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | null; message: string }>({ type: null, message: '' });

  // Data states
  const [stations, setStations] = useState<string[]>([]);
  const [requirements, setRequirements] = useState<any[]>([]);
  const [records, setRecords] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Editing matrix state
  const [isEditMatrixOpen, setIsEditMatrixOpen] = useState(false);
  const [editingStation, setEditingStation] = useState('');
  const [selectedTrainings, setSelectedTrainings] = useState<string[]>([]);
  const [newTrainingInput, setNewTrainingInput] = useState('');
  const [customStationName, setCustomStationName] = useState('');
  const [isAddStationOpen, setIsAddStationOpen] = useState(false);

  // Available trainings list (gathered from records and requirements)
  const [availableTrainings, setAvailableTrainings] = useState<string[]>([]);

  // Validation tab states
  const [linesList, setLinesList] = useState<any[]>([]);
  const [selectedLineIdValidation, setSelectedLineIdValidation] = useState<string>('');
  const [validationData, setValidationData] = useState<any>(null);

  // Load foundational data
  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Fetch positions to gather all unique station names configured on lines
      const { data: posData } = await supabase.from('posiciones').select('station_name');
      const positionsStations = posData ? posData.map((p: any) => p.station_name).filter(Boolean) : [];
      
      // Standard initial stations
      const defaultStations = ['Stencil', 'SPI', 'Siplace 01', 'Siplace 02', 'AOI', 'Horno Reflow', 'Rayos X', 'Empaque', 'Test'];
      
      // Combine and get distinct
      const allDistinctStations = Array.from(new Set([...defaultStations, ...positionsStations]));
      setStations(allDistinctStations);

      // 2. Fetch station requirements
      const { data: reqData } = await supabase.from('station_requirements').select('*');
      setRequirements(reqData || []);

      // 3. Fetch training records
      const { data: recData } = await supabase.from('training_records').select('*').order('created_at', { ascending: false });
      setRecords(recData || []);

      // 4. Fetch lines for validation
      const { data: linesData } = await supabase.from('lineas').select('*').order('name', { ascending: true });
      setLinesList(linesData || []);
      if (linesData && linesData.length > 0 && !selectedLineIdValidation) {
        setSelectedLineIdValidation(linesData[0].id);
      }

      // Gather distinct training names
      const reqTrainings = reqData ? reqData.map((r: any) => r.training_name) : [];
      const recTrainings = recData ? recData.map((r: any) => r.training_name) : [];
      const allTrainings = Array.from(new Set(['SMT Básico', 'SPI', 'Siplace', 'AOI', 'Certificación Rayos X', 'Empaque', 'Test', ...reqTrainings, ...recTrainings])).filter(Boolean);
      setAvailableTrainings(allTrainings);
    } catch (err) {
      console.error('Error loading competencies data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Run validation checker whenever tab selected or configuration changes
  const runValidation = async (lineId: string) => {
    if (!lineId) return;
    try {
      const { data: lineObj } = await supabase.from('lineas').select('*').eq('id', lineId).single();
      const { data: dbScans } = await supabase.from('escaneos').select('*').eq('line_id', lineId);
      const { data: dbPositions } = await supabase.from('posiciones').select('*, empleado:empleados(*)').eq('line_id', lineId);
      const { data: dbCoverages } = await supabase.from('coberturas').select('*').eq('line_id', lineId);

      const mappedScans = (dbScans || []).map(mapScanFromSupabase);
      const metrics = calculateLineMetrics(lineId, dbPositions || [], mappedScans, dbCoverages || [], lineObj ? [lineObj] : []);
      setValidationData(metrics);
    } catch (err) {
      console.error('Error running validation:', err);
    }
  };

  useEffect(() => {
    if (activeTab === 'validation' && selectedLineIdValidation) {
      runValidation(selectedLineIdValidation);
    }
  }, [activeTab, selectedLineIdValidation, records, requirements]);

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback({ type: null, message: '' }), 5000);
  };

  // Matrix management functions
  const handleOpenEditMatrix = (station: string) => {
    setEditingStation(station);
    const currentReqs = requirements.filter(r => r.station_name === station).map(r => r.training_name);
    setSelectedTrainings(currentReqs);
    setIsEditMatrixOpen(true);
  };

  const handleSaveMatrix = async () => {
    if (!editingStation) return;
    setLoading(true);
    try {
      // 1. Delete existing requirements for this station
      await supabase.from('station_requirements').delete().eq('station_name', editingStation);

      // 2. Insert new requirements
      if (selectedTrainings.length > 0) {
        const payload = selectedTrainings.map(t => ({
          station_name: editingStation,
          training_name: t
        }));
        const { error } = await supabase.from('station_requirements').insert(payload);
        if (error) throw error;
      }
      
      showFeedback('success', `Requerimientos guardados para la estación: ${editingStation}`);
      setIsEditMatrixOpen(false);
      loadData();
    } catch (err: any) {
      showFeedback('error', `Error al guardar matriz: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTrainingToSelection = () => {
    const trimmed = newTrainingInput.trim();
    if (!trimmed) return;
    if (!selectedTrainings.includes(trimmed)) {
      setSelectedTrainings([...selectedTrainings, trimmed]);
      if (!availableTrainings.includes(trimmed)) {
        setAvailableTrainings([...availableTrainings, trimmed]);
      }
    }
    setNewTrainingInput('');
  };

  const handleToggleTrainingSelection = (training: string) => {
    if (selectedTrainings.includes(training)) {
      setSelectedTrainings(selectedTrainings.filter(t => t !== training));
    } else {
      setSelectedTrainings([...selectedTrainings, training]);
    }
  };

  const handleAddCustomStation = () => {
    const trimmed = customStationName.trim();
    if (!trimmed) return;
    if (stations.includes(trimmed)) {
      showFeedback('error', 'La estación ya existe en la matriz.');
      return;
    }
    setStations([...stations, trimmed]);
    setCustomStationName('');
    setIsAddStationOpen(false);
    handleOpenEditMatrix(trimmed);
  };

  // 1. Station Course Requirements Matrix spreadsheet upload parser
  const handleStationMatrixUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const dataBuffer = e.target?.result;
        const workbook = XLSX.read(dataBuffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Read raw data grid as 2D array
        const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

        if (rawRows.length < 2) {
          showFeedback('error', 'El archivo debe contener al menos una fila de cabecera de estaciones y filas de cursos.');
          setLoading(false);
          return;
        }

        const headers = rawRows[0].map(h => String(h || '').trim());
        const stationHeaders = headers.slice(1);

        if (stationHeaders.length === 0) {
          showFeedback('error', 'No se encontraron columnas de estaciones configuradas en el archivo.');
          setLoading(false);
          return;
        }

        const parsedReqs: { station_name: string; training_name: string }[] = [];

        // Traverse rows starting at index 1
        for (let r = 1; r < rawRows.length; r++) {
          const row = rawRows[r];
          if (!row || row.length === 0) continue;

          // First column holds the course name/id
          const trainingName = String(row[0] || '').trim();
          if (!trainingName) continue;

          // Remaining columns hold mark checkmarks (e.g. "X") for requirements
          for (let c = 1; c < row.length; c++) {
            const cellVal = String(row[c] || '').trim().toLowerCase();
            if (cellVal === 'x' || cellVal === 'si' || cellVal === 'sí' || cellVal === 'yes' || cellVal === '1' || cellVal === '✔') {
              const stationName = headers[c];
              if (stationName) {
                parsedReqs.push({
                  station_name: stationName,
                  training_name: trainingName
                });
              }
            }
          }
        }

        if (parsedReqs.length === 0) {
          showFeedback('error', 'No se pudieron extraer requerimientos. Verifique que las celdas contengan "X" o checkmarks.');
          setLoading(false);
          return;
        }

        // Delete existing requirements
        await supabase.from('station_requirements').delete().neq('id', 'placeholder-uuid');

        // Insert new parsed requirements list
        const { error } = await supabase.from('station_requirements').insert(parsedReqs);
        if (error) throw error;

        showFeedback('success', `Carga de cabecera exitosa. Se guardaron ${parsedReqs.length} requerimientos para ${Array.from(new Set(parsedReqs.map(p => p.station_name))).length} estaciones.`);
        loadData();
      } catch (err: any) {
        showFeedback('error', `Error al procesar el archivo de matriz de estaciones: ${err.message}`);
      } finally {
        setLoading(false);
        event.target.value = '';
      }
    };

    reader.readAsArrayBuffer(file);
  };

  // 2. Operator Trainings Excel/CSV Upload Parser (Supports logs list and matrix checkmark formats)
  const handleOperatorRecordsUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const dataBuffer = e.target?.result;
        const workbook = XLSX.read(dataBuffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Read raw data grid as 2D array to inspect headers
        const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

        if (rawRows.length < 2) {
          showFeedback('error', 'El archivo no contiene registros suficientes.');
          setLoading(false);
          return;
        }

        const headers = rawRows[0].map(h => String(h || '').trim().toLowerCase());
        
        // Check if list log format or matrix checkmark format
        const isListFormat = headers.includes('curso') || headers.includes('entrenamiento') || headers.includes('training') || headers.includes('course') || headers.includes('training_name');

        let parsedRecords: {
          employee_number: string;
          employee_name: string;
          training_name: string;
          status: string;
          completion_date: string;
        }[] = [];

        if (isListFormat) {
          // List log format (row-by-row log)
          const jsonRows = XLSX.utils.sheet_to_json(worksheet);
          const mapRow = (row: any) => {
            const keys = Object.keys(row);
            const getVal = (synonyms: string[]) => {
              const matchKey = keys.find(k => synonyms.includes(k.toLowerCase().trim()));
              return matchKey ? String(row[matchKey]).trim() : '';
            };

            return {
              employee_number: getVal(['número empleado', 'numero empleado', 'número', 'numero', 'badge', 'badge id', 'employee number', 'employee_number', 'gafete', 'gafete id']),
              employee_name: getVal(['nombre', 'nombre empleado', 'nombre completo', 'name', 'employee name', 'employee_name']),
              training_name: getVal(['curso', 'entrenamiento', 'capacitacion', 'capacitación', 'training', 'course', 'training_name']),
              completion_date: getVal(['fecha', 'fecha completado', 'fecha curso', 'date', 'completion date', 'completion_date']),
              status: getVal(['estado', 'estatus', 'status', 'completado'])
            };
          };

          parsedRecords = jsonRows.map(mapRow)
            .filter(r => r.employee_number && r.training_name)
            .map(r => ({
              employee_number: r.employee_number,
              employee_name: r.employee_name || `Empleado #${r.employee_number}`,
              training_name: r.training_name,
              status: r.status || 'Completado',
              completion_date: r.completion_date || getLocalDateString(new Date())
            }));
        } else {
          // Matrix checkmark format
          // Col 0 holds Empleado ID / Badge, Cols 1..n hold course headers
          const courseHeaders = rawRows[0].slice(1).map(c => String(c || '').trim());

          for (let r = 1; r < rawRows.length; r++) {
            const row = rawRows[r];
            if (!row || row.length === 0) continue;

            const empNum = String(row[0] || '').trim();
            if (!empNum) continue;

            const empName = `Empleado #${empNum}`;

            for (let c = 1; c < row.length; c++) {
              const cellVal = String(row[c] || '').trim().toLowerCase();
              if (cellVal === 'x' || cellVal === 'si' || cellVal === 'sí' || cellVal === 'yes' || cellVal === '1' || cellVal === '✔') {
                const trainingName = courseHeaders[c - 1];
                if (trainingName) {
                  parsedRecords.push({
                    employee_number: empNum,
                    employee_name: empName,
                    training_name: trainingName,
                    status: 'Completado',
                    completion_date: getLocalDateString(new Date())
                  });
                }
              }
            }
          }
        }

        if (parsedRecords.length === 0) {
          showFeedback('error', 'No se pudieron extraer registros. Compruebe la estructura y cabeceras del archivo.');
          setLoading(false);
          return;
        }

        let updatedCount = 0;
        let insertedCount = 0;

        for (const record of parsedRecords) {
          // Verify and save to Supabase / Local Storage
          const { data: existing } = await supabase
            .from('training_records')
            .select('*')
            .eq('employee_number', record.employee_number)
            .eq('training_name', record.training_name);

          if (existing && existing.length > 0) {
            const { error } = await supabase
              .from('training_records')
              .update({
                employee_name: record.employee_name,
                status: record.status,
                completion_date: record.completion_date
              })
              .eq('employee_number', record.employee_number)
              .eq('training_name', record.training_name);
            if (!error) updatedCount++;
          } else {
            const { error } = await supabase
              .from('training_records')
              .insert(record);
            if (!error) insertedCount++;
          }
        }

        showFeedback('success', `Importación exitosa. Agregados: ${insertedCount}, Actualizados: ${updatedCount}`);
        loadData();
      } catch (err: any) {
        showFeedback('error', `Error al leer archivo de entrenamientos de operadores: ${err.message}`);
      } finally {
        setLoading(false);
        event.target.value = '';
      }
    };

    reader.readAsArrayBuffer(file);
  };

  const handleDeleteRecord = async (id: string) => {
    if (!window.confirm('¿Está seguro de eliminar este registro de entrenamiento?')) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('training_records').delete().eq('id', id);
      if (error) throw error;
      showFeedback('success', 'Registro eliminado correctamente.');
      loadData();
    } catch (err: any) {
      showFeedback('error', `Error al eliminar registro: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleClearAllRecords = async () => {
    if (!window.confirm('⚠️ ¿Está seguro de vaciar la tabla de entrenamientos? Se borrarán todos los registros históricos.')) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('training_records').delete().neq('id', 'placeholder-uuid');
      if (error) throw error;
      showFeedback('success', 'Se eliminaron todos los registros.');
      loadData();
    } catch (err: any) {
      showFeedback('error', `Error al vaciar registros: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Filter records
  const filteredRecords = records.filter(r => {
    const query = searchQuery.toLowerCase();
    return (
      r.employee_number.toLowerCase().includes(query) ||
      r.employee_name.toLowerCase().includes(query) ||
      r.training_name.toLowerCase().includes(query) ||
      r.status.toLowerCase().includes(query)
    );
  });

  return (
    <div className="bg-[#F5F7FA] text-slate-800 flex-grow h-full flex flex-col overflow-hidden p-4 space-y-4 select-none font-sans relative">
      {loading && (
        <div className="absolute inset-0 bg-white/40 backdrop-blur-[1px] z-50 flex items-center justify-center">
          <div className="bg-[#005486] text-white px-4 py-2 rounded-xl text-xs font-bold shadow-lg animate-pulse">
            Procesando...
          </div>
        </div>
      )}
      
      {/* 1. HEADER BAR */}
      <div className="bg-white border border-[#DCE3EA] p-4 rounded-2xl flex flex-wrap items-center justify-between gap-4 shadow-sm shrink-0">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-blue-50 text-[#005486] rounded-xl border border-blue-100">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-black text-slate-900 uppercase tracking-wider">Módulo de Competencias y Validación Operativa</h2>
            <p className="text-xs text-slate-500 font-semibold font-sans">Administración de matrices de entrenamiento y chequeos de certificación en piso.</p>
          </div>
        </div>

        {/* Tab switch buttons */}
        <div className="bg-slate-100 p-1 border border-slate-200 rounded-xl flex space-x-1">
          <button
            onClick={() => setActiveTab('matrix')}
            className={`text-xs font-bold px-4 py-2 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'matrix'
                ? 'bg-white text-[#005486] shadow-sm'
                : 'text-slate-600 hover:text-[#005486] hover:bg-white/50'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Matriz de Estaciones</span>
          </button>
          <button
            onClick={() => setActiveTab('records')}
            className={`text-xs font-bold px-4 py-2 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'records'
                ? 'bg-white text-[#005486] shadow-sm'
                : 'text-slate-600 hover:text-[#005486] hover:bg-white/50'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Entrenamientos Operadores</span>
          </button>
          <button
            onClick={() => setActiveTab('validation')}
            className={`text-xs font-bold px-4 py-2 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'validation'
                ? 'bg-white text-[#005486] shadow-sm'
                : 'text-slate-600 hover:text-[#005486] hover:bg-white/50'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Validación Operativa</span>
          </button>
        </div>
      </div>

      {/* FEEDBACK TOAST */}
      {feedback.message && (
        <div className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm shrink-0 ${
          feedback.type === 'success' ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' : 'bg-red-50 border border-red-200 text-red-700'
        }`}>
          {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* 2. TAB VIEWPORT CONTENT */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        
        {/* TAB 1: MATRIZ DE ESTACIONES */}
        {activeTab === 'matrix' && (
          <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-4 overflow-hidden">
            {/* Left section: Import tools */}
            <div className="lg:col-span-4 bg-white border border-[#DCE3EA] rounded-2xl p-5 flex flex-col justify-between shadow-sm shrink-0">
              <div className="space-y-4">
                <h3 className="text-xs font-black uppercase text-slate-900 tracking-wider">Cargar Matriz de Estaciones</h3>
                <p className="text-xs text-slate-500 leading-relaxed font-sans">
                  Importa el mapeo de cursos requeridos por estación utilizando archivos CSV o XLSX. La matriz asocia cada estación a sus habilidades requeridas.
                </p>

                {/* File Dropzone */}
                <label className="border-2 border-dashed border-[#DCE3EA] hover:border-[#005486] bg-slate-50 hover:bg-blue-50/10 rounded-2xl p-6 flex flex-col items-center text-center cursor-pointer transition-all group">
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleStationMatrixUpload}
                    className="hidden"
                  />
                  <UploadCloud className="w-10 h-10 text-slate-400 group-hover:text-[#005486] transition-all animate-bounce" />
                  <span className="text-xs font-black text-slate-700 block mt-2">Seleccionar matriz de estaciones</span>
                  <span className="text-[10px] text-slate-400 block mt-1">Soporta CSV, Excel (.xlsx, .xls)</span>
                </label>

                {/* Import Template Guidelines */}
                <div className="bg-[#F8FAFC] border border-slate-200 rounded-xl p-3 text-[11px] text-slate-600 space-y-2 font-sans">
                  <span className="font-bold text-slate-800 block">Estructura esperada:</span>
                  <div className="grid grid-cols-4 gap-1 font-mono font-bold bg-white p-1.5 border rounded border-slate-100 text-center text-[10px]">
                    <div className="bg-blue-50 text-[#005486] rounded p-0.5" title="Nombre del curso">Curso ID</div>
                    <div className="bg-slate-50 text-slate-700 rounded p-0.5">AOI</div>
                    <div className="bg-slate-50 text-slate-700 rounded p-0.5">DEK</div>
                    <div className="bg-slate-50 text-slate-700 rounded p-0.5">P&P</div>
                  </div>
                  <ul className="list-disc pl-4 space-y-1 text-slate-500 text-[10px]">
                    <li>Columnas representan las estaciones.</li>
                    <li>Fila 1 son los nombres (ej: AOI, DEK).</li>
                    <li>Marcar con <strong>X</strong> los requeridos.</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Right section: Station Grid layout */}
            <div className="lg:col-span-8 bg-white border border-[#DCE3EA] rounded-2xl flex flex-col overflow-hidden shadow-sm">
              <div className="p-3 border-b border-[#DCE3EA] bg-[#F5F7FA] flex items-center justify-between gap-2 shrink-0">
                <span className="text-xs font-black uppercase text-slate-800 tracking-wider">Estaciones e Habilidades Requeridas ({stations.length})</span>
                <button
                  onClick={() => setIsAddStationOpen(true)}
                  className="bg-[#005486] hover:bg-[#003f66] text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Agregar Estación</span>
                </button>
              </div>

              <div className="flex-grow overflow-y-auto p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {stations.map(station => {
                    const reqs = requirements.filter(r => r.station_name === station).map(r => r.training_name);
                    return (
                      <div 
                        key={station}
                        className="border border-[#DCE3EA] rounded-2xl p-4 flex flex-col justify-between hover:shadow-md bg-white transition-all group"
                      >
                        <div>
                          <div className="flex justify-between items-center border-b border-slate-100 pb-2 mb-2">
                            <span className="font-mono font-black text-slate-900 uppercase tracking-wide">{station}</span>
                            <span className="text-[10px] bg-blue-50 text-[#005486] font-bold px-2 py-0.5 rounded-md">
                              {reqs.length} Curso{reqs.length === 1 ? '' : 's'}
                            </span>
                          </div>

                          {reqs.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5 my-2">
                              {reqs.map(r => (
                                <span key={r} className="text-[10px] bg-slate-100 text-slate-700 font-semibold px-2.5 py-0.5 rounded-lg border border-slate-200">
                                  {r}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <div className="text-xs text-slate-400 italic py-2 flex items-center gap-1">
                              <HelpCircle className="w-3.5 h-3.5" />
                              <span>Sin entrenamientos configurados</span>
                            </div>
                          )}
                        </div>

                        <button
                          onClick={() => handleOpenEditMatrix(station)}
                          className="mt-3 w-full border border-slate-200 hover:border-[#005486] text-slate-600 hover:text-[#005486] py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 bg-[#F8FAFC] hover:bg-blue-50/30"
                        >
                          <Edit2 className="w-3 h-3" />
                          <span>Configurar Entrenamientos</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: ENTRENAMIENTOS OPERADORES */}
        {activeTab === 'records' && (
          <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-4 overflow-hidden">
            {/* Left section: Import tools */}
            <div className="lg:col-span-4 bg-white border border-[#DCE3EA] rounded-2xl p-5 flex flex-col justify-between shadow-sm shrink-0">
              <div className="space-y-4 font-sans">
                <h3 className="text-xs font-black uppercase text-slate-900 tracking-wider">Cargar Entrenamientos</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Carga el historial de capacitación y certificaciones de los operadores. Soporta tanto listas horizontales como matrices de entrenamientos.
                </p>

                {/* File Dropzone */}
                <label className="border-2 border-dashed border-[#DCE3EA] hover:border-[#005486] bg-slate-50 hover:bg-blue-50/10 rounded-2xl p-6 flex flex-col items-center text-center cursor-pointer transition-all group">
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleOperatorRecordsUpload}
                    className="hidden"
                  />
                  <UploadCloud className="w-10 h-10 text-slate-400 group-hover:text-[#005486] transition-all animate-bounce" />
                  <span className="text-xs font-black text-slate-700 block mt-2">Seleccionar archivo de personal</span>
                  <span className="text-[10px] text-slate-400 block mt-1">Soporta CSV, Excel (.xlsx, .xls)</span>
                </label>

                {/* Import Template Guidelines */}
                <div className="bg-[#F8FAFC] border border-slate-200 rounded-xl p-3 text-[11px] text-slate-600 space-y-2">
                  <span className="font-bold text-slate-800 block">Estructura matriz aceptada:</span>
                  <div className="grid grid-cols-4 gap-1 font-mono font-bold bg-white p-1.5 border rounded border-slate-100 text-center text-[10px]">
                    <div className="bg-blue-50 text-[#005486] rounded p-0.5">#Empleado</div>
                    <div className="bg-slate-50 text-slate-700 rounded p-0.5">CursoA</div>
                    <div className="bg-slate-50 text-slate-700 rounded p-0.5">CursoB</div>
                    <div className="bg-slate-50 text-slate-700 rounded p-0.5">CursoC</div>
                  </div>
                  <span className="font-bold text-slate-800 block">O estructura de lista simple:</span>
                  <div className="grid grid-cols-4 gap-1 font-mono font-bold bg-white p-1.5 border rounded border-slate-100 text-center text-[10px]">
                    <div className="bg-blue-50 text-[#005486] rounded p-0.5">Gafete</div>
                    <div className="bg-slate-50 text-slate-700 rounded p-0.5">Nombre</div>
                    <div className="bg-blue-50 text-[#005486] rounded p-0.5">Curso</div>
                    <div className="bg-slate-50 text-slate-700 rounded p-0.5">Estado</div>
                  </div>
                </div>
              </div>

              <button
                onClick={handleClearAllRecords}
                className="mt-6 w-full bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>Vaciar Catálogo de Historial</span>
              </button>
            </div>

            {/* Right section: History records table */}
            <div className="lg:col-span-8 bg-white border border-[#DCE3EA] rounded-2xl flex flex-col overflow-hidden shadow-sm">
              <div className="p-3 border-b border-[#DCE3EA] bg-[#F5F7FA] flex items-center justify-between gap-3 shrink-0 flex-wrap">
                <span className="text-xs font-black uppercase text-slate-800 tracking-wider">Historial de Certificaciones ({filteredRecords.length})</span>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar operador, curso..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-48 sm:w-56 bg-white border border-[#DCE3EA] rounded-lg pl-8 pr-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-[#005486]"
                  />
                </div>
              </div>

              <div className="flex-grow overflow-y-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-[#F5F7FA] border-b border-[#DCE3EA] sticky top-0 z-10 font-bold uppercase text-slate-600 text-[10px]">
                    <tr>
                      <th className="py-2.5 px-4">Gafete</th>
                      <th className="py-2.5 px-4">Nombre</th>
                      <th className="py-2.5 px-4">Curso</th>
                      <th className="py-2.5 px-4">Fecha</th>
                      <th className="py-2.5 px-4">Estado</th>
                      <th className="py-2.5 px-4 text-right">⚙</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#DCE3EA] font-mono">
                    {filteredRecords.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 px-4 text-center text-slate-400 italic">
                          No se encontraron registros de entrenamientos
                        </td>
                      </tr>
                    ) : (
                      filteredRecords.map(rec => (
                        <tr key={rec.id} className="hover:bg-slate-50/50">
                          <td className="py-2.5 px-4 font-bold text-slate-900">{rec.employee_number}</td>
                          <td className="py-2.5 px-4 text-slate-700 font-sans font-semibold">{rec.employee_name}</td>
                          <td className="py-2.5 px-4 text-slate-800 font-sans font-bold">{rec.training_name}</td>
                          <td className="py-2.5 px-4 text-slate-600">{rec.completion_date}</td>
                          <td className="py-2.5 px-4">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              rec.status.toLowerCase() === 'completado' 
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}>
                              {rec.status}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-right">
                            <button
                              onClick={() => handleDeleteRecord(rec.id)}
                              className="p-1 bg-red-50 hover:bg-red-100 text-red-500 rounded border border-red-200 transition-all cursor-pointer"
                              title="Eliminar registro"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: VALIDACIÓN OPERATIVA */}
        {activeTab === 'validation' && (
          <div className="w-full bg-white border border-[#DCE3EA] rounded-2xl flex flex-col overflow-hidden shadow-sm">
            
            {/* Toolbar for selecting active line */}
            <div className="p-4 border-b border-[#DCE3EA] bg-[#F5F7FA] flex items-center justify-between gap-4 shrink-0 flex-wrap">
              <div className="flex items-center space-x-3">
                <BookOpen className="w-5 h-5 text-[#005486]" />
                <div>
                  <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">Dashboard de Validación y Cobertura Calificada</h3>
                  <p className="text-[10px] text-slate-500 font-semibold font-sans">Chequeo instantáneo del estado de capacitación de los operadores en tiempo real.</p>
                </div>
              </div>

              {/* Line select dropdown */}
              <div className="flex items-center space-x-2">
                <label className="text-xs font-black text-slate-700 uppercase tracking-wide">Seleccionar Línea:</label>
                <select
                  value={selectedLineIdValidation}
                  onChange={(e) => setSelectedLineIdValidation(e.target.value)}
                  className="bg-white border border-[#DCE3EA] rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-[#005486] min-w-[160px]"
                >
                  <option value="">Seleccione...</option>
                  {linesList.map(l => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Validation content viewport */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {!selectedLineIdValidation ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 py-16">
                  <Activity className="w-12 h-12 mb-2 animate-pulse" />
                  <span className="text-xs italic font-semibold">Seleccione una línea de producción para iniciar la validación</span>
                </div>
              ) : !validationData ? (
                <div className="py-12 text-center text-xs text-slate-400 italic">Cargando validaciones...</div>
              ) : (
                <div className="space-y-4">
                  
                  {/* Metric compliance cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                    <div className="bg-white border border-[#DCE3EA] rounded-2xl p-4 shadow-sm flex flex-col justify-between">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Eficiencia Calificada</span>
                      <span className="text-2xl font-black font-mono text-[#005486] block mt-1">{validationData.qualifiedCoveragePct}%</span>
                      <span className="text-[10px] font-bold text-slate-400 mt-1 block">Operadores certificados / Meta</span>
                    </div>
                    <div className="bg-white border border-[#DCE3EA] rounded-2xl p-4 shadow-sm flex flex-col justify-between">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Meta Plantilla</span>
                      <span className="text-2xl font-black font-mono text-slate-800 block mt-1">{validationData.target}</span>
                      <span className="text-[10px] font-bold text-slate-400 mt-1 block">Posiciones requeridas</span>
                    </div>
                    <div className="bg-white border border-[#DCE3EA] rounded-2xl p-4 shadow-sm flex flex-col justify-between">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Personal Presente</span>
                      <span className="text-2xl font-black font-mono text-emerald-600 block mt-1">{validationData.scannedCount}</span>
                      <span className="text-[10px] font-bold text-slate-400 mt-1 block">Escaneos válidos hoy</span>
                    </div>
                    <div className="bg-white border border-[#DCE3EA] rounded-2xl p-4 shadow-sm flex flex-col justify-between">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Certificados</span>
                      <span className="text-2xl font-black font-mono text-emerald-600 block mt-1">{validationData.certifiedCount}</span>
                      <span className="text-[10px] font-bold text-slate-400 mt-1 block">Cumplen entrenamientos</span>
                    </div>
                    <div className="bg-white border border-[#DCE3EA] rounded-2xl p-4 shadow-sm flex flex-col justify-between">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">No Certificados</span>
                      <span className="text-2xl font-black font-mono text-amber-500 block mt-1">{validationData.uncertifiedCount}</span>
                      <span className="text-[10px] font-bold text-slate-400 mt-1 block">Faltan entrenamientos</span>
                    </div>
                  </div>

                  {/* compliance detail layout grid */}
                  <div className="space-y-3 pt-2">
                    <span className="text-xs font-black uppercase text-slate-800 tracking-wider block">Estado por Estación del Layout</span>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                      {Object.keys(validationData.positionsDetails || {}).map(posId => {
                        const detail = validationData.positionsDetails[posId];
                        const isOccupied = detail.isPresent;
                        const isCertified = detail.isCertified;
                        const missing = detail.missingTrainings || [];

                        return (
                          <div 
                            key={posId}
                            className={`border rounded-2xl p-4 bg-white flex flex-col justify-between shadow-sm relative overflow-hidden transition-all hover:shadow-md ${
                              !isOccupied 
                                ? 'border-red-200 border-l-4 border-l-red-500'
                                : !isCertified
                                ? 'border-amber-200 border-l-4 border-l-amber-500 shadow-amber-50/30'
                                : 'border-emerald-200 border-l-4 border-l-emerald-500 shadow-emerald-50/30'
                            }`}
                          >
                            <div>
                              {/* Position header */}
                              <div className="flex justify-between items-center border-b border-slate-100 pb-2 mb-2.5">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono font-black text-slate-900 text-sm">{detail.code}</span>
                                  <span className="text-xs bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-lg text-slate-700 font-bold uppercase font-sans">
                                    {detail.station_name || 'Sin Asignar'}
                                  </span>
                                </div>

                                <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-lg flex items-center gap-1 font-sans ${
                                  !isOccupied
                                    ? 'bg-red-50 text-red-700 border border-red-200'
                                    : !isCertified
                                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                }`}>
                                  {!isOccupied ? 'Vacante' : !isCertified ? 'No Certificado' : 'Certificado'}
                                </span>
                              </div>

                              {/* Operator info */}
                              <div className="space-y-1 my-2">
                                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Operador de Estación</span>
                                {isOccupied && detail.employee ? (
                                  <span className="text-xs font-black text-slate-800 block">
                                    {detail.employee.name} <span className="font-mono text-slate-500 font-normal">(#{detail.employee.badge_id})</span>
                                  </span>
                                ) : (
                                  <span className="text-xs text-red-500 font-semibold italic block">Estación vacante / Falta operador</span>
                                )}
                              </div>

                              {/* Training requirements check */}
                              {isOccupied && detail.employee && (
                                <div className="space-y-1.5 mt-3 pt-2.5 border-t border-slate-100">
                                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Habilidades Requeridas</span>
                                  {missing.length > 0 ? (
                                    <div className="space-y-1">
                                      <span className="text-[10px] text-red-600 font-bold block flex items-center gap-1">
                                        <ShieldAlert className="w-3.5 h-3.5" />
                                        <span>Faltan {missing.length} habilidades obligatorias:</span>
                                      </span>
                                      <div className="flex flex-wrap gap-1">
                                        {missing.map((m: string) => (
                                          <span key={m} className="text-[9px] bg-red-50 border border-red-200 text-red-600 font-bold px-2 py-0.5 rounded font-mono">
                                            {m}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  ) : (
                                    <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1 font-sans">
                                      <Check className="w-4 h-4" />
                                      <span>Cuenta con todas las habilidades requeridas</span>
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                </div>
              )}
            </div>
          </div>
        )}

      </div>

      {/* 3. MODALS */}
      {/* Configure Matrix Modal */}
      {isEditMatrixOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-white border border-[#DCE3EA] rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">
            {/* Header */}
            <div className="bg-[#005486] text-white p-4 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-300" />
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider">Requerimientos de Estación</h3>
                  <span className="text-[10px] text-white/70 block mt-0.5">Configurar entrenamientos para la estación {editingStation}</span>
                </div>
              </div>
              <button 
                onClick={() => setIsEditMatrixOpen(false)}
                className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-5 flex-grow overflow-y-auto space-y-4">
              {/* Training Checkbox Grid */}
              <div className="space-y-2">
                <label className="text-[10px] text-slate-500 font-black uppercase tracking-wider block">Cursos de Capacitación Disponibles</label>
                
                <div className="border border-[#DCE3EA] rounded-xl p-3 bg-[#F8FAFC] max-h-[220px] overflow-y-auto space-y-2">
                  {availableTrainings.map(t => {
                    const isChecked = selectedTrainings.includes(t);
                    return (
                      <label key={t} className="flex items-center gap-2.5 bg-white p-2 rounded-lg border border-[#DCE3EA] hover:border-slate-350 cursor-pointer select-none text-xs text-slate-800">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleTrainingSelection(t)}
                          className="w-4 h-4 text-[#005486] rounded border-[#DCE3EA] focus:ring-[#005486]"
                        />
                        <span className="font-bold">{t}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Add Custom Training Name Inline */}
              <div className="space-y-1.5 pt-2 border-t border-slate-100">
                <label className="text-[10px] text-slate-500 font-black uppercase tracking-wider block">Registrar Nuevo Curso a la Lista</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Ej. Certificación Rayos X..."
                    value={newTrainingInput}
                    onChange={(e) => setNewTrainingInput(e.target.value)}
                    className="flex-1 bg-[#F5F7FA] border border-[#DCE3EA] rounded-xl px-3 py-2 text-xs text-slate-800 font-bold focus:outline-none focus:border-[#005486]"
                  />
                  <button
                    onClick={handleAddTrainingToSelection}
                    className="bg-[#059669] hover:bg-[#047857] text-white px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Agregar</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-[#F5F7FA] border-t border-[#DCE3EA] flex justify-end gap-2 shrink-0">
              <button
                onClick={() => setIsEditMatrixOpen(false)}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-100 transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveMatrix}
                className="px-5 py-2 bg-[#005486] hover:bg-[#003f66] text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                <span>Guardar Cambios</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Custom Station Modal */}
      {isAddStationOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-white border border-[#DCE3EA] rounded-2xl shadow-2xl overflow-hidden">
            <div className="bg-[#005486] text-white p-4 flex justify-between items-center shrink-0">
              <span className="text-xs font-black uppercase tracking-wider">Agregar Nueva Estación</span>
              <button 
                onClick={() => setIsAddStationOpen(false)}
                className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="p-5 space-y-3">
              <label className="text-[10px] text-slate-500 font-black uppercase tracking-wider block">Nombre de Estación</label>
              <input
                type="text"
                placeholder="Ej. Rayos X, AOI, Test..."
                value={customStationName}
                onChange={(e) => setCustomStationName(e.target.value)}
                className="w-full bg-[#F5F7FA] border border-[#DCE3EA] rounded-xl px-3 py-2 text-xs text-slate-800 font-bold focus:outline-none focus:border-[#005486]"
                autoFocus
              />
            </div>

            <div className="p-4 bg-[#F5F7FA] border-t border-[#DCE3EA] flex justify-end gap-2 shrink-0">
              <button
                onClick={() => setIsAddStationOpen(false)}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-100 transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleAddCustomStation}
                className="px-5 py-2 bg-[#005486] hover:bg-[#003f66] text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Siguiente
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
