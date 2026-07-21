import React, { useEffect, useState } from 'react';
import { supabase, getActiveStaffingTarget, DEFAULT_SMT_LAYOUT, mapScanFromSupabase, calculateLineMetrics, getLineIntegrationTimeMinutes, getCurrentShift, getLocalDateString, getLineDowntimeMinutes } from '../lib/supabaseClient';
import { 
  Users, AlertTriangle, Clock, Percent, Search, Settings, ExternalLink, 
  BarChart2, Layers, Save, Upload, Plus, X, CheckCircle2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { 
  ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend 
} from 'recharts';

interface ExecutiveDashboardProps {
  userRole?: 'admin' | 'supervisor' | 'viewer';
}

export const ExecutiveDashboard: React.FC<ExecutiveDashboardProps> = () => {
  const navigate = useNavigate();
  const [lines, setLines] = useState<any[]>([]);
  const [scans, setScans] = useState<any[]>([]);
  const [downtimes, setDowntimes] = useState<any[]>([]);
  const [areas, setAreas] = useState<any[]>([]);
  const [coverages, setCoverages] = useState<any[]>([]);
  const [posiciones, setPosiciones] = useState<any[]>([]);

  // Filtering states for left list
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedArea, setSelectedArea] = useState('ALL');

  // Selected Line State for Integrated Configuration Mode
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [rightPanelMode, setRightPanelMode] = useState<'analytics' | 'config'>('analytics');

  // Configuration Sub-Tab state
  const [configSubTab, setConfigSubTab] = useState<'turnos' | 'layout' | 'coberturas' | 'registros'>('turnos');
  
  // Modal State for + Nueva Línea
  const [isLineCreateModalOpen, setIsLineCreateModalOpen] = useState(false);

  // Line editing form
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
    layout_url: '',
    status: 'FALTA PERSONAL'
  });

  // Coverage form state
  const [covForm, setCovForm] = useState({ id: '', start_time: '12:00:00', end_time: '12:30:00', required_operators: 3 });

  // Drag & drop layout positions
  const [activeDraggingPosId, setActiveDraggingPosId] = useState<string | null>(null);
  const layoutRef = React.useRef<HTMLDivElement>(null);

  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error' | null; text: string }>({ type: null, text: '' });
  const [areaLoadError, setAreaLoadError] = useState(false);
  const [formErrors, setFormErrors] = useState<{ name?: string; area_id?: string }>({});

  const ensureAreasExist = async (currentAreasData: any[]) => {
    let list = currentAreasData || [];
    setAreaLoadError(false);

    if (list.length === 0) {
      try {
        const { data: inserted, error: insertErr } = await supabase
          .from('areas')
          .insert([
            { name: 'SMT', description: 'Surface Mount Technology' },
            { name: 'Backend', description: 'Ensamble y Backend' }
          ])
          .select();

        if (inserted && inserted.length > 0) {
          list = inserted;
        } else {
          const { data: reselect, error: selErr } = await supabase.from('areas').select('*');
          if (reselect && reselect.length > 0) {
            list = reselect;
          } else if (insertErr || selErr) {
            console.warn('Could not insert or select areas:', insertErr || selErr);
          }
        }
      } catch (e) {
        console.warn('Auto-seeding default areas:', e);
      }
    }

    if (list.length === 0) {
      list = [
        { id: 'area-smt-default', name: 'SMT', description: 'Surface Mount Technology' },
        { id: 'area-backend-default', name: 'Backend', description: 'Ensamble y Backend' }
      ];
    }
    return list;
  };

  const loadData = async () => {
    try {
      const { data: linesData } = await supabase.from('lineas').select('*');
      const { data: scansData } = await supabase.from('escaneos').select('*');
      const { data: dtData } = await supabase.from('tiempos_muertos').select('*');
      const { data: areasData, error: areasError } = await supabase.from('areas').select('*');
      const { data: covData } = await supabase.from('coberturas').select('*');
      
      let posData = null;
      const resPos = await supabase.from('posiciones').select('*, empleado:empleados(*)');
      if (resPos.data) {
        posData = resPos.data;
      } else {
        const resLinePos = await supabase.from('line_positions').select('*, empleado:empleados(*)');
        posData = resLinePos.data;
      }

      if (areasError && (!areasData || areasData.length === 0)) {
        setAreaLoadError(true);
      }

      const verifiedAreas = await ensureAreasExist(areasData || []);

      setLines(linesData || []);
      setScans((scansData || []).map(mapScanFromSupabase));
      setDowntimes(dtData || []);
      setAreas(verifiedAreas);
      setCoverages(covData || []);
      setPosiciones(posData || []);
    } catch (err) {
      console.warn('Handling empty or uninitialized database tables:', err);
      setAreaLoadError(true);
      setAreas([
        { id: 'area-smt-default', name: 'SMT', description: 'Surface Mount Technology' },
        { id: 'area-backend-default', name: 'Backend', description: 'Ensamble y Backend' }
      ]);
    }
  };

  useEffect(() => {
    loadData();

    const channel = supabase.channel('exec-dashboard-split-changes')
      .on('postgres_changes', { event: '*', schema: 'public' }, () => {
        loadData();
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, []);

  // Update line form when selecting a line
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
          layout_url: line.layout_url || '',
          status: line.status || 'FALTA PERSONAL'
        });
      }
    }
  }, [selectedLineId, lines]);

  const showFeedback = (type: 'success' | 'error', text: string) => {
    setFeedbackMsg({ type, text });
    setTimeout(() => setFeedbackMsg({ type: null, text: '' }), 3000);
  };

  // Line selection action -> Open Integrated Line Configurator in right panel
  const handleSelectLine = (lineId: string) => {
    setSelectedLineId(lineId);
    setRightPanelMode('config');
  };

  // Edit Line Action
  const handleEditLine = (line: any, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setLineForm({
      id: line.id,
      name: line.name,
      area_id: line.area_id,
      process: line.process || '',
      shift1_start: line.shift1_start || '06:00:00',
      shift1_target: line.shift1_target || 6,
      shift2_start: line.shift2_start || '14:00:00',
      shift2_target: line.shift2_target || 6,
      shift3_start: line.shift3_start || '22:00:00',
      shift3_target: line.shift3_target || 4,
      layout_url: line.layout_url || '',
      status: line.status || 'FALTA PERSONAL'
    });
    setIsLineCreateModalOpen(true);
  };

  // Delete Line Action
  const handleDeleteLine = async (lineId: string, lineName: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!window.confirm(`¿Desea eliminar la línea "${lineName}"? Esta acción borrará la línea, sus posiciones y todos sus registros asociados.`)) {
      return;
    }

    try {
      await supabase.from('escaneos').delete().eq('line_id', lineId);
      await supabase.from('posiciones').delete().eq('line_id', lineId);
      await supabase.from('line_positions').delete().eq('line_id', lineId);
      const { error } = await supabase.from('lineas').delete().eq('id', lineId);

      if (error) {
        showFeedback('error', `Error al eliminar la línea: ${error.message}`);
      } else {
        showFeedback('success', `✅ Línea "${lineName}" eliminada correctamente.`);
        if (selectedLineId === lineId) {
          setSelectedLineId(null);
          setRightPanelMode('analytics');
        }
        loadData();
      }
    } catch (err: any) {
      showFeedback('error', `Error: ${err.message}`);
    }
  };

  // Save or Create Line Parameters
  const handleSaveLine = async () => {
    const errors: { name?: string; area_id?: string } = {};

    if (!lineForm.name || !lineForm.name.trim()) {
      errors.name = 'Ingrese el nombre de la línea';
    }
    if (!lineForm.area_id) {
      errors.area_id = 'Seleccione un área';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      if (errors.area_id) {
        showFeedback('error', 'Seleccione un área');
      } else if (errors.name) {
        showFeedback('error', 'Ingrese el nombre de la línea');
      }
      return; // Mantener el modal abierto
    }

    setFormErrors({});

    const payload = {
      name: lineForm.name.trim(),
      area_id: lineForm.area_id,
      process: lineForm.process,
      shift1_start: lineForm.shift1_start,
      shift1_target: Number(lineForm.shift1_target),
      shift2_start: lineForm.shift2_start,
      shift2_target: Number(lineForm.shift2_target),
      shift3_start: lineForm.shift3_start,
      shift3_target: Number(lineForm.shift3_target),
      layout_url: lineForm.layout_url,
      status: (lineForm as any).status || 'FALTA PERSONAL'
    };

    if (lineForm.id) {
      const { error } = await supabase.from('lineas').update(payload).eq('id', lineForm.id);
      if (error) {
        showFeedback('error', `❌ Error al guardar línea: ${error.message}`);
      } else {
        showFeedback('success', '✅ Línea actualizada correctamente');
        setIsLineCreateModalOpen(false);
        loadData();
      }
    } else {
      const { data, error } = await supabase.from('lineas').insert([payload]).select();
      if (error) {
        showFeedback('error', `❌ Error al guardar línea: ${error.message}`);
      } else {
        showFeedback('success', '✅ Línea creada correctamente');
        setIsLineCreateModalOpen(false);
        loadData();
        if (data && data[0]) {
          setSelectedLineId(data[0].id);
          setRightPanelMode('config');
        }
      }
    }
  };

  // Layout image upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedLineId) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const dataUrl = evt.target?.result as string;
      if (dataUrl) {
        setLineForm(prev => ({ ...prev, layout_url: dataUrl }));
        await supabase.from('lineas').update({ layout_url: dataUrl }).eq('id', selectedLineId);
        showFeedback('success', 'Layout guardado correctamente.');
        loadData();
      }
    };
    reader.readAsDataURL(file);
  };

  // Drag & drop layout pins
  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!activeDraggingPosId || !layoutRef.current) return;
    const rect = layoutRef.current.getBoundingClientRect();
    const xPercent = Math.max(3, Math.min(97, Math.round(((e.clientX - rect.left) / rect.width) * 100)));
    const yPercent = Math.max(3, Math.min(97, Math.round(((e.clientY - rect.top) / rect.height) * 100)));

    setPosiciones(prev =>
      prev.map(pos => 
        (pos.id === activeDraggingPosId || pos.code === activeDraggingPosId)
          ? { ...pos, x_percent: xPercent, y_percent: yPercent, placed: true }
          : pos
      )
    );
  };

  const handlePlacePositionAtDefault = (code: string) => {
    if (!selectedLineId) return;
    setPosiciones(prev => {
      const existing = prev.find(p => p.line_id === selectedLineId && p.code === code);
      if (existing) {
        return prev.map(p => (p.line_id === selectedLineId && p.code === code) ? { ...p, placed: true } : p);
      } else {
        return [
          ...prev,
          {
            id: `temp-${code}`,
            line_id: selectedLineId,
            code,
            station_name: code,
            x_percent: 50,
            y_percent: 50,
            placed: true
          }
        ];
      }
    });
  };

  const handleSavePositions = async () => {
    if (!selectedLineId) return;
    const { target: targetCount } = getActiveStaffingTarget(selectedLineId);
    
    // Filter positions that belong to this line and are placed on canvas
    const currentLinePositions = posiciones.filter(
      p => p.line_id === selectedLineId && p.placed !== false
    );
    
    const placedCount = currentLinePositions.length;

    if (placedCount < targetCount) {
      const missing = targetCount - placedCount;
      showFeedback('error', `❌ Faltan ${missing} posiciones por ubicar en el layout.`);
      return; // BLOQUEAR GUARDADO
    }

    try {
      await supabase.from('posiciones').delete().eq('line_id', selectedLineId);
      await supabase.from('line_positions').delete().eq('line_id', selectedLineId);

      const payload = currentLinePositions.map(pos => ({
        line_id: selectedLineId,
        code: pos.code,
        station_name: pos.code,
        x_percent: pos.x_percent,
        y_percent: pos.y_percent
      }));

      const { error: err1 } = await supabase.from('posiciones').insert(payload);
      const { error: err2 } = await supabase.from('line_positions').insert(payload);

      if (err1 || err2) {
        showFeedback('error', `❌ Error al guardar mapa visual: ${(err1 || err2)?.message}`);
      } else {
        showFeedback('success', '✅ Mapa visual de layout guardado con éxito.');
        loadData();
      }
    } catch (err: any) {
      showFeedback('error', `❌ Error al guardar posiciones: ${err?.message}`);
    }
  };

  // Add Coverage
  const handleSaveCoverage = async () => {
    if (!selectedLineId || !covForm.start_time || !covForm.end_time || covForm.required_operators <= 0) {
      showFeedback('error', 'Ingrese horario y un número válido de operadores.');
      return;
    }

    const { error } = await supabase.from('coberturas').insert({
      line_id: selectedLineId,
      start_time: covForm.start_time,
      end_time: covForm.end_time,
      required_operators: Number(covForm.required_operators)
    });

    if (error) {
      showFeedback('error', `Error: ${error.message}`);
    } else {
      showFeedback('success', 'Cobertura agregada.');
      setCovForm({ id: '', start_time: '12:00:00', end_time: '12:30:00', required_operators: 3 });
      loadData();
    }
  };

  // Delete individual scan record
  const handleDeleteScan = async (scanId: string) => {
    if (!scanId) return;
    try {
      const { error } = await supabase.from('escaneos').delete().eq('id', scanId);
      if (error) {
        showFeedback('error', `Error al borrar registro: ${error.message}`);
      } else {
        showFeedback('success', '✅ Registro de escaneo eliminado. Posición liberada (🟢 -> 🔴).');
        
        // Recalculate line status after deletion
        if (selectedLineId) {
          const remainingScans = scans.filter(s => s.id !== scanId && s.line_id === selectedLineId);
          const distinctRemaining = new Set(remainingScans.map(s => s.employee_number || s.badge_id).filter(Boolean)).size;
          const { target, isCoverageActive } = getActiveStaffingTarget(selectedLineId);
          const newPct = target > 0 ? Math.round((distinctRemaining / target) * 100) : 0;

          let newStatus = 'FALTA PERSONAL';
          if (isCoverageActive) {
            newStatus = 'COBERTURA DE COMEDOR';
          } else if (newPct >= 100) {
            newStatus = 'PLANTILLA COMPLETA';
          } else if (newPct > 0) {
            newStatus = 'INTEGRANDO PERSONAL';
          }

          await supabase.from('lineas').update({ status: newStatus }).eq('id', selectedLineId);
        }

        loadData();
      }
    } catch (err: any) {
      showFeedback('error', `Error: ${err.message}`);
    }
  };

  // KPI Calculations
  let totalRequired = 0;
  let totalPresent = 0;
  let totalDowntimeToday = 0;

  lines.forEach((line: any) => {
    const metrics = calculateLineMetrics(line.id, posiciones, scans, coverages);
    totalRequired += metrics.target;
    totalPresent += metrics.scannedCount;
    totalDowntimeToday += getLineIntegrationTimeMinutes(line, scans);
  });

  const missingCount = Math.max(0, totalRequired - totalPresent);
  const globalCoveragePct = totalRequired > 0 ? Math.round((totalPresent / totalRequired) * 100) : 0;

  // Filter lines for left list
  const filteredLines = lines.filter((line: any) => {
    const matchesSearch = line.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesArea = selectedArea === 'ALL' || line.area_id === selectedArea;
    return matchesSearch && matchesArea;
  });

  // Chart Data Preparation (100% REAL DATA FROM SUPABASE - SINGLE SOURCE OF TRUTH)
  const todayLocalStr = getLocalDateString(new Date());

  // 1. TIEMPO MUERTO POR LÍNEA (Combinando tiempo de integración y eventos de tiempo muerto registrados)
  const chartDowntimeData = lines.map((l: any) => {
    const integrationMin = getLineIntegrationTimeMinutes(l, scans);
    const downtimeEventsMin = getLineDowntimeMinutes(l.id, downtimes, todayLocalStr);
    const sumMin = Math.max(integrationMin, downtimeEventsMin);
    return {
      name: l.name,
      minutos: sumMin,
      integrationMin,
      downtimeEventsMin
    };
  });

  // Dynamic Y-axis scale calculation for Chart 1
  const maxDowntimeValue = Math.max(10, ...chartDowntimeData.map(d => d.minutos || 0));
  const yMaxDowntime = Math.ceil((maxDowntimeValue * 1.2) / 10) * 10;

  console.log('[DEBUG CHART 1 DATA]:', {
    todayLocalStr,
    totalLines: lines.length,
    totalScans: scans.length,
    totalDowntimes: downtimes.length,
    chartDowntimeData,
    maxDowntimeValue,
    yMaxDowntime
  });

  // 2. TIEMPO DE INTEGRACIÓN (Real Line Chart data calculated over 15-minute time slots: 06:00, 06:15, 06:30, 06:45, 07:00...)
  const generateIntegrationTimeline = () => {
    if (!lines || lines.length === 0) return { chartData: [], lineColors: [] };
    
    const now = new Date();
    const firstLine = lines[0];
    const shiftInfo = getCurrentShift(firstLine, now, 15);
    const startStr = shiftInfo.startTimeStr || '06:00:00';
    const [startH, startM] = startStr.split(':').map(Number);
    
    const slots: { label: string; timestampMs: number }[] = [];
    for (let i = 0; i <= 8; i++) {
      const slotMinTotal = (startH * 60 + startM) + (i * 15);
      const h = Math.floor(slotMinTotal / 60) % 24;
      const m = slotMinTotal % 60;
      const timeLabel = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      
      const slotDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0);
      slots.push({ label: timeLabel, timestampMs: slotDate.getTime() });
    }

    const lineColors = ['#005486', '#059669', '#D97706', '#2563EB', '#7C3AED', '#DB2777', '#0891B2'];

    const chartData = slots.map(slot => {
      const row: any = { time: slot.label };
      lines.forEach((l: any) => {
        const lineShift = getCurrentShift(l, new Date(slot.timestampMs), 15);
        const [lStartH, lStartM] = (lineShift.startTimeStr || '06:00:00').split(':').map(Number);
        const lShiftStartMs = new Date(now.getFullYear(), now.getMonth(), now.getDate(), lStartH, lStartM, 0).getTime();

        if (slot.timestampMs < lShiftStartMs) {
          row[l.name] = 0;
        } else {
          const lineScansUpToSlot = scans.filter((s: any) => {
            if (s.line_id !== l.id || s.was_successful === false) return false;
            const sTime = new Date(s.event_time || s.scan_time || s.created_at || Date.now()).getTime();
            return sTime <= slot.timestampMs;
          });

          const target = lineShift.target || 6;
          const distinctEmps = new Set(lineScansUpToSlot.map(s => s.employee_number || s.badge_id).filter(Boolean)).size;

          if (distinctEmps >= target && lineScansUpToSlot.length > 0) {
            const maxScanMs = Math.max(...lineScansUpToSlot.map(s => new Date(s.event_time || s.scan_time || s.created_at || Date.now()).getTime()));
            row[l.name] = Math.max(0, Math.floor((maxScanMs - lShiftStartMs) / 60000));
          } else {
            row[l.name] = Math.max(0, Math.floor((slot.timestampMs - lShiftStartMs) / 60000));
          }
        }
      });
      return row;
    });

    return { chartData, lineColors };
  };

  const integrationTimeline = generateIntegrationTimeline();

  // Dynamic Y-axis scale calculation for Chart 2
  const maxIntegrationValue = Math.max(10, ...integrationTimeline.chartData.flatMap((row: any) =>
    Object.keys(row).filter(k => k !== 'time').map(k => Number(row[k]) || 0)
  ));
  const yMaxIntegration = Math.ceil((maxIntegrationValue * 1.2) / 10) * 10;

  const selectedLine = lines.find(l => l.id === selectedLineId);
  const activeCoverages = coverages.filter(c => c.line_id === selectedLineId);

  return (
    <div className="bg-[#F5F7FA] text-slate-800 flex-grow h-full flex flex-col overflow-hidden p-4 space-y-4 font-sans select-none">
      
      {/* 1. TOP CORPORATE KPI SUMMARY RIBBON */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 shrink-0">
        <div className="bg-white border border-[#DCE3EA] p-3 rounded-xl flex items-center justify-between shadow-sm">
          <div>
            <span className="text-[10px] font-bold text-slate-500 tracking-wider uppercase block">Cobertura Global</span>
            <span className="text-xl font-black font-mono text-[#005486]">{globalCoveragePct}%</span>
          </div>
          <div className="p-2 bg-blue-50 rounded-lg text-[#005486]">
            <Percent className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white border border-[#DCE3EA] p-3 rounded-xl flex items-center justify-between shadow-sm">
          <div>
            <span className="text-[10px] font-bold text-slate-500 tracking-wider uppercase block">Plantilla Total</span>
            <span className="text-xl font-black font-mono text-slate-900">
              {totalPresent} <span className="text-xs text-slate-500 font-normal">/ {totalRequired}</span>
            </span>
          </div>
          <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
            <Users className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white border border-[#DCE3EA] p-3 rounded-xl flex items-center justify-between shadow-sm">
          <div>
            <span className="text-[10px] font-bold text-slate-500 tracking-wider uppercase block">Ausencias</span>
            <span className="text-xl font-black font-mono text-[#EF4444]">{missingCount}</span>
          </div>
          <div className="p-2 bg-red-50 rounded-lg text-[#EF4444]">
            <AlertTriangle className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white border border-[#DCE3EA] p-3 rounded-xl flex items-center justify-between shadow-sm">
          <div>
            <span className="text-[10px] font-bold text-slate-500 tracking-wider uppercase block">Tiempo Muerto</span>
            <span className="text-xl font-black font-mono text-amber-600">
              {totalDowntimeToday} <span className="text-xs text-slate-500 font-normal">min</span>
            </span>
          </div>
          <div className="p-2 bg-amber-50 rounded-lg text-amber-600">
            <Clock className="w-4 h-4" />
          </div>
        </div>

        {/* View Mode Switcher Button */}
        <div className="col-span-2 md:col-span-1 bg-white border border-[#DCE3EA] p-2 rounded-xl flex items-center justify-center">
          <button
            onClick={() => {
              if (rightPanelMode === 'config') {
                setRightPanelMode('analytics');
              } else if (selectedLineId) {
                setRightPanelMode('config');
              }
            }}
            className="w-full h-full bg-[#005486] hover:bg-[#003f66] text-white font-extrabold px-3 py-1.5 rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
          >
            {rightPanelMode === 'config' ? (
              <>
                <BarChart2 className="w-4 h-4" />
                <span>Ver Analíticas y Gráficas</span>
              </>
            ) : (
              <>
                <Settings className="w-4 h-4" />
                <span>Configurar Línea {selectedLine ? `(${selectedLine.name})` : ''}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Feedback Alert Toast */}
      {feedbackMsg.text && (
        <div className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm ${
          feedbackMsg.type === 'success' ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' : 'bg-red-50 border border-red-200 text-red-700'
        }`}>
          <CheckCircle2 className="w-4 h-4" />
          <span>{feedbackMsg.text}</span>
        </div>
      )}

      {/* Area Load Error Notification */}
      {areaLoadError && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs font-bold text-amber-800 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span>No fue posible cargar las áreas</span>
          </div>
          <button
            onClick={() => loadData()}
            className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[11px] font-extrabold cursor-pointer transition-all"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* 2. SPLIT SCREEN MAIN VIEWPORT (40% LEFT / 60% RIGHT) */}
      <div className="flex-1 min-h-0 flex gap-4 overflow-hidden">
        
        {/* ============================================================ */}
        {/* LEFT SECTION (40% Width): LINE ADMINISTRATOR LIST           */}
        {/* ============================================================ */}
        <div className="w-full lg:w-[40%] bg-white border border-[#DCE3EA] rounded-2xl flex flex-col overflow-hidden shadow-sm shrink-0">
          
          {/* Header Controls */}
          <div className="p-3 border-b border-[#DCE3EA] bg-[#F5F7FA] flex items-center justify-between gap-2 shrink-0 flex-wrap">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#005486]" />
              <span className="text-xs font-black uppercase text-slate-800 tracking-wider">Líneas de Producción</span>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2 w-3 h-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-24 sm:w-28 bg-white border border-[#DCE3EA] rounded-lg pl-7 pr-2 py-1 text-[11px] text-slate-800 focus:outline-none focus:border-[#005486]"
                />
              </div>

              <select
                value={selectedArea}
                onChange={(e) => setSelectedArea(e.target.value)}
                className="bg-white border border-[#DCE3EA] rounded-lg px-2 py-1 text-[10px] text-slate-700 font-bold focus:outline-none cursor-pointer"
              >
                <option value="ALL">Áreas</option>
                {areas.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>

              {/* Botón + Nueva Línea */}
              <button
                onClick={() => {
                  setLineForm({
                    id: '',
                    name: '',
                    area_id: areas[0]?.id || '',
                    process: '',
                    shift1_start: '06:00:00',
                    shift1_target: 6,
                    shift2_start: '14:00:00',
                    shift2_target: 6,
                    shift3_start: '22:00:00',
                    shift3_target: 4,
                    layout_url: '',
                    status: 'FALTA PERSONAL'
                  } as any);
                  setIsLineCreateModalOpen(true);
                }}
                className="bg-[#005486] hover:bg-[#003f66] text-white px-2.5 py-1 rounded-lg text-xs font-extrabold flex items-center gap-1 shadow-sm transition-all cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Nueva Línea</span>
              </button>
            </div>
          </div>

          {/* Table List of Lines */}
          <div className="flex-1 min-h-0 overflow-y-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-[#F5F7FA] border-b border-[#DCE3EA] sticky top-0 z-10">
                <tr className="text-[10px] font-extrabold text-slate-600 uppercase tracking-wider">
                  <th className="py-2.5 px-3 w-8 text-center">St</th>
                  <th className="py-2.5 px-3">Nombre</th>
                  <th className="py-2.5 px-3">Cobertura</th>
                  <th className="py-2.5 px-3">Personal</th>
                  <th className="py-2.5 px-3" title="Tiempo transcurrido para completar plantilla de turno">T. Integración</th>
                  <th className="py-2.5 px-3 text-right">⚙</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DCE3EA]">
                {filteredLines.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 px-4 text-center">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-[#005486]">
                          <Layers className="w-6 h-6" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-bold text-slate-800">No hay líneas configuradas</p>
                          <p className="text-xs text-slate-500">Agrega una línea de producción para comenzar a monitorear.</p>
                        </div>
                        <button
                          onClick={() => {
                            setLineForm({
                              id: '',
                              name: '',
                              area_id: areas[0]?.id || '',
                              process: '',
                              shift1_start: '06:00:00',
                              shift1_target: 6,
                              shift2_start: '14:00:00',
                              shift2_target: 6,
                              shift3_start: '22:00:00',
                              shift3_target: 4,
                              layout_url: '',
                              status: 'FALTA PERSONAL'
                            } as any);
                            setIsLineCreateModalOpen(true);
                          }}
                          className="mt-2 bg-[#005486] hover:bg-[#003f66] text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                        >
                          <Plus className="w-4 h-4" />
                          <span>+ Crear Primera Línea</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredLines.map((line: any) => {
                    const metrics = calculateLineMetrics(line.id, posiciones, scans, coverages);
                    const { target, scannedCount: present, coveragePct: pct, statusEmoji, statusColor, isCoverageActive } = metrics;
                    const integrationMin = getLineIntegrationTimeMinutes(line, scans);
                    const isSelected = selectedLineId === line.id && rightPanelMode === 'config';

                  return (
                    <tr
                      key={line.id}
                      onClick={() => handleSelectLine(line.id)}
                      className={`transition-colors cursor-pointer select-none ${
                        isSelected ? 'bg-[#005486]/10 border-l-4 border-l-[#005486]' : 'hover:bg-[#F5F7FA]'
                      }`}
                    >
                      <td className="py-2.5 px-3 text-center">{statusEmoji}</td>
                      <td className="py-2.5 px-3 font-extrabold text-slate-900">
                        {line.name}
                        {isCoverageActive && (
                          <span className="ml-1 text-[9px] text-blue-600 bg-blue-50 px-1 rounded">Comedor</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="font-mono font-bold" style={{ color: statusColor }}>{pct}%</span>
                      </td>
                      <td className="py-2.5 px-3 font-mono">
                        {present}/{target}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-600">
                        {integrationMin > 0 ? <span className="text-amber-600 font-bold">{integrationMin}m</span> : '0m'}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={(e) => handleEditLine(line, e)}
                            className="p-1 hover:bg-slate-200 text-slate-700 rounded-md transition-all cursor-pointer"
                            title="Editar parámetros de la línea"
                          >
                            <Settings className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => handleDeleteLine(line.id, line.name, e)}
                            className="p-1 hover:bg-red-100 text-red-600 rounded-md transition-all cursor-pointer"
                            title="Eliminar línea de producción"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }))}
              </tbody>
            </table>
          </div>

        </div>

        {/* ============================================================ */}
        {/* RIGHT SECTION (60% Width): ANALYTICS or INTEGRATED CONFIG   */}
        {/* ============================================================ */}
        <div className="flex-1 w-full lg:w-[60%] bg-white border border-[#DCE3EA] rounded-2xl flex flex-col overflow-hidden shadow-sm">
          
          {/* DUAL MODE CONTROLLER HEADER */}
          {rightPanelMode === 'config' && selectedLine ? (
            
            /* MODE A: INTEGRATED LINE CONFIGURATION HEADER */
            <div className="p-3 bg-[#005486] text-white flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-3">
                <Settings className="w-5 h-5 text-white" />
                <div>
                  <h2 className="text-sm font-black uppercase tracking-wider font-mono">
                    Configuración: {selectedLine.name}
                  </h2>
                  <span className="text-[10px] text-white/70 font-semibold block">
                    {selectedLine.process || 'Parámetros y asignaciones de estación'}
                  </span>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                {/* PROMINENT BUTTON: VER MONITOR OPERATIVO */}
                <button
                  onClick={() => navigate(`/linea/${selectedLine.id}`)}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Ver Monitor Operativo</span>
                </button>

                <button
                  onClick={() => setRightPanelMode('analytics')}
                  className="p-1.5 text-white/80 hover:text-white rounded-lg hover:bg-white/10 transition-all cursor-pointer"
                  title="Cerrar configuración"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

          ) : (

            /* MODE B: ANALYTICS DASHBOARD HEADER */
            <div className="p-3 bg-[#F5F7FA] border-b border-[#DCE3EA] flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-2">
                <BarChart2 className="w-4 h-4 text-[#005486]" />
                <span className="text-xs font-black uppercase text-slate-800 tracking-wider">
                  Analíticas Operativas de Planta
                </span>
              </div>
              <span className="text-[10px] text-slate-500 font-semibold">
                Datos reales en vivo alimentados desde Supabase
              </span>
            </div>

          )}

          {/* MAIN BODY OF RIGHT PANEL */}
          <div className="flex-1 min-h-0 overflow-y-auto p-4">
            
            {rightPanelMode === 'config' && selectedLine ? (
              
              /* CONFIGURATION TABS & BODY */
              <div className="space-y-4">
                
                {/* SUB-TABS NAVIGATION */}
                <div className="flex items-center border-b border-[#DCE3EA] gap-2 font-mono font-bold text-xs">
                  <button
                    onClick={() => setConfigSubTab('turnos')}
                    className={`py-2 px-3 border-b-2 transition-all cursor-pointer ${
                      configSubTab === 'turnos'
                        ? 'border-[#005486] text-[#005486]'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    1. HORARIOS Y PLANTILLAS
                  </button>
                  <button
                    onClick={() => setConfigSubTab('layout')}
                    className={`py-2 px-3 border-b-2 transition-all cursor-pointer ${
                      configSubTab === 'layout'
                        ? 'border-[#005486] text-[#005486]'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    2. LAYOUT Y POSICIONES
                  </button>
                  <button
                    onClick={() => setConfigSubTab('coberturas')}
                    className={`py-2 px-3 border-b-2 transition-all cursor-pointer ${
                      configSubTab === 'coberturas'
                        ? 'border-[#005486] text-[#005486]'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    3. COBERTURA DE COMEDOR
                  </button>
                  <button
                    onClick={() => setConfigSubTab('registros')}
                    className={`py-2 px-3 border-b-2 transition-all cursor-pointer ${
                      configSubTab === 'registros'
                        ? 'border-[#005486] text-[#005486]'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    4. REGISTROS (HOY)
                  </button>
                </div>

                {/* SUB-TAB 1: HORARIOS Y PLANTILLAS */}
                {configSubTab === 'turnos' && (
                  <div className="space-y-3 text-xs">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">Nombre de la Línea</label>
                        <input
                          type="text"
                          value={lineForm.name}
                          onChange={(e) => setLineForm({ ...lineForm, name: e.target.value })}
                          className="w-full bg-[#F5F7FA] border border-[#DCE3EA] rounded-xl px-3 py-2 text-xs text-slate-800 font-bold focus:outline-none focus:border-[#005486]"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">Área</label>
                        <select
                          value={lineForm.area_id}
                          onChange={(e) => setLineForm({ ...lineForm, area_id: e.target.value })}
                          className="w-full bg-[#F5F7FA] border border-[#DCE3EA] rounded-xl px-3 py-2 text-xs text-slate-800 font-bold focus:outline-none cursor-pointer"
                        >
                          {areas.map(a => (
                            <option key={a.id} value={a.id}>{a.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="col-span-2">
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">Proceso / Descripción</label>
                        <input
                          type="text"
                          value={lineForm.process}
                          onChange={(e) => setLineForm({ ...lineForm, process: e.target.value })}
                          className="w-full bg-[#F5F7FA] border border-[#DCE3EA] rounded-xl px-3 py-2 text-xs text-slate-800 font-medium focus:outline-none focus:border-[#005486]"
                        />
                      </div>
                    </div>

                    <div className="border border-[#DCE3EA] rounded-xl p-3 bg-[#F5F7FA] space-y-2">
                      <span className="font-extrabold text-[#005486] uppercase tracking-wider text-[11px] block font-mono">
                        Configuración de Turnos y Meta de Plantilla
                      </span>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="bg-white p-2.5 rounded-lg border border-[#DCE3EA]">
                          <span className="font-bold text-slate-700 block mb-1">Turno 1 (Primero)</span>
                          <label className="text-[10px] text-slate-500 block">Hora Inicio</label>
                          <input
                            type="time"
                            value={lineForm.shift1_start}
                            onChange={(e) => setLineForm({ ...lineForm, shift1_start: e.target.value })}
                            className="w-full bg-[#F5F7FA] border border-[#DCE3EA] rounded p-1 mb-2 font-mono text-xs"
                          />
                          <label className="text-[10px] text-slate-500 block">Plantilla Requerida</label>
                          <input
                            type="number"
                            min="1"
                            value={lineForm.shift1_target}
                            onChange={(e) => setLineForm({ ...lineForm, shift1_target: Number(e.target.value) })}
                            className="w-full bg-[#F5F7FA] border border-[#DCE3EA] rounded p-1 font-mono font-bold text-xs"
                          />
                        </div>

                        <div className="bg-white p-2.5 rounded-lg border border-[#DCE3EA]">
                          <span className="font-bold text-slate-700 block mb-1">Turno 2 (Segundo)</span>
                          <label className="text-[10px] text-slate-500 block">Hora Inicio</label>
                          <input
                            type="time"
                            value={lineForm.shift2_start}
                            onChange={(e) => setLineForm({ ...lineForm, shift2_start: e.target.value })}
                            className="w-full bg-[#F5F7FA] border border-[#DCE3EA] rounded p-1 mb-2 font-mono text-xs"
                          />
                          <label className="text-[10px] text-slate-500 block">Plantilla Requerida</label>
                          <input
                            type="number"
                            min="1"
                            value={lineForm.shift2_target}
                            onChange={(e) => setLineForm({ ...lineForm, shift2_target: Number(e.target.value) })}
                            className="w-full bg-[#F5F7FA] border border-[#DCE3EA] rounded p-1 font-mono font-bold text-xs"
                          />
                        </div>

                        <div className="bg-white p-2.5 rounded-lg border border-[#DCE3EA]">
                          <span className="font-bold text-slate-700 block mb-1">Turno 3 (Tercero)</span>
                          <label className="text-[10px] text-slate-500 block">Hora Inicio</label>
                          <input
                            type="time"
                            value={lineForm.shift3_start}
                            onChange={(e) => setLineForm({ ...lineForm, shift3_start: e.target.value })}
                            className="w-full bg-[#F5F7FA] border border-[#DCE3EA] rounded p-1 mb-2 font-mono text-xs"
                          />
                          <label className="text-[10px] text-slate-500 block">Plantilla Requerida</label>
                          <input
                            type="number"
                            min="1"
                            value={lineForm.shift3_target}
                            onChange={(e) => setLineForm({ ...lineForm, shift3_target: Number(e.target.value) })}
                            className="w-full bg-[#F5F7FA] border border-[#DCE3EA] rounded p-1 font-mono font-bold text-xs"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end pt-2">
                      <button
                        onClick={handleSaveLine}
                        className="flex items-center gap-1.5 bg-[#005486] hover:bg-[#00426a] text-white font-bold px-5 py-2 rounded-xl text-xs shadow-sm cursor-pointer"
                      >
                        <Save className="w-4 h-4" />
                        <span>Guardar Cambios</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* SUB-TAB 2: LAYOUT Y POSICIONES OPERATIVAS */}
                {configSubTab === 'layout' && (() => {
                  const targetCount = Math.max(1, getActiveStaffingTarget(selectedLineId || '').target || selectedLine.shift1_target || 6);
                  const targetPosCodes = Array.from({ length: targetCount }, (_, i) => `POS${String(i + 1).padStart(2, '0')}`);
                  const currentLinePlacedPos = posiciones.filter(p => p.line_id === selectedLineId && p.placed !== false);
                  const placedPosCodes = new Set(currentLinePlacedPos.map(p => p.code));
                  const unplacedCodes = targetPosCodes.filter(code => !placedPosCodes.has(code));
                  const placedCount = currentLinePlacedPos.length;

                  return (
                    <div className="space-y-3 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2 bg-[#F5F7FA] p-3 rounded-xl border border-[#DCE3EA]">
                        <div className="flex items-center gap-2">
                          <label className="flex items-center gap-1.5 bg-white hover:bg-slate-100 text-[#005486] font-bold px-3 py-1.5 rounded-xl border border-[#DCE3EA] cursor-pointer shadow-sm transition-all">
                            <Upload className="w-3.5 h-3.5" />
                            <span>Cargar Imagen Layout</span>
                            <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                          </label>
                          <span className="text-[11px] text-slate-600 font-semibold">
                            Plantilla: <strong className="text-slate-800 font-mono">{targetCount} pos</strong> | Ubicadas: <strong className={placedCount === targetCount ? "text-emerald-600 font-mono" : "text-amber-600 font-mono"}>{placedCount}/{targetCount}</strong>
                          </span>
                        </div>

                        <button
                          onClick={handleSavePositions}
                          className="flex items-center gap-1.5 bg-[#005486] hover:bg-[#003f66] text-white font-extrabold px-4 py-1.5 rounded-xl shadow-sm transition-all cursor-pointer"
                        >
                          <Save className="w-3.5 h-3.5" />
                          <span>Guardar Mapa Visual</span>
                        </button>
                      </div>

                      {unplacedCodes.length > 0 && (
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-extrabold text-amber-900 text-[11px] uppercase tracking-wider flex items-center gap-1">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                              Posiciones Pendientes por Ubicar ({unplacedCodes.length}):
                            </span>
                            <span className="text-[10px] text-amber-700">Haga clic en la posición para colocarla sobre el plano</span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {unplacedCodes.map(code => (
                              <button
                                key={code}
                                onClick={() => handlePlacePositionAtDefault(code)}
                                className="bg-white hover:bg-amber-100 border-2 border-amber-500 text-amber-900 font-black font-mono text-xs px-2.5 py-1 rounded-lg shadow-sm flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
                                title="Haga clic para colocar en el plano"
                              >
                                <span>●</span>
                                <span>{code}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      <div 
                        ref={layoutRef}
                        onMouseMove={handleCanvasMouseMove}
                        onMouseUp={() => setActiveDraggingPosId(null)}
                        className="relative w-full h-[300px] bg-slate-900 border-2 border-[#DCE3EA] rounded-xl overflow-hidden select-none shadow-inner"
                      >
                        <img 
                          src={lineForm.layout_url || DEFAULT_SMT_LAYOUT} 
                          alt="Blueprint Layout"
                          className="w-full h-full object-contain pointer-events-none opacity-90"
                        />
                        {currentLinePlacedPos.map((pos) => (
                          <div
                            key={pos.id}
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              setActiveDraggingPosId(pos.id);
                            }}
                            style={{
                              left: `${pos.x_percent}%`,
                              top: `${pos.y_percent}%`,
                              transform: 'translate(-50%, -50%)'
                            }}
                            className="absolute cursor-move z-20 transition-transform hover:scale-125 group"
                          >
                            <div className="w-7 h-7 rounded-full bg-[#EF4444] border-2 border-white shadow-lg flex items-center justify-center text-white font-mono font-black text-[10px]">
                              {pos.code.replace('POS', '')}
                            </div>
                            <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[8px] font-mono px-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                              {pos.code}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* SUB-TAB 3: COBERTURA DE COMEDOR */}
                {configSubTab === 'coberturas' && (
                  <div className="space-y-3 text-xs">
                    <div className="bg-[#F5F7FA] p-3 rounded-xl border border-[#DCE3EA] space-y-2">
                      <span className="font-extrabold text-[#005486] uppercase tracking-wider text-[11px] block font-mono">
                        Agregar Ventana Horaria de Comedor
                      </span>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                        <div>
                          <label className="text-[10px] text-slate-500 font-bold block mb-1">Hora Inicio</label>
                          <input
                            type="time"
                            value={covForm.start_time}
                            onChange={(e) => setCovForm({ ...covForm, start_time: e.target.value })}
                            className="w-full bg-white border border-[#DCE3EA] rounded p-1.5 font-mono text-xs"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-500 font-bold block mb-1">Hora Fin</label>
                          <input
                            type="time"
                            value={covForm.end_time}
                            onChange={(e) => setCovForm({ ...covForm, end_time: e.target.value })}
                            className="w-full bg-white border border-[#DCE3EA] rounded p-1.5 font-mono text-xs"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-500 font-bold block mb-1">Operadores Requeridos</label>
                          <div className="flex gap-2">
                            <input
                              type="number"
                              min="1"
                              value={covForm.required_operators}
                              onChange={(e) => setCovForm({ ...covForm, required_operators: Number(e.target.value) })}
                              className="w-full bg-white border border-[#DCE3EA] rounded p-1.5 font-mono font-bold text-xs"
                            />
                            <button
                              onClick={handleSaveCoverage}
                              className="bg-[#005486] hover:bg-[#003f66] text-white px-3 py-1.5 rounded-lg font-bold text-xs shrink-0 cursor-pointer"
                            >
                              + Agregar
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="border border-[#DCE3EA] rounded-xl overflow-hidden shadow-sm bg-white">
                      <table className="w-full text-left border-collapse">
                        <thead className="bg-[#F5F7FA] border-b border-[#DCE3EA] text-[10px] font-black uppercase text-slate-600 tracking-wider">
                          <tr>
                            <th className="py-2 px-3">Inicio</th>
                            <th className="py-2 px-3">Fin</th>
                            <th className="py-2 px-3">Requeridos</th>
                            <th className="py-2 px-3 text-right">Acción</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#DCE3EA]">
                          {activeCoverages.length === 0 ? (
                            <tr>
                              <td colSpan={4} className="py-4 text-center text-slate-400 font-semibold italic">
                                No hay ventanas de comedor configuradas para esta línea.
                              </td>
                            </tr>
                          ) : (
                            activeCoverages.map(c => (
                              <tr key={c.id} className="hover:bg-[#F5F7FA]">
                                <td className="py-2 px-3 font-mono font-bold text-slate-800">{c.start_time}</td>
                                <td className="py-2 px-3 font-mono font-bold text-slate-800">{c.end_time}</td>
                                <td className="py-2 px-3 font-mono font-bold text-[#005486]">{c.required_operators} op</td>
                                <td className="py-2 px-3 text-right">
                                  <button
                                    onClick={async () => {
                                      await supabase.from('coberturas').delete().eq('id', c.id);
                                      showFeedback('success', 'Cobertura eliminada.');
                                      loadData();
                                    }}
                                    className="p-1 hover:bg-red-100 text-red-600 rounded transition-all cursor-pointer"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* SUB-TAB 4: REGISTROS DE ESCANEO (HOY ÚNICAMENTE) */}
                {configSubTab === 'registros' && (
                  <div className="space-y-3 text-xs">
                    <div className="flex items-center justify-between bg-[#F5F7FA] p-3 rounded-xl border border-[#DCE3EA] flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-[#005486]" />
                        <span className="font-extrabold text-[#005486] uppercase tracking-wider text-[11px] font-mono">
                          Historial de Escaneos (HOY) — {selectedLine.name}
                        </span>
                        <span className="text-[10px] text-slate-500 font-bold font-mono bg-white px-2 py-0.5 rounded border border-[#DCE3EA]">
                          {scans.filter((s: any) => {
                            if (s.line_id !== selectedLineId) return false;
                            const scanDate = new Date(s.scan_time || s.created_at || s.event_time || 0);
                            return getLocalDateString(scanDate) === todayLocalStr;
                          }).length} registros hoy
                        </span>
                      </div>
                    </div>

                    <div className="border border-[#DCE3EA] rounded-xl overflow-hidden shadow-sm bg-white max-h-[380px] overflow-y-auto">
                      <table className="w-full text-left border-collapse">
                        <thead className="bg-[#F5F7FA] sticky top-0 z-10 border-b border-[#DCE3EA] text-[10px] font-black uppercase text-slate-600 tracking-wider">
                          <tr>
                            <th className="py-2.5 px-3">Número Empleado</th>
                            <th className="py-2.5 px-3">Hora</th>
                            <th className="py-2.5 px-3">Tipo Evento</th>
                            <th className="py-2.5 px-3 text-right">Acción</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#DCE3EA] text-xs">
                          {(() => {
                            const lineScansToday = scans
                              .filter((s: any) => {
                                if (s.line_id !== selectedLineId) return false;
                                const scanDate = new Date(s.scan_time || s.created_at || s.event_time || 0);
                                return getLocalDateString(scanDate) === todayLocalStr;
                              })
                              .sort((a: any, b: any) => new Date(b.scan_time || b.created_at || b.event_time || 0).getTime() - new Date(a.scan_time || a.created_at || a.event_time || 0).getTime());

                            if (lineScansToday.length === 0) {
                              return (
                                <tr>
                                  <td colSpan={4} className="py-8 text-center text-slate-400 font-semibold italic">
                                    No hay escaneos registrados hoy para esta línea.
                                  </td>
                                </tr>
                              );
                            }

                            return lineScansToday.map((s: any) => {
                              const dt = new Date(s.scan_time || s.created_at || s.event_time);
                              const timeStr = !isNaN(dt.getTime()) ? dt.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) : '--:--:--';
                              const empNum = s.employee_number || s.badge_id || 'N/A';
                              const eventType = s.event_type || 'TURN_START';

                              return (
                                <tr key={s.id} className="hover:bg-[#F5F7FA] transition-colors">
                                  <td className="py-2.5 px-3 font-mono font-extrabold text-[#005486]">{empNum}</td>
                                  <td className="py-2.5 px-3 font-mono text-slate-800 font-bold">{timeStr}</td>
                                  <td className="py-2.5 px-3">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${eventType === 'MEAL_COVERAGE' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                      {eventType}
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-3 text-right">
                                    <button
                                      onClick={() => handleDeleteScan(s.id)}
                                      className="p-1 hover:bg-red-100 text-red-600 rounded transition-all cursor-pointer"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </td>
                                </tr>
                              );
                            });
                          })()}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

              </div>

            ) : (

              /* ANALYTICS DASHBOARD CANVAS (REAL CHARTS FROM SUPABASE ONLY) */
              <div className="space-y-4">
                
                {/* CHARTS GRID WITH REAL DATA ONLY */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  
                  {/* CHART 1: Tiempo Muerto Por Línea (Real Bar Chart con Escala Dinámica) */}
                  <div className="bg-white border border-[#DCE3EA] p-4 rounded-xl shadow-sm flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                        <BarChart2 className="w-4 h-4 text-amber-600" />
                        1. TIEMPO MUERTO POR LÍNEA
                      </h4>
                      <span className="text-[10px] text-amber-700 font-mono font-extrabold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                        Máx: {maxDowntimeValue} min
                      </span>
                    </div>
                    <div className="h-56 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartDowntimeData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                          <XAxis dataKey="name" stroke="#64748B" fontSize={10} />
                          <YAxis stroke="#64748B" fontSize={10} unit=" min" domain={[0, yMaxDowntime]} allowDecimals={false} />
                          <Tooltip formatter={(val: any) => [`${val} min`, 'Tiempo Muerto / Integración']} />
                          <Bar dataKey="minutos" fill="#D97706" radius={[4, 4, 0, 0]} name="Minutos Tiempo Muerto" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* CHART 2: Tiempo de Integración (Real Line Chart con Escala Dinámica) */}
                  <div className="bg-white border border-[#DCE3EA] p-4 rounded-xl shadow-sm flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-[#005486]" />
                        2. TIEMPO DE INTEGRACIÓN
                      </h4>
                      <span className="text-[10px] font-mono font-bold text-[#005486] bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                        Máx: {maxIntegrationValue} min
                      </span>
                    </div>
                    <div className="h-56 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={integrationTimeline.chartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                          <XAxis dataKey="time" stroke="#64748B" fontSize={10} />
                          <YAxis stroke="#64748B" fontSize={10} unit=" min" domain={[0, yMaxIntegration]} allowDecimals={false} />
                          <Tooltip formatter={(val: any, name: any) => [`${val} min`, name]} />
                          <Legend wrapperStyle={{ fontSize: '10px' }} />
                          {lines.slice(0, 6).map((l: any, idx: number) => (
                            <Line
                              key={l.id}
                              type="monotone"
                              dataKey={l.name}
                              stroke={integrationTimeline.lineColors[idx % integrationTimeline.lineColors.length]}
                              strokeWidth={2.5}
                              dot={{ r: 3 }}
                              activeDot={{ r: 6 }}
                            />
                          ))}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                </div>

              </div>

            )}

          </div>

        </div>

      </div>

      {/* MODAL CREAR / EDITAR NUEVA LÍNEA */}
      {isLineCreateModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#DCE3EA] rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
            {/* Modal Header */}
            <div className="bg-[#005486] px-5 py-4 flex items-center justify-between text-white">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5" />
                <h3 className="text-sm font-black tracking-wide uppercase">
                  {lineForm.id ? 'Editar Línea de Producción' : '+ Nueva Línea de Producción'}
                </h3>
              </div>
              <button
                onClick={() => setIsLineCreateModalOpen(false)}
                className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Nombre Línea */}
                <div className="col-span-2 md:col-span-1">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nombre Línea <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Línea 14"
                    value={lineForm.name}
                    onChange={(e) => {
                      setLineForm({ ...lineForm, name: e.target.value });
                      if (formErrors.name) setFormErrors({ ...formErrors, name: undefined });
                    }}
                    className={`w-full bg-white border rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none font-semibold transition-all ${
                      formErrors.name ? 'border-red-500 ring-2 ring-red-100' : 'border-[#DCE3EA] focus:border-[#005486]'
                    }`}
                  />
                  {formErrors.name && (
                    <p className="text-[11px] font-bold text-red-500 mt-1">Ingrese el nombre de la línea</p>
                  )}
                </div>

                {/* Área */}
                <div className="col-span-2 md:col-span-1">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Área <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={lineForm.area_id}
                    onChange={(e) => {
                      setLineForm({ ...lineForm, area_id: e.target.value });
                      if (formErrors.area_id) setFormErrors({ ...formErrors, area_id: undefined });
                    }}
                    className={`w-full bg-white border rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none font-semibold cursor-pointer transition-all ${
                      formErrors.area_id ? 'border-red-500 ring-2 ring-red-100' : 'border-[#DCE3EA] focus:border-[#005486]'
                    }`}
                  >
                    <option value="">Seleccione Área...</option>
                    {areas.map(a => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                  {formErrors.area_id && (
                    <p className="text-[11px] font-bold text-red-500 mt-1">Seleccione un área</p>
                  )}
                </div>

                {/* Proceso */}
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Proceso / Descripción
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Ensamble SMT SIPLACE"
                    value={lineForm.process}
                    onChange={(e) => setLineForm({ ...lineForm, process: e.target.value })}
                    className="w-full bg-white border border-[#DCE3EA] rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-[#005486]"
                  />
                </div>

                {/* Turno 1 */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Turno 1 Inicio
                  </label>
                  <input
                    type="time"
                    value={lineForm.shift1_start}
                    onChange={(e) => setLineForm({ ...lineForm, shift1_start: e.target.value })}
                    className="w-full bg-white border border-[#DCE3EA] rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-[#005486]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Plantilla Turno 1
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={lineForm.shift1_target}
                    onChange={(e) => setLineForm({ ...lineForm, shift1_target: Number(e.target.value) })}
                    className="w-full bg-white border border-[#DCE3EA] rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-[#005486]"
                  />
                </div>

                {/* Turno 2 */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Turno 2 Inicio
                  </label>
                  <input
                    type="time"
                    value={lineForm.shift2_start}
                    onChange={(e) => setLineForm({ ...lineForm, shift2_start: e.target.value })}
                    className="w-full bg-white border border-[#DCE3EA] rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-[#005486]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Plantilla Turno 2
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={lineForm.shift2_target}
                    onChange={(e) => setLineForm({ ...lineForm, shift2_target: Number(e.target.value) })}
                    className="w-full bg-white border border-[#DCE3EA] rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-[#005486]"
                  />
                </div>

                {/* Turno 3 */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Turno 3 Inicio
                  </label>
                  <input
                    type="time"
                    value={lineForm.shift3_start}
                    onChange={(e) => setLineForm({ ...lineForm, shift3_start: e.target.value })}
                    className="w-full bg-white border border-[#DCE3EA] rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-[#005486]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Plantilla Turno 3
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={lineForm.shift3_target}
                    onChange={(e) => setLineForm({ ...lineForm, shift3_target: Number(e.target.value) })}
                    className="w-full bg-white border border-[#DCE3EA] rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-[#005486]"
                  />
                </div>

                {/* Estado */}
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Estado Inicial
                  </label>
                  <select
                    value={(lineForm as any).status || 'FALTA PERSONAL'}
                    onChange={(e) => setLineForm({ ...lineForm, status: e.target.value } as any)}
                    className="w-full bg-white border border-[#DCE3EA] rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-[#005486] font-semibold cursor-pointer"
                  >
                    <option value="FALTA PERSONAL">🔴 FALTA PERSONAL</option>
                    <option value="COMPLETO">🟢 COMPLETO</option>
                    <option value="COBERTURA ACTIVA">🔵 COBERTURA ACTIVA</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-[#F5F7FA] px-5 py-3 border-t border-[#DCE3EA] flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsLineCreateModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-200 transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveLine}
                className="bg-[#005486] hover:bg-[#003f66] text-white px-5 py-2 rounded-xl text-xs font-extrabold shadow-sm transition-all cursor-pointer"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CINTA DE DEPURACIÓN EN VIVO (TEMPORAL) */}
      <div className="bg-slate-900 text-slate-300 text-[10px] font-mono px-4 py-1.5 flex items-center justify-between border-t border-slate-700 shrink-0 rounded-xl">
        <div className="flex items-center gap-4">
          <span>📅 <strong>Fecha Detectada:</strong> <span className="text-emerald-400">{getLocalDateString(new Date())}</span></span>
          <span>⏱️ <strong>Turno Detectado:</strong> <span className="text-emerald-400">{lines[0] ? getCurrentShift(lines[0], new Date()).shiftName : 'Turno 1'}</span></span>
        </div>
        <div className="flex items-center gap-4">
          <span>🔍 <strong>Total BD:</strong> <span className="text-amber-400">{scans.length} escaneos</span></span>
          <span>✅ <strong>Modo:</strong> <span className="text-emerald-400">Fuente Única de Verdad (Hoy + Turno)</span></span>
        </div>
      </div>

    </div>
  );
};
