import React, { useState, useEffect } from 'react';
import { 
  Award, UploadCloud, Search, Trash2, ShieldCheck, 
  FileSpreadsheet, HelpCircle, CheckCircle2, AlertCircle, Edit2, Plus, X
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase, getLocalDateString } from '../lib/supabaseClient';

export const CompetenciesView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'matrix' | 'records'>('matrix');
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

  // File Upload Logic
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const dataBuffer = e.target?.result;
        let jsonRows: any[] = [];

        if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
          // Parse Excel binary
          const workbook = XLSX.read(dataBuffer, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          jsonRows = XLSX.utils.sheet_to_json(worksheet);
        } else if (file.name.endsWith('.csv')) {
          // Parse CSV
          const workbook = XLSX.read(dataBuffer, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          jsonRows = XLSX.utils.sheet_to_json(worksheet);
        } else {
          showFeedback('error', 'Formato de archivo no soportado. Cargue un archivo CSV o XLSX.');
          setLoading(false);
          return;
        }

        if (jsonRows.length === 0) {
          showFeedback('error', 'El archivo está vacío o no contiene registros válidos.');
          setLoading(false);
          return;
        }

        // Column mapper utility: maps Spanish/English synonyms to canonical fields
        const mapRow = (row: any) => {
          const keys = Object.keys(row);
          const getVal = (synonyms: string[]) => {
            const matchKey = keys.find(k => synonyms.includes(k.toLowerCase().trim()));
            return matchKey ? String(row[matchKey]).trim() : '';
          };

          return {
            employee_number: getVal(['número empleado', 'numero empleado', 'número', 'numero', 'badge', 'badge id', 'employee number', 'employee_number', 'gafete']),
            employee_name: getVal(['nombre', 'nombre empleado', 'nombre completo', 'name', 'employee name', 'employee_name']),
            training_name: getVal(['curso', 'entrenamiento', 'capacitacion', 'capacitación', 'training', 'course', 'training_name']),
            completion_date: getVal(['fecha', 'fecha completado', 'fecha curso', 'date', 'completion date', 'completion_date']),
            status: getVal(['estado', 'estatus', 'status', 'completado'])
          };
        };

        const parsedRecords = jsonRows.map(mapRow).filter(r => r.employee_number && r.training_name);

        if (parsedRecords.length === 0) {
          showFeedback('error', 'No se pudieron identificar las columnas requeridas (Número Empleado, Curso, Estado).');
          setLoading(false);
          return;
        }

        // Process rows in Supabase / Local Storage
        let updatedCount = 0;
        let insertedCount = 0;

        for (const row of parsedRecords) {
          const empNum = row.employee_number;
          const training = row.training_name;
          const empName = row.employee_name || `Empleado #${empNum}`;
          const status = row.status || 'Completado';
          
          // Date formatting helper
          let completionDate = getLocalDateString(new Date());
          if (row.completion_date) {
            const parsedDate = new Date(row.completion_date);
            if (!isNaN(parsedDate.getTime())) {
              completionDate = getLocalDateString(parsedDate);
            }
          }

          // Check if record exists
          const { data: existing } = await supabase
            .from('training_records')
            .select('*')
            .eq('employee_number', empNum)
            .eq('training_name', training);

          if (existing && existing.length > 0) {
            // Update
            const { error: updErr } = await supabase
              .from('training_records')
              .update({
                employee_name: empName,
                status: status,
                completion_date: completionDate
              })
              .eq('employee_number', empNum)
              .eq('training_name', training);
            
            if (!updErr) updatedCount++;
          } else {
            // Insert
            const { error: insErr } = await supabase
              .from('training_records')
              .insert({
                employee_number: empNum,
                employee_name: empName,
                training_name: training,
                status: status,
                completion_date: completionDate
              });
            
            if (!insErr) insertedCount++;
          }
        }

        showFeedback('success', `Importación exitosa. Agregados: ${insertedCount}, Actualizados: ${updatedCount}`);
        loadData();
      } catch (err: any) {
        showFeedback('error', `Error al leer el archivo: ${err.message}`);
      } finally {
        setLoading(false);
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
            <h2 className="text-base font-black text-slate-900 uppercase tracking-wider">Matriz de Competencias y Certificaciones</h2>
            <p className="text-xs text-slate-500 font-semibold">Configura requerimientos por estación de trabajo y administra el historial de entrenamiento.</p>
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
            <span>Importación e Historial</span>
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
        {activeTab === 'matrix' ? (
          <div className="w-full bg-white border border-[#DCE3EA] rounded-2xl flex flex-col overflow-hidden shadow-sm">
            
            {/* Table toolbar */}
            <div className="p-3 border-b border-[#DCE3EA] bg-[#F5F7FA] flex items-center justify-between gap-2 shrink-0">
              <span className="text-xs font-black uppercase text-slate-800 tracking-wider">Mapeo Estación → Entrenamientos Requeridos</span>
              <button
                onClick={() => setIsAddStationOpen(true)}
                className="bg-[#005486] hover:bg-[#003f66] text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Agregar Estación</span>
              </button>
            </div>

            {/* Stations list grid */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
        ) : (
          <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-4 overflow-hidden">
            
            {/* Left section: Import tools (5 cols) */}
            <div className="lg:col-span-4 bg-white border border-[#DCE3EA] rounded-2xl p-5 flex flex-col justify-between shadow-sm shrink-0">
              <div className="space-y-4">
                <h3 className="text-xs font-black uppercase text-slate-900 tracking-wider">Importar Archivo de Entrenamientos</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Carga el historial de entrenamiento de los operadores en LinePulse. El sistema leerá archivos <strong>CSV</strong> y <strong>XLSX</strong> para actualizar el catálogo.
                </p>

                {/* File Dropzone area */}
                <label className="border-2 border-dashed border-[#DCE3EA] hover:border-[#005486] bg-slate-50 hover:bg-blue-50/10 rounded-2xl p-6 flex flex-col items-center text-center cursor-pointer transition-all group">
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <UploadCloud className="w-10 h-10 text-slate-400 group-hover:text-[#005486] transition-all animate-bounce" />
                  <span className="text-xs font-black text-slate-700 block mt-2">Seleccionar o soltar archivo</span>
                  <span className="text-[10px] text-slate-400 block mt-1">Soporta CSV, Excel (.xlsx, .xls)</span>
                </label>

                {/* Import Template Guidelines */}
                <div className="bg-[#F8FAFC] border border-slate-200 rounded-xl p-3 text-[11px] text-slate-600 space-y-2">
                  <span className="font-bold text-slate-800 block">Estructura del archivo requerida:</span>
                  <div className="grid grid-cols-5 gap-1 font-mono font-bold bg-white p-1.5 border rounded border-slate-100 text-center text-[10px]">
                    <div className="bg-blue-50 text-[#005486] rounded p-0.5" title="Número empleado">Gafete</div>
                    <div className="bg-slate-50 text-slate-700 rounded p-0.5">Nombre</div>
                    <div className="bg-blue-50 text-[#005486] rounded p-0.5">Curso</div>
                    <div className="bg-slate-50 text-slate-700 rounded p-0.5">Fecha</div>
                    <div className="bg-blue-50 text-[#005486] rounded p-0.5">Estado</div>
                  </div>
                  <ul className="list-disc pl-4 space-y-1 text-slate-500">
                    <li>Se actualizarán coincidencias y agregarán nuevos registros.</li>
                    <li>No se duplicará información (clave: Empleado + Curso).</li>
                  </ul>
                </div>
              </div>

              <button
                onClick={handleClearAllRecords}
                className="mt-6 w-full bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>Vaciar Catálogo Histórico</span>
              </button>
            </div>

            {/* Right section: History records table (8 cols) */}
            <div className="lg:col-span-8 bg-white border border-[#DCE3EA] rounded-2xl flex flex-col overflow-hidden shadow-sm">
              {/* Toolbar */}
              <div className="p-3 border-b border-[#DCE3EA] bg-[#F5F7FA] flex items-center justify-between gap-3 shrink-0 flex-wrap">
                <span className="text-xs font-black uppercase text-slate-800 tracking-wider">Historial de Cursos ({filteredRecords.length})</span>
                
                <div className="relative">
                  <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar por empleado, curso..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-48 sm:w-56 bg-white border border-[#DCE3EA] rounded-lg pl-8 pr-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-[#005486]"
                  />
                </div>
              </div>

              {/* Grid content */}
              <div className="flex-1 overflow-y-auto">
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
