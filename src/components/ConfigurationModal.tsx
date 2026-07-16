import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { X, Plus, Trash2, Edit, Save, AlertCircle, Users, Clock, ShieldAlert } from 'lucide-react';

interface ConfigurationModalProps {
  isOpen: boolean;
  onClose: () => void;
  userRole: 'admin' | 'supervisor' | 'viewer';
}

export const ConfigurationModal: React.FC<ConfigurationModalProps> = ({ isOpen, onClose, userRole }) => {
  const [activeTab, setActiveTab] = useState<'lines' | 'staff' | 'coverages'>('lines');
  
  // Data lists
  const [lines, setLines] = useState<any[]>([]);
  const [areas, setAreas] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [coverages, setCoverages] = useState<any[]>([]);

  // Selected entities
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
    shift3_target: 4
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

  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const loadData = async () => {
    const { data: linesData } = await supabase.from('lineas').select('*');
    const { data: areasData } = await supabase.from('areas').select('*');
    const { data: empData } = await supabase.from('empleados').select('*');
    const { data: assignData } = await supabase.from('empleados_linea').select('*, empleado:empleados(*)');
    const { data: covData } = await supabase.from('coberturas').select('*');

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
          shift3_target: line.shift3_target || 0
        });
      }
    }
  }, [selectedLineId, lines]);

  if (!isOpen) return null;

  // Profile restrictions check
  if (userRole === 'viewer') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="bg-[#0B132B] border border-red-500/30 p-6 rounded-2xl w-full max-w-sm text-center shadow-2xl text-slate-100">
          <ShieldAlert className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <h3 className="text-lg font-bold tracking-wide">Acceso Denegado</h3>
          <p className="text-xs text-slate-400 mt-2">Sólo Administradores o Supervisores pueden abrir el panel de configuración.</p>
          <button onClick={onClose} className="mt-5 bg-red-650/20 text-red-400 border border-red-500/30 hover:bg-red-500/20 px-5 py-2 rounded-xl text-xs font-bold transition-all">
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
      shift3_target: Number(lineForm.shift3_target)
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
    if (!window.confirm('¿Está seguro de eliminar esta línea de producción? Se borrarán sus asignaciones y coberturas asociadas.')) return;
    
    const { error } = await supabase.from('lineas').delete().eq('id', id);
    if (error) {
      showError(`Error al eliminar: ${error.message}`);
    } else {
      showSuccess('Línea eliminada con éxito.');
      setSelectedLineId('');
      loadData();
    }
  };

  // Add assigned operator
  const handleAddEmployee = async () => {
    if (!empForm.badge_id.trim() || !empForm.name.trim()) {
      showError('Número de empleado y Nombre son requeridos.');
      return;
    }

    // 1. Check if employee badge exists in empleados, create if not
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

    // 2. Link employee to line
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

  // Add/edit lunch relief coberturas
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 transition-opacity duration-300">
      
      {/* Modal Container */}
      <div className="bg-[#050B18] border border-slate-800 rounded-2xl w-full max-w-4xl h-[85vh] flex flex-col justify-between shadow-2xl overflow-hidden relative text-slate-100">
        
        {/* Modal Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-850 bg-[#0B132B]">
          <div className="flex items-center space-x-2">
            <Plus className="w-5 h-5 text-emerald-400" />
            <h2 className="text-md font-extrabold tracking-widest uppercase">⚙ Configuración de Planta</h2>
          </div>
          
          <div className="flex items-center space-x-3">
            <span className="text-[10px] bg-emerald-950 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20 font-bold uppercase tracking-wider font-mono">
              Rol: {userRole}
            </span>
            <button 
              onClick={onClose} 
              className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 rounded-lg transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Feedback alerts overlay */}
        {errorMsg && (
          <div className="absolute top-16 left-6 right-6 bg-red-950/90 border border-red-500/40 text-red-400 p-3 rounded-lg text-xs flex items-center gap-2 z-30 font-bold font-mono">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="absolute top-16 left-6 right-6 bg-emerald-950/90 border border-emerald-500/40 text-emerald-400 p-3 rounded-lg text-xs flex items-center gap-2 z-30 font-bold font-mono">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Modal Main Content Panel split */}
        <div className="flex-grow flex overflow-hidden">
          
          {/* LEFT COLUMN: LINES SELECTOR LIST */}
          <div className="w-64 border-r border-slate-850 flex flex-col justify-between bg-[#0B132B]/30 shrink-0 overflow-y-auto">
            <div className="p-4 space-y-3">
              <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold block mb-1">Líneas de Producción</span>
              
              <div className="space-y-1.5 max-h-[50vh] overflow-y-auto pr-1">
                {lines.map(line => (
                  <div
                    key={line.id}
                    onClick={() => {
                      setSelectedLineId(line.id);
                      setIsEditingLine(true);
                    }}
                    className={`p-2.5 rounded-lg border text-left text-xs cursor-pointer transition-all flex justify-between items-center ${
                      selectedLineId === line.id 
                        ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-400 font-bold' 
                        : 'bg-slate-900/30 border-slate-800/40 text-slate-300 hover:bg-slate-800/40'
                    }`}
                  >
                    <span className="truncate">{line.name}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteLine(line.id);
                      }}
                      className="p-1 text-slate-500 hover:text-red-400 hover:bg-slate-800/60 rounded"
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
                    shift3_target: 4
                  });
                }}
                className="w-full flex items-center justify-center gap-1 bg-emerald-600/10 hover:bg-emerald-600/25 border border-emerald-500/20 text-emerald-400 py-2 rounded-lg text-xs font-bold transition-all mt-4"
              >
                <Plus className="w-3.5 h-3.5" />
                Agregar Línea
              </button>
            </div>
          </div>

          {/* RIGHT COLUMN: TABS SETTING VIEW */}
          <div className="flex-1 flex flex-col overflow-hidden bg-[#050B18]">
            
            {/* View Sub-Tabs */}
            <div className="h-12 border-b border-slate-850 flex items-center px-6 space-x-6 bg-[#0B132B]/35">
              <button
                onClick={() => setActiveTab('lines')}
                className={`text-xs font-bold tracking-wider uppercase h-full border-b-2 flex items-center ${
                  activeTab === 'lines' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                Parámetros Línea
              </button>
              
              <button
                onClick={() => setActiveTab('staff')}
                className={`text-xs font-bold tracking-wider uppercase h-full border-b-2 flex items-center ${
                  activeTab === 'staff' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
                disabled={!selectedLineId}
              >
                Personal Asignado
              </button>

              <button
                onClick={() => setActiveTab('coverages')}
                className={`text-xs font-bold tracking-wider uppercase h-full border-b-2 flex items-center ${
                  activeTab === 'coverages' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
                disabled={!selectedLineId}
              >
                Horarios Comedor
              </button>
            </div>

            {/* Sub-Tabs View Body */}
            <div className="flex-1 p-6 overflow-y-auto">
              
              {/* TAB 1: LINE PARAMS (shift hours and operator target) */}
              {activeTab === 'lines' && (
                <div className="space-y-5 max-w-xl">
                  <h3 className="text-sm font-bold text-slate-350 uppercase tracking-widest flex items-center gap-1.5">
                    <Edit className="w-4 h-4 text-emerald-400" />
                    Configuración de Línea
                  </h3>
                  
                  <div className="grid grid-cols-2 gap-4 bg-[#0B132B]/50 p-5 border border-slate-850 rounded-xl">
                    <div className="col-span-2">
                      <label className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block mb-1">Nombre de la Línea</label>
                      <input
                        type="text"
                        value={lineForm.name}
                        onChange={(e) => setLineForm({ ...lineForm, name: e.target.value })}
                        className="w-full bg-[#050B18] border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                        placeholder="Línea X"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block mb-1">Área</label>
                      <select
                        value={lineForm.area_id}
                        onChange={(e) => setLineForm({ ...lineForm, area_id: e.target.value })}
                        className="w-full bg-[#050B18] border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                      >
                        <option value="">Seleccione Área</option>
                        {areas.map(a => (
                          <option key={a.id} value={a.id}>{a.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block mb-1">Proceso (Opcional)</label>
                      <input
                        type="text"
                        value={lineForm.process}
                        onChange={(e) => setLineForm({ ...lineForm, process: e.target.value })}
                        className="w-full bg-[#050B18] border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                        placeholder="Ensambles SMT"
                      />
                    </div>
                  </div>

                  {/* SHIFT TARGETS CONFIG */}
                  <div className="space-y-3 bg-[#0B132B]/50 p-5 border border-slate-850 rounded-xl">
                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-widest block border-b border-slate-800 pb-1.5">Metas por Turnos</span>
                    
                    <div className="grid grid-cols-3 gap-3">
                      {/* Shift 1 */}
                      <div className="p-3 bg-[#050B18] border border-slate-800/60 rounded-lg">
                        <span className="text-[10px] font-bold text-slate-300 block mb-2">Turno 1 (Primero)</span>
                        <label className="text-[9px] text-slate-400 uppercase block mb-0.5">Inicio</label>
                        <input
                          type="text"
                          value={lineForm.shift1_start}
                          onChange={(e) => setLineForm({ ...lineForm, shift1_start: e.target.value })}
                          className="bg-black border border-slate-800 rounded w-full text-[11px] px-1.5 py-0.5 text-center text-slate-200 font-mono"
                        />
                        <label className="text-[9px] text-slate-400 uppercase block mt-2 mb-0.5">Plantilla Target</label>
                        <input
                          type="number"
                          value={lineForm.shift1_target}
                          onChange={(e) => setLineForm({ ...lineForm, shift1_target: Number(e.target.value) })}
                          className="bg-black border border-slate-800 rounded w-full text-[11px] px-1.5 py-0.5 text-center text-slate-200 font-mono"
                        />
                      </div>

                      {/* Shift 2 */}
                      <div className="p-3 bg-[#050B18] border border-slate-800/60 rounded-lg">
                        <span className="text-[10px] font-bold text-slate-300 block mb-2">Turno 2 (Segundo)</span>
                        <label className="text-[9px] text-slate-400 uppercase block mb-0.5">Inicio</label>
                        <input
                          type="text"
                          value={lineForm.shift2_start}
                          onChange={(e) => setLineForm({ ...lineForm, shift2_start: e.target.value })}
                          className="bg-black border border-slate-800 rounded w-full text-[11px] px-1.5 py-0.5 text-center text-slate-200 font-mono"
                        />
                        <label className="text-[9px] text-slate-400 uppercase block mt-2 mb-0.5">Plantilla Target</label>
                        <input
                          type="number"
                          value={lineForm.shift2_target}
                          onChange={(e) => setLineForm({ ...lineForm, shift2_target: Number(e.target.value) })}
                          className="bg-black border border-slate-800 rounded w-full text-[11px] px-1.5 py-0.5 text-center text-slate-200 font-mono"
                        />
                      </div>

                      {/* Shift 3 */}
                      <div className="p-3 bg-[#050B18] border border-slate-800/60 rounded-lg">
                        <span className="text-[10px] font-bold text-slate-300 block mb-2">Turno 3 (Tercero)</span>
                        <label className="text-[9px] text-slate-400 uppercase block mb-0.5">Inicio</label>
                        <input
                          type="text"
                          value={lineForm.shift3_start}
                          onChange={(e) => setLineForm({ ...lineForm, shift3_start: e.target.value })}
                          className="bg-black border border-slate-800 rounded w-full text-[11px] px-1.5 py-0.5 text-center text-slate-200 font-mono"
                        />
                        <label className="text-[9px] text-slate-400 uppercase block mt-2 mb-0.5">Plantilla Target</label>
                        <input
                          type="number"
                          value={lineForm.shift3_target}
                          onChange={(e) => setLineForm({ ...lineForm, shift3_target: Number(e.target.value) })}
                          className="bg-black border border-slate-800 rounded w-full text-[11px] px-1.5 py-0.5 text-center text-slate-200 font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleSaveLine}
                    className="flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-6 py-2 rounded-xl transition-all"
                  >
                    <Save className="w-4 h-4" />
                    {isEditingLine ? 'Actualizar Parámetros' : 'Crear Nueva Línea'}
                  </button>
                </div>
              )}

              {/* TAB 2: ASSIGNED STAFF (link badge ID/names to line target validation) */}
              {activeTab === 'staff' && selectedLine && (
                <div className="space-y-5">
                  <div className="flex justify-between items-center border-b border-slate-850 pb-3">
                    <div>
                      <h3 className="text-sm font-bold text-slate-350 uppercase tracking-widest flex items-center gap-1.5">
                        <Users className="w-4 h-4 text-emerald-400" />
                        Asignación de Personal: {selectedLine.name}
                      </h3>
                      <span className="text-[10px] text-slate-400 block mt-1">Límite requerido por turno: Shift 1: {selectedLine.shift1_target} | Shift 2: {selectedLine.shift2_target}</span>
                    </div>

                    <div className="text-right text-xs bg-slate-900/60 p-2.5 rounded-lg border border-slate-800 font-mono">
                      <span>Empleados Asignados: </span>
                      <strong className={`text-sm ${
                        activeAssignments.length === selectedLine.shift1_target 
                          ? 'text-emerald-400' 
                          : activeAssignments.length > selectedLine.shift1_target ? 'text-yellow-400' : 'text-red-400'
                      }`}>{activeAssignments.length}</strong>
                      <span className="text-slate-500"> / {selectedLine.shift1_target}</span>
                    </div>
                  </div>

                  {/* Add Employee Form */}
                  <div className="bg-[#0B132B]/50 p-4 border border-slate-850 rounded-xl grid grid-cols-3 gap-3 items-end">
                    <div>
                      <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Gafete / Empleado ID</label>
                      <input
                        type="text"
                        value={empForm.badge_id}
                        onChange={(e) => setEmpForm({ ...empForm, badge_id: e.target.value })}
                        className="w-full bg-[#050B18] border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 font-mono"
                        placeholder="100234"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Nombre Completo</label>
                      <input
                        type="text"
                        value={empForm.name}
                        onChange={(e) => setEmpForm({ ...empForm, name: e.target.value })}
                        className="w-full bg-[#050B18] border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                        placeholder="Juan Pérez"
                      />
                    </div>
                    <button
                      onClick={handleAddEmployee}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs py-2 rounded-lg transition-all flex items-center justify-center gap-1.5"
                    >
                      <Plus className="w-4 h-4" />
                      Asignar
                    </button>
                  </div>

                  {/* Assignments List */}
                  <div className="space-y-1.5 max-h-[35vh] overflow-y-auto pr-1">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold block">Lista de Plantilla Registrada</span>
                    
                    {activeAssignments.map(assoc => (
                      <div 
                        key={assoc.id} 
                        className="p-3 bg-slate-900/40 border border-slate-800/40 hover:border-slate-700/60 rounded-xl flex justify-between items-center text-xs"
                      >
                        <div className="flex items-center space-x-3">
                          <span className="font-mono text-emerald-400 bg-emerald-950/20 px-2 py-0.5 rounded border border-emerald-500/10 font-bold">
                            {assoc.empleado?.badge_id || 'N/A'}
                          </span>
                          <span className="font-semibold text-slate-200">{assoc.empleado?.name || 'Desconocido'}</span>
                        </div>

                        <button
                          onClick={() => handleRemoveAssignment(assoc.id)}
                          className="text-slate-500 hover:text-red-400 p-1 rounded hover:bg-red-500/10 transition-all"
                          title="Remover de la línea"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}

                    {activeAssignments.length === 0 && (
                      <span className="text-xs text-slate-500 italic block py-4 text-center border border-dashed border-slate-850 rounded-xl">
                        Sin empleados asignados a esta línea.
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: DINING COVERAGES (relief schedules) */}
              {activeTab === 'coverages' && selectedLine && (
                <div className="space-y-5">
                  <div className="border-b border-slate-850 pb-3">
                    <h3 className="text-sm font-bold text-slate-350 uppercase tracking-widest flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-emerald-400" />
                      Horarios de Cobertura de Comedor: {selectedLine.name}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">El objetivo de personal se reduce automáticamente durante los periodos de comedor predefinidos.</p>
                  </div>

                  {/* Add Lunch Coverage */}
                  <div className="bg-[#0B132B]/50 p-4 border border-slate-850 rounded-xl grid grid-cols-4 gap-3 items-end">
                    <div>
                      <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Hora Inicio</label>
                      <input
                        type="text"
                        value={covForm.start_time}
                        onChange={(e) => setCovForm({ ...covForm, start_time: e.target.value })}
                        className="w-full bg-[#050B18] border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 font-mono text-center"
                        placeholder="12:00:00"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Hora Fin</label>
                      <input
                        type="text"
                        value={covForm.end_time}
                        onChange={(e) => setCovForm({ ...covForm, end_time: e.target.value })}
                        className="w-full bg-[#050B18] border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 font-mono text-center"
                        placeholder="12:30:00"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Cobertura Requerida</label>
                      <input
                        type="number"
                        value={covForm.required_operators}
                        onChange={(e) => setCovForm({ ...covForm, required_operators: Number(e.target.value) })}
                        className="w-full bg-[#050B18] border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 text-center"
                      />
                    </div>
                    <button
                      onClick={handleSaveCoverage}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs py-2 rounded-lg transition-all flex items-center justify-center gap-1.5"
                    >
                      <Plus className="w-4 h-4" />
                      Agregar
                    </button>
                  </div>

                  {/* Coverage Windows List */}
                  <div className="space-y-1.5 max-h-[35vh] overflow-y-auto pr-1">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold block">Ventanas de Alivio Programadas</span>

                    {activeCoverages.map(cov => (
                      <div
                        key={cov.id}
                        className="p-3 bg-slate-900/40 border border-slate-800/40 rounded-xl flex justify-between items-center text-xs"
                      >
                        <div className="flex items-center space-x-6">
                          <span className="font-mono text-blue-400 font-bold bg-blue-950/20 px-2 py-0.5 rounded border border-blue-500/15">
                            {cov.start_time} - {cov.end_time}
                          </span>
                          <span className="text-slate-300 font-medium">Target Requerido: <strong>{cov.required_operators}</strong> operadores</span>
                        </div>

                        <button
                          onClick={() => handleRemoveCoverage(cov.id)}
                          className="text-slate-500 hover:text-red-400 p-1 rounded hover:bg-red-500/10 transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}

                    {activeCoverages.length === 0 && (
                      <span className="text-xs text-slate-500 italic block py-4 text-center border border-dashed border-slate-850 rounded-xl">
                        Sin coberturas comedor configuradas para esta línea.
                      </span>
                    )}
                  </div>
                </div>
              )}

            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-slate-850 bg-[#0B132B] text-center text-[10px] text-slate-500 font-mono">
          Consola Administrativa de LinePulse • Pulse agregar para registrar.
        </div>
      </div>
    </div>
  );
};
