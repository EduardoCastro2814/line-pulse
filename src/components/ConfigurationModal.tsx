import React, { useState, useEffect, useRef } from 'react';
import { supabase, DEFAULT_SMT_LAYOUT } from '../lib/supabaseClient';
import { X, Plus, Trash2, Save, AlertCircle, Users, Clock, ShieldAlert, Upload, Move, RefreshCw, Image, Settings } from 'lucide-react';

interface ConfigurationModalProps {
  isOpen: boolean;
  onClose: () => void;
  userRole: 'admin' | 'supervisor' | 'viewer';
}

export const ConfigurationModal: React.FC<ConfigurationModalProps> = ({ isOpen, onClose, userRole }) => {
  const [activeTab, setActiveTab] = useState<'lines' | 'staff' | 'coverages' | 'layout'>('lines');
  
  // Data lists
  const [lines, setLines] = useState<any[]>([]);
  const [areas, setAreas] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [coverages, setCoverages] = useState<any[]>([]);
  const [posiciones, setPosiciones] = useState<any[]>([]);

  // Selected line
  const [selectedLineId, setSelectedLineId] = useState<string>('');

  // Editing forms states
  const [isEditingLine, setIsEditingLine] = useState(false);
  const [lineForm, setLineForm] = useState({
    id: '',
    name: '',
    area_id: '',
    process: '',
    shift1_start: '06:00:00',
    shift1_target: 6,
    shift2_start: '14:00:00',
    shift2_target: 6,
    shift3_start: '22:00:00',
    shift3_target: 4,
    layout_url: ''
  });

  // Employee form state
  const [empForm, setEmpForm] = useState({
    badge_id: '',
    name: ''
  });

  // Coverage form state
  const [covForm, setCovForm] = useState({
    id: '',
    start_time: '12:00:00',
    end_time: '12:30:00',
    required_operators: 3
  });

  // Drag & Drop Positions state for Layout tab
  const [activeDraggingPosId, setActiveDraggingPosId] = useState<string | null>(null);
  const layoutContainerRef = useRef<HTMLDivElement>(null);

  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const loadData = async () => {
    const { data: linesData } = await supabase.from('lineas').select('*');
    const { data: areasData } = await supabase.from('areas').select('*');
    const { data: empData } = await supabase.from('empleados').select('*');
    const { data: assignData } = await supabase.from('empleados_linea').select('*, empleado:empleados(*)');
    const { data: covData } = await supabase.from('coberturas').select('*');
    const { data: posData } = await supabase.from('posiciones').select('*, empleado:empleados(*)');

    if (linesData) {
      setLines(linesData);
      if (linesData.length > 0 && !selectedLineId) {
        setSelectedLineId(linesData[0].id);
      }
    }
    if (areasData) setAreas(areasData);
    if (empData) setEmployees(empData);
    if (assignData) setAssignments(assignData);
    if (covData) setCoverages(covData);
    if (posData) setPosiciones(posData);
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  // Set line form when selecting a line
  useEffect(() => {
    if (selectedLineId) {
      const line = lines.find(l => l.id === selectedLineId);
      if (line) {
        setLineForm({
          id: line.id,
          name: line.name,
          area_id: line.area_id,
          process: line.process || '',
          shift1_start: line.shift1_start || '06:00:00',
          shift1_target: line.shift1_target || 0,
          shift2_start: line.shift2_start || '14:00:00',
          shift2_target: line.shift2_target || 0,
          shift3_start: line.shift3_start || '22:00:00',
          shift3_target: line.shift3_target || 0,
          layout_url: line.layout_url || ''
        });
      }
    }
  }, [selectedLineId, lines]);

  if (!isOpen) return null;

  // Profile restrictions check
  if (userRole === 'viewer') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
        <div className="bg-white border border-[#DCE3EA] p-6 rounded-2xl w-full max-w-sm text-center shadow-2xl text-slate-800">
          <ShieldAlert className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <h3 className="text-lg font-bold tracking-wide text-slate-900">Acceso Denegado</h3>
          <p className="text-xs text-slate-500 mt-2">Sólo Administradores o Supervisores pueden abrir el panel de configuración.</p>
          <button onClick={onClose} className="mt-5 bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 px-5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer">
            Cerrar
          </button>
        </div>
      </div>
    );
  }

  // Handle line creation / update
  const handleSaveLine = async () => {
    if (!lineForm.name.trim() || !lineForm.area_id) {
      showError('Nombre de Línea y Área son requeridos.');
      return;
    }

    const payload = {
      name: lineForm.name,
      area_id: lineForm.area_id,
      process: lineForm.process,
      shift1_start: lineForm.shift1_start,
      shift1_target: Number(lineForm.shift1_target),
      shift2_start: lineForm.shift2_start,
      shift2_target: Number(lineForm.shift2_target),
      shift3_start: lineForm.shift3_start,
      shift3_target: Number(lineForm.shift3_target),
      layout_url: lineForm.layout_url
    };

    let result;
    if (isEditingLine && lineForm.id) {
      result = await supabase.from('lineas').update(payload).eq('id', lineForm.id);
    } else {
      result = await supabase.from('lineas').insert(payload);
    }

    if (result.error) {
      showError(`Error al guardar línea: ${result.error.message}`);
    } else {
      showSuccess('Línea guardada con éxito.');
      setIsEditingLine(false);
      loadData();
    }
  };

  // Delete Line
  const handleDeleteLine = async (id: string) => {
    if (!window.confirm('¿Está seguro de eliminar esta línea de producción? Se borrarán sus asignaciones, coberturas y posiciones asociadas.')) return;
    
    const { error } = await supabase.from('lineas').delete().eq('id', id);
    if (error) {
      showError(`Error al eliminar: ${error.message}`);
    } else {
      showSuccess('Línea eliminada con éxito.');
      setSelectedLineId('');
      loadData();
    }
  };

  // Upload Layout image
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      showError('Formato no soportado. Cargue JPG, PNG o WEBP.');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const dataUrl = evt.target?.result as string;
      if (dataUrl) {
        setLineForm(prev => ({ ...prev, layout_url: dataUrl }));
        await supabase.from('lineas').update({ layout_url: dataUrl }).eq('id', selectedLineId);
        showSuccess('Imagen de layout cargada y guardada correctamente.');
        loadData();
      }
    };
    reader.readAsDataURL(file);
  };

  // Reset Layout image to default SMT Blueprint
  const handleResetLayout = async () => {
    setLineForm(prev => ({ ...prev, layout_url: DEFAULT_SMT_LAYOUT }));
    await supabase.from('lineas').update({ layout_url: DEFAULT_SMT_LAYOUT }).eq('id', selectedLineId);
    showSuccess('Layout restablecido al blueprint vectorial predeterminado.');
    loadData();
  };

  // Drag & drop position handler over layout canvas
  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!activeDraggingPosId || !layoutContainerRef.current) return;

    const rect = layoutContainerRef.current.getBoundingClientRect();
    const xPercent = Math.max(2, Math.min(98, Math.round(((e.clientX - rect.left) / rect.width) * 100)));
    const yPercent = Math.max(2, Math.min(98, Math.round(((e.clientY - rect.top) / rect.height) * 100)));

    setPosiciones(prev =>
      prev.map(pos => (pos.id === activeDraggingPosId ? { ...pos, x_percent: xPercent, y_percent: yPercent } : pos))
    );
  };

  const handleCanvasMouseUp = () => {
    setActiveDraggingPosId(null);
  };

  // Add new position to line
  const handleAddPosition = () => {
    const linePositions = posiciones.filter(p => p.line_id === selectedLineId);
    const nextNum = linePositions.length + 1;
    const newPos = {
      id: Math.random().toString(36).substring(2, 11),
      line_id: selectedLineId,
      code: `POS${nextNum < 10 ? '0' + nextNum : nextNum}`,
      station_name: `Estación ${nextNum}`,
      employee_id: null,
      x_percent: 50,
      y_percent: 50
    };
    setPosiciones(prev => [...prev, newPos]);
  };

  // Save layout positions to database
  const handleSavePositions = async () => {
    const linePositions = posiciones.filter(p => p.line_id === selectedLineId);
    
    await supabase.from('posiciones').delete().eq('line_id', selectedLineId);
    
    for (const pos of linePositions) {
      await supabase.from('posiciones').insert({
        line_id: selectedLineId,
        code: pos.code,
        station_name: pos.station_name,
        employee_id: pos.employee_id || null,
        x_percent: pos.x_percent,
        y_percent: pos.y_percent
      });
    }

    showSuccess('Configuración de posiciones y mapa visual guardada correctamente.');
    loadData();
  };

  // Delete position
  const handleDeletePosition = (posId: string) => {
    setPosiciones(prev => prev.filter(p => p.id !== posId));
  };

  // Add assigned operator
  const handleAddEmployee = async () => {
    if (!empForm.badge_id.trim() || !empForm.name.trim()) {
      showError('Número de empleado y Nombre son requeridos.');
      return;
    }

    let emp = employees.find(e => e.badge_id === empForm.badge_id.trim());
    let employeeId = emp?.id;

    if (!emp) {
      const { data: newEmp, error: errEmp } = await supabase.from('empleados').insert({
        badge_id: empForm.badge_id.trim(),
        name: empForm.name.trim()
      });
      if (errEmp) {
        showError(`Error al registrar empleado: ${errEmp.message}`);
        return;
      }
      employeeId = newEmp.id;
    }

    const { error: errLink } = await supabase.from('empleados_linea').insert({
      employee_id: employeeId,
      line_id: selectedLineId
    });

    if (errLink) {
      showError('Este empleado ya está asignado a esta línea.');
    } else {
      showSuccess('Empleado asignado con éxito.');
      setEmpForm({ badge_id: '', name: '' });
      loadData();
    }
  };

  // Remove operator assignment
  const handleRemoveAssignment = async (id: string) => {
    if (!window.confirm('¿Desasignar este empleado de la línea?')) return;
    const { error } = await supabase.from('empleados_linea').delete().eq('id', id);
    if (error) {
      showError(`Error: ${error.message}`);
    } else {
      showSuccess('Empleado removido de la línea.');
      loadData();
    }
  };

  // Add lunch relief coverage
  const handleSaveCoverage = async () => {
    if (!covForm.start_time || !covForm.end_time || covForm.required_operators <= 0) {
      showError('Suministre horas y un personal requerido mayor a 0.');
      return;
    }

    const payload = {
      line_id: selectedLineId,
      start_time: covForm.start_time,
      end_time: covForm.end_time,
      required_operators: Number(covForm.required_operators)
    };

    const { error } = await supabase.from('coberturas').insert(payload);
    if (error) {
      showError(`Error: ${error.message}`);
    } else {
      showSuccess('Cobertura agregada con éxito.');
      setCovForm({ id: '', start_time: '12:00:00', end_time: '12:30:00', required_operators: 3 });
      loadData();
    }
  };

  // Remove lunch coverage
  const handleRemoveCoverage = async (id: string) => {
    if (!window.confirm('¿Eliminar esta cobertura de comedor?')) return;
    const { error } = await supabase.from('coberturas').delete().eq('id', id);
    if (error) {
      showError(`Error: ${error.message}`);
    } else {
      showSuccess('Cobertura eliminada.');
      loadData();
    }
  };

  // Helper alerts feedback
  const showError = (msg: string) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(''), 4000);
  };

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const selectedLine = lines.find(l => l.id === selectedLineId);
  const activeAssignments = assignments.filter(a => a.line_id === selectedLineId);
  const activeCoverages = coverages.filter(c => c.line_id === selectedLineId);
  const activePosiciones = posiciones.filter(p => p.line_id === selectedLineId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 transition-opacity duration-300">
      
      {/* Corporate Modal Container (SharePoint / Microsoft Forms Style) */}
      <div className="bg-white border border-[#DCE3EA] rounded-2xl w-full max-w-5xl h-[88vh] flex flex-col justify-between shadow-2xl overflow-hidden relative text-slate-800">
        
        {/* Corporate Modal Header (#005486) */}
        <div className="flex justify-between items-center px-6 py-4 bg-[#005486] text-white">
          <div className="flex items-center space-x-2.5">
            <Settings className="w-5 h-5 text-white" />
            <h2 className="text-md font-extrabold tracking-widest uppercase">⚙ Configuración de Planta y Posiciones MES</h2>
          </div>
          
          <div className="flex items-center space-x-3">
            <span className="text-[10px] bg-white/15 text-white px-2.5 py-1 rounded border border-white/20 font-bold uppercase tracking-wider font-mono">
              Rol: {userRole}
            </span>
            <button 
              onClick={onClose} 
              className="p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Feedback alerts overlay */}
        {errorMsg && (
          <div className="absolute top-16 left-6 right-6 bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-xs flex items-center gap-2 z-40 font-bold">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="absolute top-16 left-6 right-6 bg-emerald-50 border border-emerald-200 text-emerald-700 p-3 rounded-xl text-xs flex items-center gap-2 z-40 font-bold">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Modal Main Content Panel split */}
        <div className="flex-grow flex overflow-hidden">
          
          {/* LEFT COLUMN: LINES SELECTOR LIST */}
          <div className="w-64 border-r border-[#DCE3EA] flex flex-col justify-between bg-[#F5F7FA] shrink-0 overflow-y-auto">
            <div className="p-4 space-y-3">
              <span className="text-[11px] text-slate-500 uppercase tracking-widest font-bold block mb-1">Líneas de Producción</span>
              
              <div className="space-y-1.5 max-h-[50vh] overflow-y-auto pr-1">
                {lines.map(line => (
                  <div
                    key={line.id}
                    onClick={() => {
                      setSelectedLineId(line.id);
                      setIsEditingLine(true);
                    }}
                    className={`p-2.5 rounded-xl border text-left text-xs cursor-pointer transition-all flex justify-between items-center ${
                      selectedLineId === line.id 
                        ? 'bg-[#005486] text-white border-[#005486] font-bold shadow-sm' 
                        : 'bg-white border-[#DCE3EA] text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span className="truncate">{line.name}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteLine(line.id);
                      }}
                      className={`p-1 rounded cursor-pointer ${
                        selectedLineId === line.id ? 'text-white/70 hover:text-white' : 'text-slate-400 hover:text-red-600'
                      }`}
                      title="Eliminar línea"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <button
                onClick={() => {
                  setIsEditingLine(false);
                  setLineForm({
                    id: '',
                    name: 'Nueva Línea',
                    area_id: areas[0]?.id || '',
                    process: '',
                    shift1_start: '06:00:00',
                    shift1_target: 6,
                    shift2_start: '14:00:00',
                    shift2_target: 6,
                    shift3_start: '22:00:00',
                    shift3_target: 4,
                    layout_url: ''
                  });
                }}
                className="w-full flex items-center justify-center gap-1 bg-white hover:bg-slate-100 border border-[#DCE3EA] text-[#005486] py-2 rounded-xl text-xs font-bold transition-all mt-4 cursor-pointer shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                Agregar Línea
              </button>
            </div>
          </div>

          {/* RIGHT COLUMN: TABS SETTING VIEW */}
          <div className="flex-1 flex flex-col overflow-hidden bg-white">
            
            {/* View Sub-Tabs */}
            <div className="h-12 border-b border-[#DCE3EA] flex items-center px-6 space-x-6 bg-[#F5F7FA] shrink-0">
              <button
                onClick={() => setActiveTab('lines')}
                className={`text-xs font-bold tracking-wider uppercase h-full border-b-2 flex items-center cursor-pointer ${
                  activeTab === 'lines' ? 'border-[#005486] text-[#005486]' : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Parámetros Línea
              </button>
              
              <button
                onClick={() => setActiveTab('layout')}
                className={`text-xs font-bold tracking-wider uppercase h-full border-b-2 flex items-center gap-1 cursor-pointer ${
                  activeTab === 'layout' ? 'border-[#005486] text-[#005486]' : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
                disabled={!selectedLineId}
              >
                <Image className="w-3.5 h-3.5" />
                Layout y Drag & Drop
              </button>

              <button
                onClick={() => setActiveTab('staff')}
                className={`text-xs font-bold tracking-wider uppercase h-full border-b-2 flex items-center gap-1 cursor-pointer ${
                  activeTab === 'staff' ? 'border-[#005486] text-[#005486]' : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
                disabled={!selectedLineId}
              >
                <Users className="w-3.5 h-3.5" />
                Plantilla
              </button>

              <button
                onClick={() => setActiveTab('coverages')}
                className={`text-xs font-bold tracking-wider uppercase h-full border-b-2 flex items-center gap-1 cursor-pointer ${
                  activeTab === 'coverages' ? 'border-[#005486] text-[#005486]' : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
                disabled={!selectedLineId}
              >
                <Clock className="w-3.5 h-3.5" />
                Coberturas Comedor
              </button>
            </div>

            {/* TAB BODY VIEW */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {/* TAB 1: PARAMETROS LINEA */}
              {activeTab === 'lines' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-slate-600 font-bold uppercase mb-1">Nombre de Línea</label>
                      <input
                        type="text"
                        value={lineForm.name}
                        onChange={(e) => setLineForm({ ...lineForm, name: e.target.value })}
                        className="w-full bg-[#F5F7FA] border border-[#DCE3EA] rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:border-[#005486]"
                        placeholder="Ej. Línea 14"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-600 font-bold uppercase mb-1">Área de Producción</label>
                      <select
                        value={lineForm.area_id}
                        onChange={(e) => setLineForm({ ...lineForm, area_id: e.target.value })}
                        className="w-full bg-[#F5F7FA] border border-[#DCE3EA] rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:border-[#005486] cursor-pointer"
                      >
                        {areas.map(a => (
                          <option key={a.id} value={a.id}>{a.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-slate-600 font-bold uppercase mb-1">Proceso / Descripción</label>
                    <input
                      type="text"
                      value={lineForm.process}
                      onChange={(e) => setLineForm({ ...lineForm, process: e.target.value })}
                      className="w-full bg-[#F5F7FA] border border-[#DCE3EA] rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:border-[#005486]"
                      placeholder="Ej. Ensamblado SMT SIPLACE"
                    />
                  </div>

                  {/* Shifts staffing targets */}
                  <div className="bg-[#F5F7FA] border border-[#DCE3EA] p-4 rounded-xl space-y-4">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#005486] block">Metas de Operadores por Turno</span>
                    
                    <div className="grid grid-cols-3 gap-3">
                      {/* Turno 1 */}
                      <div className="bg-white p-3 rounded-xl border border-[#DCE3EA]">
                        <span className="text-[11px] font-bold text-slate-800 block mb-2">Turno 1 (Primero)</span>
                        <div className="space-y-2">
                          <div>
                            <span className="text-[9px] text-slate-500 font-bold block">Hora Inicio</span>
                            <input
                              type="time"
                              step="1"
                              value={lineForm.shift1_start}
                              onChange={(e) => setLineForm({ ...lineForm, shift1_start: e.target.value })}
                              className="w-full bg-[#F5F7FA] border border-[#DCE3EA] rounded p-1.5 text-xs text-slate-800"
                            />
                          </div>
                          <div>
                            <span className="text-[9px] text-slate-500 font-bold block">Meta Operadores</span>
                            <input
                              type="number"
                              min="0"
                              value={lineForm.shift1_target}
                              onChange={(e) => setLineForm({ ...lineForm, shift1_target: Number(e.target.value) })}
                              className="w-full bg-[#F5F7FA] border border-[#DCE3EA] rounded p-1.5 text-xs text-slate-800 font-mono font-bold"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Turno 2 */}
                      <div className="bg-white p-3 rounded-xl border border-[#DCE3EA]">
                        <span className="text-[11px] font-bold text-slate-800 block mb-2">Turno 2 (Segundo)</span>
                        <div className="space-y-2">
                          <div>
                            <span className="text-[9px] text-slate-500 font-bold block">Hora Inicio</span>
                            <input
                              type="time"
                              step="1"
                              value={lineForm.shift2_start}
                              onChange={(e) => setLineForm({ ...lineForm, shift2_start: e.target.value })}
                              className="w-full bg-[#F5F7FA] border border-[#DCE3EA] rounded p-1.5 text-xs text-slate-800"
                            />
                          </div>
                          <div>
                            <span className="text-[9px] text-slate-500 font-bold block">Meta Operadores</span>
                            <input
                              type="number"
                              min="0"
                              value={lineForm.shift2_target}
                              onChange={(e) => setLineForm({ ...lineForm, shift2_target: Number(e.target.value) })}
                              className="w-full bg-[#F5F7FA] border border-[#DCE3EA] rounded p-1.5 text-xs text-slate-800 font-mono font-bold"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Turno 3 */}
                      <div className="bg-white p-3 rounded-xl border border-[#DCE3EA]">
                        <span className="text-[11px] font-bold text-slate-800 block mb-2">Turno 3 (Tercero)</span>
                        <div className="space-y-2">
                          <div>
                            <span className="text-[9px] text-slate-500 font-bold block">Hora Inicio</span>
                            <input
                              type="time"
                              step="1"
                              value={lineForm.shift3_start}
                              onChange={(e) => setLineForm({ ...lineForm, shift3_start: e.target.value })}
                              className="w-full bg-[#F5F7FA] border border-[#DCE3EA] rounded p-1.5 text-xs text-slate-800"
                            />
                          </div>
                          <div>
                            <span className="text-[9px] text-slate-500 font-bold block">Meta Operadores</span>
                            <input
                              type="number"
                              min="0"
                              value={lineForm.shift3_target}
                              onChange={(e) => setLineForm({ ...lineForm, shift3_target: Number(e.target.value) })}
                              className="w-full bg-[#F5F7FA] border border-[#DCE3EA] rounded p-1.5 text-xs text-slate-800 font-mono font-bold"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      onClick={handleSaveLine}
                      className="flex items-center gap-1.5 bg-[#005486] hover:bg-[#00426a] text-white font-bold px-6 py-2.5 rounded-xl text-xs transition-all shadow-md cursor-pointer"
                    >
                      <Save className="w-4 h-4" />
                      <span>Guardar Parámetros</span>
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 2: LAYOUT Y DRAG & DROP POSICIONES */}
              {activeTab === 'layout' && (
                <div className="space-y-4">
                  
                  {/* Layout Image Upload Controls */}
                  <div className="bg-[#F5F7FA] border border-[#DCE3EA] p-4 rounded-xl flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 bg-white hover:bg-slate-100 text-[#005486] font-bold px-4 py-2 rounded-xl text-xs cursor-pointer border border-[#DCE3EA] transition-all shadow-sm">
                        <Upload className="w-4 h-4 text-[#005486]" />
                        <span>Cargar Layout (JPG/PNG/WEBP)</span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={handleFileUpload}
                          className="hidden"
                        />
                      </label>
                      <button
                        onClick={handleResetLayout}
                        className="flex items-center gap-1.5 bg-white hover:bg-slate-100 text-slate-700 px-3 py-2 rounded-xl text-xs font-bold border border-[#DCE3EA] cursor-pointer shadow-sm"
                        title="Restablecer blueprint por defecto"
                      >
                        <RefreshCw className="w-3.5 h-3.5 text-amber-600" />
                        <span>Restablecer Blueprint</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleAddPosition}
                        className="flex items-center gap-1.5 bg-blue-50 text-[#005486] hover:bg-blue-100 border border-blue-200 px-3.5 py-2 rounded-xl text-xs font-bold cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Agregar Posición</span>
                      </button>
                      <button
                        onClick={handleSavePositions}
                        className="flex items-center gap-1.5 bg-[#005486] hover:bg-[#00426a] text-white font-bold px-5 py-2 rounded-xl text-xs shadow-md cursor-pointer"
                      >
                        <Save className="w-4 h-4" />
                        <span>Guardar Mapa Visual</span>
                      </button>
                    </div>
                  </div>

                  {/* Interactive Drag and Drop Canvas */}
                  <div className="space-y-2">
                    <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider block">
                      Arrastre los marcadores sobre el blueprint para fijar coordenadas X, Y:
                    </span>

                    <div 
                      ref={layoutContainerRef}
                      onMouseMove={handleCanvasMouseMove}
                      onMouseUp={handleCanvasMouseUp}
                      onMouseLeave={handleCanvasMouseUp}
                      className="relative w-full h-[320px] bg-[#F5F7FA] border border-[#DCE3EA] rounded-2xl overflow-hidden select-none"
                    >
                      <img 
                        src={lineForm.layout_url || DEFAULT_SMT_LAYOUT} 
                        alt="Layout blueprint"
                        className="w-full h-full object-contain pointer-events-none opacity-90"
                      />

                      {/* Interactive Drag Pins */}
                      {activePosiciones.map((pos) => (
                        <div
                          key={pos.id}
                          style={{
                            left: `${pos.x_percent}%`,
                            top: `${pos.y_percent}%`,
                            transform: 'translate(-50%, -50%)'
                          }}
                          onMouseDown={() => setActiveDraggingPosId(pos.id)}
                          className={`absolute z-20 cursor-move transition-transform ${
                            activeDraggingPosId === pos.id ? 'scale-125 z-30' : 'hover:scale-110'
                          }`}
                        >
                          <div className="bg-white border-2 border-[#005486] px-2 py-1 rounded-lg text-center shadow-md text-slate-900">
                            <div className="flex items-center gap-1">
                              <Move className="w-3 h-3 text-[#005486]" />
                              <span className="text-[10px] font-black font-mono">{pos.code}</span>
                            </div>
                            <span className="text-[9px] font-bold block text-slate-600 max-w-[80px] truncate">
                              {pos.station_name}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Configured Positions Details List */}
                  <div className="bg-[#F5F7FA] border border-[#DCE3EA] rounded-xl p-4 space-y-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#005486] block">
                      Detalle de Estaciones y Empleados Asignados ({activePosiciones.length})
                    </span>

                    <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                      {activePosiciones.map((pos) => (
                        <div key={pos.id} className="grid grid-cols-12 gap-2 bg-white p-2.5 rounded-xl border border-[#DCE3EA] items-center text-xs">
                          {/* Code */}
                          <div className="col-span-2">
                            <input
                              type="text"
                              value={pos.code}
                              onChange={(e) => {
                                const val = e.target.value;
                                setPosiciones(prev => prev.map(p => p.id === pos.id ? { ...p, code: val } : p));
                              }}
                              className="w-full bg-[#F5F7FA] border border-[#DCE3EA] rounded p-1.5 font-mono font-bold text-slate-900"
                              placeholder="POS01"
                            />
                          </div>

                          {/* Station Name */}
                          <div className="col-span-4">
                            <input
                              type="text"
                              value={pos.station_name}
                              onChange={(e) => {
                                const val = e.target.value;
                                setPosiciones(prev => prev.map(p => p.id === pos.id ? { ...p, station_name: val } : p));
                              }}
                              className="w-full bg-[#F5F7FA] border border-[#DCE3EA] rounded p-1.5 text-slate-800"
                              placeholder="Nombre Estación"
                            />
                          </div>

                          {/* Employee Assignment */}
                          <div className="col-span-4">
                            <select
                              value={pos.employee_id || ''}
                              onChange={(e) => {
                                const val = e.target.value || null;
                                setPosiciones(prev => prev.map(p => p.id === pos.id ? { ...p, employee_id: val } : p));
                              }}
                              className="w-full bg-[#F5F7FA] border border-[#DCE3EA] rounded p-1.5 text-slate-800 cursor-pointer"
                            >
                              <option value="">Sin Asignar</option>
                              {employees.map(emp => (
                                <option key={emp.id} value={emp.id}>
                                  {emp.name} ({emp.badge_id})
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Coords preview & Delete */}
                          <div className="col-span-2 flex items-center justify-end gap-2">
                            <span className="text-[10px] font-mono text-slate-500">
                              {pos.x_percent}%,{pos.y_percent}%
                            </span>
                            <button
                              onClick={() => handleDeletePosition(pos.id)}
                              className="p-1 text-slate-400 hover:text-red-600 rounded cursor-pointer"
                              title="Eliminar posición"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              )}

              {/* TAB 3: PERSONAL ASIGNADO (PLANTILLA) */}
              {activeTab === 'staff' && (
                <div className="space-y-6">
                  
                  {/* Form to assign employee */}
                  <div className="bg-[#F5F7FA] p-4 rounded-xl border border-[#DCE3EA] space-y-4">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#005486] block">Asignar Nuevo Empleado a {selectedLine?.name}</span>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] text-slate-500 font-bold uppercase mb-1">Nº Gafete / ID</label>
                        <input
                          type="text"
                          value={empForm.badge_id}
                          onChange={(e) => setEmpForm({ ...empForm, badge_id: e.target.value })}
                          className="w-full bg-white border border-[#DCE3EA] rounded-xl p-2 text-xs text-slate-800 font-mono"
                          placeholder="Ej. 100234"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-500 font-bold uppercase mb-1">Nombre Completo</label>
                        <input
                          type="text"
                          value={empForm.name}
                          onChange={(e) => setEmpForm({ ...empForm, name: e.target.value })}
                          className="w-full bg-white border border-[#DCE3EA] rounded-xl p-2 text-xs text-slate-800"
                          placeholder="Ej. Juan Pérez"
                        />
                      </div>
                    </div>

                    <button
                      onClick={handleAddEmployee}
                      className="w-full flex items-center justify-center gap-1.5 bg-[#005486] hover:bg-[#00426a] text-white font-bold py-2 rounded-xl text-xs transition-all cursor-pointer shadow-sm"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Asignar a Plantilla</span>
                    </button>
                  </div>

                  {/* List of assigned personnel */}
                  <div className="space-y-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">Plantilla Registrada ({activeAssignments.length})</span>
                    
                    <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
                      {activeAssignments.map(assoc => (
                        <div key={assoc.id} className="p-3 bg-[#F5F7FA] border border-[#DCE3EA] rounded-xl flex items-center justify-between">
                          <div>
                            <span className="text-xs font-bold text-slate-800 block">{assoc.empleado?.name || 'Empleado'}</span>
                            <span className="text-[10px] font-mono text-slate-500 block">Gafete: #{assoc.empleado?.badge_id}</span>
                          </div>
                          <button
                            onClick={() => handleRemoveAssignment(assoc.id)}
                            className="p-1.5 bg-white hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg transition-all border border-[#DCE3EA] cursor-pointer"
                            title="Desasignar de la línea"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              )}

              {/* TAB 4: COBERTURAS COMEDOR */}
              {activeTab === 'coverages' && (
                <div className="space-y-6">
                  
                  {/* Add lunch coverage form */}
                  <div className="bg-[#F5F7FA] p-4 rounded-xl border border-[#DCE3EA] space-y-4">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#005486] block">Configurar Ventana de Alivio de Comedor</span>
                    
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[10px] text-slate-500 font-bold uppercase mb-1">Hora Inicio</label>
                        <input
                          type="time"
                          step="1"
                          value={covForm.start_time}
                          onChange={(e) => setCovForm({ ...covForm, start_time: e.target.value })}
                          className="w-full bg-white border border-[#DCE3EA] rounded-xl p-2 text-xs text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-500 font-bold uppercase mb-1">Hora Fin</label>
                        <input
                          type="time"
                          step="1"
                          value={covForm.end_time}
                          onChange={(e) => setCovForm({ ...covForm, end_time: e.target.value })}
                          className="w-full bg-white border border-[#DCE3EA] rounded-xl p-2 text-xs text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-500 font-bold uppercase mb-1">Target Requerido</label>
                        <input
                          type="number"
                          min="1"
                          value={covForm.required_operators}
                          onChange={(e) => setCovForm({ ...covForm, required_operators: Number(e.target.value) })}
                          className="w-full bg-white border border-[#DCE3EA] rounded-xl p-2 text-xs text-slate-800 font-mono font-bold"
                        />
                      </div>
                    </div>

                    <button
                      onClick={handleSaveCoverage}
                      className="w-full flex items-center justify-center gap-1.5 bg-[#005486] hover:bg-[#00426a] text-white font-bold py-2 rounded-xl text-xs transition-all cursor-pointer shadow-sm"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Agregar Regla de Cobertura</span>
                    </button>
                  </div>

                  {/* Registered coverages list */}
                  <div className="space-y-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">Coberturas Activas ({activeCoverages.length})</span>
                    
                    <div className="space-y-1.5">
                      {activeCoverages.map(cov => (
                        <div key={cov.id} className="p-3 bg-[#F5F7FA] border border-[#DCE3EA] rounded-xl flex items-center justify-between">
                          <div>
                            <span className="text-xs font-mono font-bold text-slate-800 block">
                              Horario: {cov.start_time} - {cov.end_time}
                            </span>
                            <span className="text-[10px] text-slate-500 block">
                              Meta Temporal: <strong className="text-[#005486] font-mono">{cov.required_operators} operadores</strong>
                            </span>
                          </div>
                          <button
                            onClick={() => handleRemoveCoverage(cov.id)}
                            className="p-1.5 bg-white hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg transition-all border border-[#DCE3EA] cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              )}

            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
