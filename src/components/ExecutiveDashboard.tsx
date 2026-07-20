import React, { useEffect, useState } from 'react';
import { supabase, getActiveStaffingTarget, DEFAULT_SMT_LAYOUT, mapScanFromSupabase } from '../lib/supabaseClient';
import { 
  Users, AlertTriangle, Clock, Percent, Search, Settings, ExternalLink, 
  BarChart2, LineChart as LineChartIcon, PieChart as PieChartIcon, Layers, 
  Save, Upload, CheckCircle2, Plus, X
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { 
  ResponsiveContainer, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, 
  XAxis, YAxis, Tooltip, Legend, CartesianGrid 
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
  const [configSubTab, setConfigSubTab] = useState<'lines' | 'coverages' | 'layout' | 'registros'>('lines');
  
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

  // Dynamic Chart Visibility Toggles (PANEL DINÁMICO)
  const [visibleCharts, setVisibleCharts] = useState({
    downtime: true,
    complianceTrend: true,
    rampUpTime: true,
    coverageHistory: true,
    dailyDonut: true
  });

  // Analytics Filters
  const [analyticsFilterLine, setAnalyticsFilterLine] = useState('ALL');
  const [analyticsFilterShift, setAnalyticsFilterShift] = useState('ALL');
  const [analyticsFilterPeriod, setAnalyticsFilterPeriod] = useState('HOY');
  const [analyticsFilterDate, setAnalyticsFilterDate] = useState(new Date().toISOString().split('T')[0]);

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

  // Helper count present operators based on distinct scanned employee numbers
  const getPresentOperatorsCount = (lineId: string) => {
    const lineScans = scans.filter((s: any) => s.line_id === lineId);
    const distinctNumbers = new Set(
      lineScans.map((s: any) => s.employee_number || s.badge_id).filter(Boolean)
    );
    return distinctNumbers.size;
  };

  // Helper active downtime minutes
  const getActiveDowntimeMinutes = (lineId: string) => {
    const activeDt = downtimes.find((dt: any) => dt.line_id === lineId && !dt.resolved);
    if (!activeDt) return 0;
    const elapsedMs = new Date().getTime() - new Date(activeDt.start_time).getTime();
    return Math.max(0, Math.floor(elapsedMs / 60000));
  };

  // Line selection action -> Open Integrated Line Configurator in right panel
  const handleSelectLine = (lineId: string) => {
    setSelectedLineId(lineId);
    setRightPanelMode('config');
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

  const handleRemovePositionFromCanvas = (code: string) => {
    if (!selectedLineId) return;
    setPosiciones(prev =>
      prev.map(p => (p.line_id === selectedLineId && p.code === code) ? { ...p, placed: false } : p)
    );
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

  // KPI Calculations
  let totalRequired = 0;
  let totalPresent = 0;
  let missingCount = 0;
  let totalDowntimeToday = 0;

  lines.forEach((line: any) => {
    const { target } = getActiveStaffingTarget(line.id);
    const present = getPresentOperatorsCount(line.id);
    totalRequired += target;
    totalPresent += present;
    if (present < target) missingCount += (target - present);
  });

  const todayStr = new Date().toISOString().split('T')[0];
  downtimes.forEach((dt: any) => {
    if (dt.date === todayStr) {
      const duration = dt.resolved ? (dt.duration_minutes || 0) : getActiveDowntimeMinutes(dt.line_id);
      totalDowntimeToday += duration;
    }
  });

  const globalCoveragePct = totalRequired > 0 ? Math.round((totalPresent / totalRequired) * 100) : 0;

  // Filter lines for left list
  const filteredLines = lines.filter((line: any) => {
    const matchesSearch = line.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesArea = selectedArea === 'ALL' || line.area_id === selectedArea;
    return matchesSearch && matchesArea;
  });

  // Chart Data Preparation
  const chartDowntimeData = lines.map(l => ({
    name: l.name,
    minutos: getActiveDowntimeMinutes(l.id)
  }));

  const chartComplianceTrendData = [
    { hora: '06:00', meta: 100, cumplimiento: 75 },
    { hora: '08:00', meta: 100, cumplimiento: 92 },
    { hora: '10:00', meta: 100, cumplimiento: 100 },
    { hora: '12:00', meta: 100, cumplimiento: 98 },
    { hora: '14:00', meta: 100, cumplimiento: 88 },
    { hora: '16:00', meta: 100, cumplimiento: 95 }
  ];

  const chartRampUpData = [
    { dia: 'Lun', mins: 14 },
    { dia: 'Mar', mins: 12 },
    { dia: 'Mié', mins: 8 },
    { dia: 'Jue', mins: 10 },
    { dia: 'Vie', mins: 15 }
  ];

  const chartCoverageHistoryData = [
    { turno: 'Turno 1', presentes: 18, coberturas: 4, ausentes: 2 },
    { turno: 'Turno 2', presentes: 16, coberturas: 3, ausentes: 3 },
    { turno: 'Turno 3', presentes: 12, coberturas: 1, ausentes: 4 }
  ];

  const chartDonutData = [
    { name: 'Completo (100%)', value: 65, color: '#22C55E' },
    { name: 'Atención (80-99%)', value: 20, color: '#EAB308' },
    { name: 'Falta Personal (<80%)', value: 15, color: '#EF4444' }
  ];

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
            className={`w-full py-2 px-3 rounded-lg text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm ${
              rightPanelMode === 'config'
                ? 'bg-[#005486] text-white'
                : 'bg-[#F5F7FA] text-slate-700 hover:bg-slate-200 border border-[#DCE3EA]'
            }`}
          >
            {rightPanelMode === 'config' ? (
              <>
                <BarChart2 className="w-4 h-4" />
                <span>Ver Área Analítica</span>
              </>
            ) : (
              <>
                <Settings className="w-4 h-4 text-[#005486]" />
                <span>{selectedLineId ? 'Configuración Línea' : 'Seleccione Línea'}</span>
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
                  <th className="py-2.5 px-3 w-10 text-center">St</th>
                  <th className="py-2.5 px-3">Nombre</th>
                  <th className="py-2.5 px-3">Cobertura</th>
                  <th className="py-2.5 px-3">Personal</th>
                  <th className="py-2.5 px-3">TM</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DCE3EA]">
                {filteredLines.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 px-4 text-center">
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
                  const { target, isCoverageActive } = getActiveStaffingTarget(line.id);
                  const present = getPresentOperatorsCount(line.id);
                  const pct = target > 0 ? Math.round((present / target) * 100) : 0;
                  const activeDtMin = getActiveDowntimeMinutes(line.id);
                  const isSelected = selectedLineId === line.id && rightPanelMode === 'config';

                  let statusEmoji = '🔴';
                  let statusColor = '#EF4444';
                  if (isCoverageActive && present >= target) {
                    statusEmoji = '🔵';
                    statusColor = '#3B82F6';
                  } else if (pct >= 100) {
                    statusEmoji = '🟢';
                    statusColor = '#22C55E';
                  } else if (pct >= 80) {
                    statusEmoji = '🟡';
                    statusColor = '#EAB308';
                  }

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
                        {activeDtMin > 0 ? <span className="text-amber-600 font-bold">{activeDtMin}m</span> : '0m'}
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
                  className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 text-white font-extrabold px-3.5 py-1.5 rounded-xl text-xs transition-all shadow-md cursor-pointer"
                  title="Abrir vista operativa con layout visual, posiciones y escaneo"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Ver Monitor Operativo</span>
                </button>

                <button
                  onClick={() => setRightPanelMode('analytics')}
                  className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-all cursor-pointer border border-white/20"
                >
                  Cerrar
                </button>
              </div>
            </div>

          ) : (

            /* MODE B: ANALYTICAL CENTER TOOLBAR */
            <div className="p-3 border-b border-[#DCE3EA] bg-[#F5F7FA] flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex items-center space-x-2">
                <BarChart2 className="w-4 h-4 text-[#005486]" />
                <span className="text-xs font-black uppercase text-slate-800 tracking-wider">Centro Analítico MES</span>
              </div>

              {/* Analytics Global Filters */}
              <div className="flex items-center flex-wrap gap-2 text-xs">
                <select
                  value={analyticsFilterLine}
                  onChange={(e) => setAnalyticsFilterLine(e.target.value)}
                  className="bg-white border border-[#DCE3EA] rounded-lg px-2 py-1 font-bold text-slate-700 focus:outline-none cursor-pointer"
                >
                  <option value="ALL">Todas las Líneas</option>
                  {lines.map(l => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>

                <select
                  value={analyticsFilterShift}
                  onChange={(e) => setAnalyticsFilterShift(e.target.value)}
                  className="bg-white border border-[#DCE3EA] rounded-lg px-2 py-1 font-bold text-slate-700 focus:outline-none cursor-pointer"
                >
                  <option value="ALL">Todos los Turnos</option>
                  <option value="T1">Turno 1</option>
                  <option value="T2">Turno 2</option>
                  <option value="T3">Turno 3</option>
                </select>

                <select
                  value={analyticsFilterPeriod}
                  onChange={(e) => setAnalyticsFilterPeriod(e.target.value)}
                  className="bg-white border border-[#DCE3EA] rounded-lg px-2 py-1 font-bold text-slate-700 focus:outline-none cursor-pointer"
                >
                  <option value="HOY">Hoy</option>
                  <option value="SEMANA">Esta Semana</option>
                  <option value="MES">Este Mes</option>
                </select>

                <input
                  type="date"
                  value={analyticsFilterDate}
                  onChange={(e) => setAnalyticsFilterDate(e.target.value)}
                  className="bg-white border border-[#DCE3EA] rounded-lg px-2 py-1 text-slate-700 font-mono focus:outline-none cursor-pointer"
                />
              </div>
            </div>

          )}

          {/* RIGHT PANEL BODY */}
          <div className="flex-1 min-h-0 overflow-y-auto p-4">
            
            {/* ============================================================ */}
            {/* MODE A VIEW: INTEGRATED LINE CONFIGURATION FORM             */}
            {/* ============================================================ */}
            {rightPanelMode === 'config' && selectedLine ? (
              <div className="space-y-4">
                
                {/* Configuration Sub-Tabs Header */}
                <div className="h-10 border-b border-[#DCE3EA] flex items-center space-x-4 shrink-0">
                  <button
                    onClick={() => setConfigSubTab('lines')}
                    className={`text-xs font-bold uppercase tracking-wider h-full border-b-2 flex items-center cursor-pointer ${
                      configSubTab === 'lines' ? 'border-[#005486] text-[#005486]' : 'border-transparent text-slate-500'
                    }`}
                  >
                    Parámetros
                  </button>
                  <button
                    onClick={() => setConfigSubTab('layout')}
                    className={`text-xs font-bold uppercase tracking-wider h-full border-b-2 flex items-center cursor-pointer ${
                      configSubTab === 'layout' ? 'border-[#005486] text-[#005486]' : 'border-transparent text-slate-500'
                    }`}
                  >
                    Layout & Posiciones
                  </button>
                  <button
                    onClick={() => setConfigSubTab('coverages')}
                    className={`text-xs font-bold uppercase tracking-wider h-full border-b-2 flex items-center cursor-pointer ${
                      configSubTab === 'coverages' ? 'border-[#005486] text-[#005486]' : 'border-transparent text-slate-500'
                    }`}
                  >
                    Coberturas Comedor
                  </button>
                  <button
                    onClick={() => setConfigSubTab('registros')}
                    className={`text-xs font-bold uppercase tracking-wider h-full border-b-2 flex items-center cursor-pointer ${
                      configSubTab === 'registros' ? 'border-[#005486] text-[#005486]' : 'border-transparent text-slate-500'
                    }`}
                  >
                    Registros
                  </button>
                </div>

                {/* SUB-TAB 1: PARAMETROS */}
                {configSubTab === 'lines' && (
                  <div className="space-y-4 text-xs">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block font-bold text-slate-600 uppercase mb-1">Nombre Línea</label>
                        <input
                          type="text"
                          value={lineForm.name}
                          onChange={(e) => setLineForm({ ...lineForm, name: e.target.value })}
                          className="w-full bg-[#F5F7FA] border border-[#DCE3EA] rounded-lg p-2 font-extrabold text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-slate-600 uppercase mb-1">Área</label>
                        <select
                          value={lineForm.area_id}
                          onChange={(e) => setLineForm({ ...lineForm, area_id: e.target.value })}
                          className="w-full bg-[#F5F7FA] border border-[#DCE3EA] rounded-lg p-2 font-bold text-slate-800"
                        >
                          {areas.map(a => (
                            <option key={a.id} value={a.id}>{a.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Shifts targets */}
                    <div className="bg-[#F5F7FA] border border-[#DCE3EA] p-3 rounded-xl space-y-3">
                      <span className="font-extrabold uppercase text-[#005486] text-[11px] block">Metas de Operadores por Turno</span>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="bg-white p-2.5 rounded-lg border border-[#DCE3EA]">
                          <span className="font-bold block mb-1">Turno 1</span>
                          <input
                            type="number"
                            min="1"
                            value={lineForm.shift1_target}
                            onChange={(e) => setLineForm({ ...lineForm, shift1_target: Number(e.target.value) })}
                            className="w-full bg-[#F5F7FA] border border-[#DCE3EA] rounded p-1 font-mono font-bold"
                          />
                        </div>
                        <div className="bg-white p-2.5 rounded-lg border border-[#DCE3EA]">
                          <span className="font-bold block mb-1">Turno 2</span>
                          <input
                            type="number"
                            min="1"
                            value={lineForm.shift2_target}
                            onChange={(e) => setLineForm({ ...lineForm, shift2_target: Number(e.target.value) })}
                            className="w-full bg-[#F5F7FA] border border-[#DCE3EA] rounded p-1 font-mono font-bold"
                          />
                        </div>
                        <div className="bg-white p-2.5 rounded-lg border border-[#DCE3EA]">
                          <span className="font-bold block mb-1">Turno 3</span>
                          <input
                            type="number"
                            min="1"
                            value={lineForm.shift3_target}
                            onChange={(e) => setLineForm({ ...lineForm, shift3_target: Number(e.target.value) })}
                            className="w-full bg-[#F5F7FA] border border-[#DCE3EA] rounded p-1 font-mono font-bold"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-between items-center pt-2">
                      <button
                        onClick={() => navigate(`/linea/${selectedLine.id}`)}
                        className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2 rounded-xl text-xs shadow-sm cursor-pointer"
                      >
                        <ExternalLink className="w-4 h-4" />
                        <span>Ver Monitor Operativo</span>
                      </button>

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

                {/* SUB-TAB 2: LAYOUT & POSICIONES OPERATIVAS */}
                {configSubTab === 'layout' && (() => {
                  const targetCount = Math.max(1, getActiveStaffingTarget(selectedLineId || '').target || selectedLine.shift1_target || 6);
                  const targetPosCodes = Array.from({ length: targetCount }, (_, i) => `POS${String(i + 1).padStart(2, '0')}`);
                  const currentLinePlacedPos = posiciones.filter(p => p.line_id === selectedLineId && p.placed !== false);
                  const placedPosCodes = new Set(currentLinePlacedPos.map(p => p.code));
                  const unplacedCodes = targetPosCodes.filter(code => !placedPosCodes.has(code));
                  const placedCount = currentLinePlacedPos.length;

                  return (
                    <div className="space-y-3 text-xs">
                      {/* Header Controls */}
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

                      {/* Unplaced Positions Workbench Drawer */}
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

                      {/* Drag Canvas */}
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
                            key={pos.id || pos.code}
                            style={{ left: `${pos.x_percent}%`, top: `${pos.y_percent}%`, transform: 'translate(-50%, -50%)' }}
                            onMouseDown={() => setActiveDraggingPosId(pos.id || pos.code)}
                            className="absolute z-20 cursor-move group"
                          >
                            {/* Minimal Icon Node: ● POS01 */}
                            <div className="flex items-center gap-1 bg-white/95 backdrop-blur-sm border-2 border-[#005486] text-[#005486] px-2 py-0.5 rounded-full shadow-lg text-[10px] font-black font-mono tracking-wider group-hover:scale-110 transition-transform">
                              <span className="w-2 h-2 rounded-full bg-[#005486]" />
                              <span>{pos.code}</span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemovePositionFromCanvas(pos.code);
                                }}
                                className="ml-1 text-slate-400 hover:text-red-500 font-extrabold text-[10px] transition-colors"
                                title="Quitar del plano"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* SUB-TAB 3: COBERTURAS COMEDOR */}
                {configSubTab === 'coverages' && (
                  <div className="space-y-4 text-xs">
                    <div className="bg-[#F5F7FA] p-3 rounded-xl border border-[#DCE3EA] space-y-2">
                      <span className="font-bold text-[#005486] uppercase block text-[11px]">Agregar Horario de Comedor</span>
                      <div className="grid grid-cols-3 gap-2">
                        <input
                          type="time"
                          value={covForm.start_time}
                          onChange={(e) => setCovForm({ ...covForm, start_time: e.target.value })}
                          className="bg-white border border-[#DCE3EA] rounded p-1.5"
                        />
                        <input
                          type="time"
                          value={covForm.end_time}
                          onChange={(e) => setCovForm({ ...covForm, end_time: e.target.value })}
                          className="bg-white border border-[#DCE3EA] rounded p-1.5"
                        />
                        <input
                          type="number"
                          value={covForm.required_operators}
                          onChange={(e) => setCovForm({ ...covForm, required_operators: Number(e.target.value) })}
                          className="bg-white border border-[#DCE3EA] rounded p-1.5 font-mono font-bold"
                        />
                      </div>
                      <button
                        onClick={handleSaveCoverage}
                        className="w-full bg-[#005486] text-white font-bold py-1.5 rounded-lg shadow-sm cursor-pointer"
                      >
                        Guardar Regla Cobertura
                      </button>
                    </div>

                    <div className="space-y-1">
                      {activeCoverages.map(cov => (
                        <div key={cov.id} className="p-2 bg-[#F5F7FA] border border-[#DCE3EA] rounded-lg font-mono font-bold">
                          {cov.start_time} - {cov.end_time} | Target: {cov.required_operators} op
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* SUB-TAB 4: REGISTROS DE ESCANEO */}
                {configSubTab === 'registros' && (
                  <div className="space-y-3 text-xs">
                    <div className="flex items-center justify-between bg-[#F5F7FA] p-3 rounded-xl border border-[#DCE3EA]">
                      <span className="font-extrabold text-[#005486] uppercase tracking-wider text-[11px] flex items-center gap-1.5 font-mono">
                        <Clock className="w-4 h-4 text-[#005486]" />
                        Historial de Escaneos — {selectedLine.name}
                      </span>
                      <span className="text-[10px] text-slate-500 font-bold font-mono">
                        Total: {scans.filter((s: any) => s.line_id === selectedLineId).length} registros
                      </span>
                    </div>

                    <div className="border border-[#DCE3EA] rounded-xl overflow-hidden shadow-sm bg-white max-h-[360px] overflow-y-auto">
                      <table className="w-full text-left border-collapse">
                        <thead className="bg-[#F5F7FA] sticky top-0 z-10 border-b border-[#DCE3EA] text-[10px] font-black uppercase text-slate-600 tracking-wider">
                          <tr>
                            <th className="py-2.5 px-3">Número Empleado</th>
                            <th className="py-2.5 px-3">Hora Registro</th>
                            <th className="py-2.5 px-3">Fecha</th>
                            <th className="py-2.5 px-3">Tipo Evento</th>
                            <th className="py-2.5 px-3">Línea</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#DCE3EA] text-xs">
                          {(() => {
                            const lineScans = scans
                              .filter((s: any) => s.line_id === selectedLineId)
                              .sort((a: any, b: any) => new Date(b.scan_time || b.created_at || b.event_time || 0).getTime() - new Date(a.scan_time || a.created_at || a.event_time || 0).getTime());

                            if (lineScans.length === 0) {
                              return (
                                <tr>
                                  <td colSpan={5} className="py-8 text-center text-slate-400 font-semibold italic">
                                    No hay escaneos registrados para esta línea.
                                  </td>
                                </tr>
                              );
                            }

                            return lineScans.map((s: any) => {
                              const dt = new Date(s.scan_time || s.created_at || s.event_time);
                              const isValidDate = !isNaN(dt.getTime());
                              const timeStr = isValidDate ? dt.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) : '--:--:--';
                              const dateStr = isValidDate ? dt.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Hoy';
                              const empNum = s.employee_number || s.badge_id || 'N/A';
                              const eventType = s.event_type || 'TURN_START';

                              return (
                                <tr key={s.id || `${empNum}-${dt.getTime()}`} className="hover:bg-[#F5F7FA] transition-colors">
                                  <td className="py-2.5 px-3 font-mono font-extrabold text-[#005486]">
                                    {empNum}
                                  </td>
                                  <td className="py-2.5 px-3 font-mono text-slate-800 font-bold">
                                    {timeStr}
                                  </td>
                                  <td className="py-2.5 px-3 text-slate-600 font-semibold">
                                    {dateStr}
                                  </td>
                                  <td className="py-2.5 px-3">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                                      eventType === 'MEAL_COVERAGE' ? 'bg-blue-100 text-blue-700 border border-blue-200' : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                                    }`}>
                                      {eventType}
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-3 font-bold text-slate-700">
                                    {selectedLine.name}
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

              /* ============================================================ */
              /* MODE B VIEW: OPERATIONAL ANALYTICS DASHBOARD WITH CHARTS   */
              /* ============================================================ */
              <div className="space-y-4">
                
                {/* PANEL DINÁMICO: Dynamic Chart Visibility Customizer Checkboxes */}
                <div className="bg-[#F5F7FA] border border-[#DCE3EA] p-3 rounded-xl space-y-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">
                    ⚡ Panel Dinámico: Seleccione los gráficos a visualizar
                  </span>

                  <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-slate-700">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={visibleCharts.downtime}
                        onChange={(e) => setVisibleCharts({ ...visibleCharts, downtime: e.target.checked })}
                        className="accent-[#005486]"
                      />
                      <span>Tiempo Muerto</span>
                    </label>

                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={visibleCharts.complianceTrend}
                        onChange={(e) => setVisibleCharts({ ...visibleCharts, complianceTrend: e.target.checked })}
                        className="accent-[#005486]"
                      />
                      <span>Cumplimiento %</span>
                    </label>

                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={visibleCharts.rampUpTime}
                        onChange={(e) => setVisibleCharts({ ...visibleCharts, rampUpTime: e.target.checked })}
                        className="accent-[#005486]"
                      />
                      <span>Tiempo Integración</span>
                    </label>

                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={visibleCharts.coverageHistory}
                        onChange={(e) => setVisibleCharts({ ...visibleCharts, coverageHistory: e.target.checked })}
                        className="accent-[#005486]"
                      />
                      <span>Historial Cobertura</span>
                    </label>

                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={visibleCharts.dailyDonut}
                        onChange={(e) => setVisibleCharts({ ...visibleCharts, dailyDonut: e.target.checked })}
                        className="accent-[#005486]"
                      />
                      <span>Cumplimiento Diario</span>
                    </label>
                  </div>
                </div>

                {/* CHARTS GRID (Auto-Reorganizes Based on Active Toggles) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  
                  {/* CHART 1: Tiempo Muerto Por Línea (Bar Chart) */}
                  {visibleCharts.downtime && (
                    <div className="bg-white border border-[#DCE3EA] p-4 rounded-xl shadow-sm flex flex-col justify-between">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                          <BarChart2 className="w-4 h-4 text-amber-600" />
                          1. Tiempo Muerto Por Línea (min)
                        </h4>
                      </div>
                      <div className="h-48 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={chartDowntimeData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                            <XAxis dataKey="name" stroke="#64748B" fontSize={10} />
                            <YAxis stroke="#64748B" fontSize={10} />
                            <Tooltip />
                            <Bar dataKey="minutos" fill="#D97706" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}

                  {/* CHART 2: Tendencia de Cumplimiento (Line Chart: Meta vs Real) */}
                  {visibleCharts.complianceTrend && (
                    <div className="bg-white border border-[#DCE3EA] p-4 rounded-xl shadow-sm flex flex-col justify-between">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                          <LineChartIcon className="w-4 h-4 text-[#005486]" />
                          2. Tendencia de Cumplimiento (%)
                        </h4>
                      </div>
                      <div className="h-48 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={chartComplianceTrendData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                            <XAxis dataKey="hora" stroke="#64748B" fontSize={10} />
                            <YAxis domain={[0, 110]} stroke="#64748B" fontSize={10} />
                            <Tooltip />
                            <Legend />
                            <Line type="monotone" dataKey="meta" stroke="#94A3B8" strokeDasharray="5 5" name="Meta Target" />
                            <Line type="monotone" dataKey="cumplimiento" stroke="#005486" strokeWidth={2} name="Cumplimiento Real" />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}

                  {/* CHART 3: Tiempo Para Completar Plantilla (Line Ramp Up Chart) */}
                  {visibleCharts.rampUpTime && (
                    <div className="bg-white border border-[#DCE3EA] p-4 rounded-xl shadow-sm flex flex-col justify-between">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                          <Clock className="w-4 h-4 text-emerald-600" />
                          3. Tiempo Integración Plantilla (min)
                        </h4>
                      </div>
                      <div className="h-48 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={chartRampUpData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                            <XAxis dataKey="dia" stroke="#64748B" fontSize={10} />
                            <YAxis stroke="#64748B" fontSize={10} />
                            <Tooltip />
                            <Line type="monotone" dataKey="mins" stroke="#10B981" strokeWidth={2} name="Minutos Integración" />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}

                  {/* CHART 4: Historial de Cobertura (Stacked Bar Chart) */}
                  {visibleCharts.coverageHistory && (
                    <div className="bg-white border border-[#DCE3EA] p-4 rounded-xl shadow-sm flex flex-col justify-between">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                          <Layers className="w-4 h-4 text-blue-600" />
                          4. Historial de Cobertura por Turno
                        </h4>
                      </div>
                      <div className="h-48 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={chartCoverageHistoryData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                            <XAxis dataKey="turno" stroke="#64748B" fontSize={10} />
                            <YAxis stroke="#64748B" fontSize={10} />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="presentes" stackId="a" fill="#22C55E" name="Presentes" />
                            <Bar dataKey="coberturas" stackId="a" fill="#3B82F6" name="Coberturas" />
                            <Bar dataKey="ausentes" stackId="a" fill="#EF4444" name="Ausentes" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}

                  {/* CHART 5: Cumplimiento Diario (Donut Chart) */}
                  {visibleCharts.dailyDonut && (
                    <div className="col-span-1 md:col-span-2 bg-white border border-[#DCE3EA] p-4 rounded-xl shadow-sm flex flex-col justify-between">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                          <PieChartIcon className="w-4 h-4 text-purple-600" />
                          5. Distribución de Cumplimiento Diario (Donut Chart)
                        </h4>
                      </div>
                      <div className="h-48 w-full flex items-center justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={chartDonutData}
                              cx="50%"
                              cy="50%"
                              innerRadius={45}
                              outerRadius={75}
                              paddingAngle={4}
                              dataKey="value"
                            >
                              {chartDonutData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip />
                            <Legend />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}

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

    </div>
  );
};
