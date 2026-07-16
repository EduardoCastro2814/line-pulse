import React, { useEffect, useState, useRef } from 'react';
import { supabase, getActiveStaffingTarget } from '../lib/supabaseClient';
import { X, Clock, UserCheck, Eye, Maximize, Minimize, AlertCircle, History } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';

interface LineDetailsModalProps {
  lineId?: string;
  isOpen?: boolean;
  onClose?: () => void;
  isTvView?: boolean;
}

export const LineDetailsModal: React.FC<LineDetailsModalProps> = ({ 
  lineId: propLineId, 
  isOpen: propIsOpen, 
  onClose: propOnClose, 
  isTvView: propIsTvView 
}) => {
  const { lineId: routeLineId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Route vs Prop adaptation
  const lineId = routeLineId || propLineId || '';
  const isTvView = searchParams.get('tv') === 'true' || propIsTvView || false;
  const isModal = !!propOnClose;
  const isOpen = propIsOpen !== undefined ? propIsOpen : !!lineId;

  const [line, setLine] = useState<any>(null);
  const [escaneos, setEscaneos] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [tiemposMuertos, setTiemposMuertos] = useState<any[]>([]);

  // Inline scanner states
  const [scanInput, setScanInput] = useState('');
  const [scanFeedback, setScanFeedback] = useState<{
    status: 'success' | 'error' | null;
    message: string;
  }>({ status: null, message: '' });

  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Secondary Scan History Modal State
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // Big Clock & Elapsed Time tickers
  const [currentTimeStr, setCurrentTimeStr] = useState('00:00:00');
  const [ampmStr, setAmpmStr] = useState('AM');
  const [elapsedTimeStr, setElapsedTimeStr] = useState('00:00:00');

  const scanInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error('Error entering fullscreen:', err);
      });
    } else {
      document.exitFullscreen().catch(err => {
        console.error('Error exiting fullscreen:', err);
      });
    }
  };

  const handleClose = () => {
    if (propOnClose) {
      propOnClose();
    } else {
      if (isTvView) {
        navigate('/monitor');
      } else {
        navigate('/dashboard');
      }
    }
  };

  const loadData = async () => {
    if (!lineId) return;

    // Load line info
    const { data: lineData } = await supabase.from('lineas').select('*, area:areas(*)').eq('id', lineId);
    if (lineData && lineData.length > 0) setLine(lineData[0]);

    // Load ALL scans (both successful and failed)
    const { data: escData } = await supabase.from('escaneos').select('*').eq('line_id', lineId);
    if (escData) setEscaneos(escData);

    // Load assignments
    const { data: assignData } = await supabase.from('empleados_linea').select('*, empleado:empleados(*)').eq('line_id', lineId);
    if (assignData) setAssignments(assignData);

    // Load downtime logs
    const { data: tmData } = await supabase.from('tiempos_muertos').select('*').eq('line_id', lineId);
    if (tmData) setTiemposMuertos(tmData);
  };

  // Real-time Clock and Shift elapsed timer check loop
  useEffect(() => {
    if (!isOpen || !line) return;

    const tick = () => {
      const now = new Date();

      // 1. Update big clock
      let hrs = now.getHours();
      const ampm = hrs >= 12 ? 'PM' : 'AM';
      hrs = hrs % 12;
      hrs = hrs ? hrs : 12; // hour '0' shifts to '12'
      const mins = now.getMinutes().toString().padStart(2, '0');
      const secs = now.getSeconds().toString().padStart(2, '0');
      
      setCurrentTimeStr(`${hrs.toString().padStart(2, '0')}:${mins}:${secs}`);
      setAmpmStr(ampm);

      // 2. Calculate elapsed shift duration
      const { activeShiftName } = getActiveStaffingTarget(line.id);
      const shiftStartTimeStr = activeShiftName === 'Primero' ? line.shift1_start 
                              : activeShiftName === 'Segundo' ? line.shift2_start 
                              : line.shift3_start;

      const shiftStart = new Date(now.getTime());
      const [sh, sm, ss] = shiftStartTimeStr.split(':').map(Number);
      shiftStart.setHours(sh, sm, ss || 0, 0);

      // Midnight crossover adjustments
      if (shiftStart.getTime() > now.getTime()) {
        shiftStart.setDate(shiftStart.getDate() - 1);
      }

      const diffMs = now.getTime() - shiftStart.getTime();
      const diffSecs = Math.floor(diffMs / 1000);
      const eHrs = Math.floor(diffSecs / 3600);
      const eMins = Math.floor((diffSecs % 3600) / 60);
      const eSecs = diffSecs % 60;

      setElapsedTimeStr(
        `${eHrs.toString().padStart(2, '0')}:${eMins.toString().padStart(2, '0')}:${eSecs.toString().padStart(2, '0')}`
      );
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [isOpen, line]);

  useEffect(() => {
    if (isOpen && lineId) {
      loadData();

      // Focus scanner input field
      setTimeout(() => {
        scanInputRef.current?.focus();
      }, 350);

      // Subscribe to real-time changes
      const channel = supabase.channel(`line-details-realtime-v3-${lineId}`)
        .on('postgres_changes', { event: '*', schema: 'public' }, () => {
          loadData();
        })
        .subscribe();

      return () => {
        channel.unsubscribe();
      };
    }
  }, [isOpen, lineId]);

  if (!isOpen || !line) return null;

  // Present vs Missing Calculations
  const { target, isCoverageActive, activeShiftName: currentShiftName } = getActiveStaffingTarget(line.id);

  // Group successful scans to find active checked-in workers
  const successfulScans = escaneos.filter(s => s.was_successful);
  
  const lastEventMap: Record<string, any> = {};
  successfulScans
    .sort((a, b) => new Date(a.event_time).getTime() - new Date(b.event_time).getTime())
    .forEach(scan => {
      lastEventMap[scan.badge_id] = scan;
    });

  const presentScans = Object.values(lastEventMap).filter(
    (scan: any) => scan.event_type === 'shift_start' || scan.event_type === 'lunch_return'
  );

  const presentCount = presentScans.length;
  const coveragePct = target > 0 ? Math.round((presentCount / target) * 100) : 0;

  // Present operators list
  const presentBadges = presentScans.map((s: any) => s.badge_id);
  
  const presentEmployeesList = assignments
    .filter(a => presentBadges.includes(a.empleado?.badge_id))
    .map(a => {
      const scan = presentScans.find((s: any) => s.badge_id === a.empleado?.badge_id);
      return {
        badge_id: a.empleado?.badge_id,
        name: a.empleado?.name,
        scan_time: scan ? new Date(scan.event_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--',
        status: isCoverageActive ? 'Alivio Comedor' : 'Trabajando'
      };
    });

  // Missing operators list (assigned but not checked-in)
  const missingEmployeesList = assignments
    .filter(a => a.empleado && !presentBadges.includes(a.empleado.badge_id))
    .map(a => ({
      badge_id: a.empleado?.badge_id,
      name: a.empleado?.name
    }));

  // Active Downtime Ticker
  const activeDt = tiemposMuertos.find(tm => !tm.resolved);
  const activeDowntimeMinutes = activeDt
    ? Math.max(1, Math.floor((new Date().getTime() - new Date(activeDt.start_time).getTime()) / 60000))
    : 0;

  // Donut SVG parameters
  const radius = 48;
  const strokeWidth = 10;
  const circumference = 2 * Math.PI * radius;
  const presentStroke = circumference * (Math.min(100, coveragePct) / 100);
  const missingStroke = circumference - presentStroke;

  // Audio beep player
  const playBeep = (type: 'success' | 'error') => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      if (type === 'success') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(950, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.12);
      } else {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.4);
      }
    } catch (e) {
      console.warn(e);
    }
  };

  // Scanner form submit
  const handleScanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scanInput.trim()) return;

    const badge = scanInput.trim();
    
    const { data: scanResult, error } = await supabase.from('escaneos').insert({
      badge_id: badge,
      line_id: lineId,
      event_type: 'shift_start'
    });

    if (error) {
      playBeep('error');
      setScanFeedback({ status: 'error', message: error.message || 'Error al validar escaneo' });
    } else if (scanResult && !scanResult.was_successful) {
      playBeep('error');
      setScanFeedback({ status: 'error', message: `⚠ ${scanResult.error_message}` });
    } else {
      playBeep('success');
      setScanFeedback({ status: 'success', message: `✅ Registro exitoso: ${scanResult?.employee_name || ''}` });
    }

    setScanInput('');
    loadData();

    setTimeout(() => {
      scanInputRef.current?.focus();
    }, 150);

    setTimeout(() => {
      setScanFeedback({ status: null, message: '' });
    }, 4000);
  };

  // Last 20 scans for the Modal view
  const scanHistory = [...escaneos]
    .sort((a, b) => new Date(b.event_time).getTime() - new Date(a.event_time).getTime());

  // Shift start hour details
  const currentShiftStartStr = currentShiftName === 'Primero' ? line.shift1_start 
                              : currentShiftName === 'Segundo' ? line.shift2_start 
                              : line.shift3_start;

  const currentShiftStartFormatted = (() => {
    try {
      const [h, m] = currentShiftStartStr.split(':');
      const hr = Number(h);
      const ampm = hr >= 12 ? 'PM' : 'AM';
      const formattedHr = hr % 12 || 12;
      return `${formattedHr.toString().padStart(2, '0')}:${m} ${ampm}`;
    } catch {
      return '--:--';
    }
  })();

  // Shift compliance status details
  const getComplianceDetails = () => {
    if (presentCount < target || target === 0) return null;

    const earliestScanMap: Record<string, any> = {};
    successfulScans
      .sort((a, b) => new Date(a.event_time).getTime() - new Date(b.event_time).getTime())
      .forEach(scan => {
        if (!earliestScanMap[scan.badge_id]) {
          earliestScanMap[scan.badge_id] = scan;
        }
      });
      
    const uniqueScans = Object.values(earliestScanMap).sort(
      (a: any, b: any) => new Date(a.event_time).getTime() - new Date(b.event_time).getTime()
    );

    const targetScan = uniqueScans[target - 1];
    if (!targetScan) return null;

    const completionTime = new Date(targetScan.event_time);
    const shiftStart = new Date(completionTime);
    const [h, m, s] = currentShiftStartStr.split(':').map(Number);
    shiftStart.setHours(h, m, s || 0, 0);
    
    if (shiftStart.getTime() > completionTime.getTime()) {
      shiftStart.setDate(shiftStart.getDate() - 1);
    }
    
    const diffMs = completionTime.getTime() - shiftStart.getTime();
    const diffMins = Math.max(1, Math.round(diffMs / 60000));
    
    return {
      complianceTime: completionTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      elapsedMinutes: diffMins
    };
  };

  const compliance = getComplianceDetails();

  // Status color codes
  let donutColor = '#EF4444';
  let badgeColor = 'text-[#EF4444] bg-red-500/10 border-red-500/20';
  let statusText = '🔴 FALTA PERSONAL';

  if (isCoverageActive) {
    donutColor = '#3B82F6';
    badgeColor = 'text-[#3B82F6] bg-blue-500/10 border-blue-500/20';
    statusText = '🔵 COMEDOR ACTIVO';
  } else if (coveragePct >= 100) {
    donutColor = '#22C55E';
    badgeColor = 'text-[#22C55E] bg-emerald-500/10 border-emerald-500/20';
    statusText = '🟢 PLANTILLA COMPLETA';
  } else if (coveragePct >= 80) {
    donutColor = '#F59E0B';
    badgeColor = 'text-[#F59E0B] bg-amber-500/10 border-amber-500/20';
    statusText = '🟡 COMPLETANDO PLANTILLA';
  }

  // Trend Chart mock data generation
  const trendData = [
    { name: '06:00', Cobertura: Math.min(100, Math.round(coveragePct * 0.4)) },
    { name: '07:00', Cobertura: Math.min(100, Math.round(coveragePct * 0.6)) },
    { name: '08:00', Cobertura: Math.min(100, Math.round(coveragePct * 0.75)) },
    { name: '09:00', Cobertura: Math.min(100, Math.round(coveragePct * 0.85)) },
    { name: '10:00', Cobertura: Math.min(100, Math.round(coveragePct * 0.95)) },
    { name: '11:00', Cobertura: coveragePct },
    { name: '12:00', Cobertura: coveragePct }
  ];

  // Theme variable map based on isTvView
  const theme = isTvView ? {
    modalBg: 'bg-[#050B18] border-slate-800 text-slate-100',
    headerBg: 'bg-[#0B132B]/85 border-slate-850',
    cardBg: 'bg-[#0B132B]/45 border-slate-850',
    cardBgSolid: 'bg-[#0B132B] border-slate-850',
    inputBg: 'bg-black border-slate-800 focus:border-emerald-500 text-slate-100',
    textMain: 'text-slate-100',
    textMuted: 'text-slate-400',
    textSub: 'text-slate-500',
    clockColor: 'text-amber-400',
    clockBg: 'bg-[#0B132B]/60 border border-slate-850',
    itemBg: 'bg-slate-900/35 border border-slate-900/40 text-slate-200',
    badgeClass: 'bg-slate-900 border border-slate-800 text-slate-400',
    borderDivider: 'border-slate-850',
    borderRow: 'border-slate-900/60'
  } : {
    modalBg: 'bg-white border-slate-200 text-slate-800',
    headerBg: 'bg-slate-50 border-b border-slate-200',
    cardBg: 'bg-slate-50/50 border-slate-200',
    cardBgSolid: 'bg-slate-50 border-slate-200',
    inputBg: 'bg-white border border-slate-300 focus:border-emerald-600 text-slate-800',
    textMain: 'text-slate-800',
    textMuted: 'text-slate-500',
    textSub: 'text-slate-400',
    clockColor: 'text-slate-800',
    clockBg: 'bg-slate-100 border border-slate-200',
    itemBg: 'bg-white border border-slate-200 text-slate-700',
    badgeClass: 'bg-slate-200 border border-slate-300 text-slate-700',
    borderDivider: 'border-slate-200',
    borderRow: 'border-slate-200'
  };

  const renderDashboardBody = () => (
    <>
      {/* Header Toolbar */}
      <div className={`${theme.headerBg} px-6 py-3.5 flex justify-between items-center shrink-0`}>
        <div>
          <h2 className={`text-base font-black tracking-wide flex items-center gap-2 leading-none ${theme.textMain}`}>
            <Eye className="w-4 h-4 text-emerald-500" />
            Detalle de Línea: {line.name}
          </h2>
          <span className="text-[10px] text-slate-400 font-semibold uppercase block mt-1">
            {line.area?.name || 'Área'} • {line.process || 'Manufactura'}
          </span>
        </div>

        <div className="flex items-center space-x-3">
          {activeDowntimeMinutes > 0 && (
            <div className="flex items-center space-x-1.5 bg-red-950/60 border border-red-500/20 px-2.5 py-1 rounded-lg text-red-400 text-[10px] font-mono font-bold animate-pulse">
              <Clock className="w-3.5 h-3.5 text-red-500 animate-spin" />
              <span>TM: {activeDowntimeMinutes} min</span>
            </div>
          )}

          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border tracking-wider ${badgeColor}`}>
            {statusText}
          </span>

          {/* Fullscreen control */}
          <button
            onClick={toggleFullscreen}
            className="p-1.5 bg-slate-900/10 border border-slate-300 hover:border-slate-450 dark:bg-slate-900/60 dark:border-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg transition-all cursor-pointer"
            title={isFullscreen ? 'Salir Pantalla Completa' : 'Pantalla Completa'}
          >
            {isFullscreen ? <Minimize className="w-4 h-4 text-amber-500" /> : <Maximize className="w-4 h-4 text-emerald-555" />}
          </button>

          {/* Close button */}
          <button 
            onClick={handleClose} 
            className="p-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-800 text-slate-505 dark:text-slate-400 hover:text-slate-850 dark:hover:text-slate-200 rounded-lg transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Unified 3-Column Dashboard Body */}
      <div 
        className="flex-1 grid gap-4 p-5 min-h-0 overflow-y-auto lg:overflow-hidden grid-cols-1 lg:grid-cols-[1.5fr_1fr_1.1fr]"
      >
        
        {/* COLUMN 1: Large Donut Graph + Coverage Trends (Optimized layout) */}
        <div className="flex flex-col gap-4 h-full min-h-0">
          
          {/* Giant Donut Chart Container - Made compact h-48 */}
          <div className={`p-4 border rounded-2xl flex flex-col items-center justify-center shrink-0 ${theme.cardBg} h-[180px]`}>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block mb-1">Cobertura Actual</span>
            <div className="relative w-32 h-32 flex items-center justify-center">
              <svg width="100%" height="100%" viewBox="0 0 160 160" className="-rotate-90">
                <circle cx="80" cy="80" r={radius} fill="transparent" stroke={isTvView ? '#101726' : '#E2E8F0'} strokeWidth={strokeWidth} />
                <circle 
                  cx="80" cy="80" r={radius} fill="transparent" 
                  stroke={donutColor} strokeWidth={strokeWidth}
                  strokeDasharray={circumference}
                  strokeDashoffset={missingStroke}
                  strokeLinecap="round"
                  className="transition-all duration-700 ease-in-out"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center leading-none select-none">
                <span className={`text-3xl font-black font-mono block ${theme.textMain}`}>{coveragePct}%</span>
                <span className="text-[9px] text-slate-400 font-bold font-mono mt-1 block">{presentCount} de {target}</span>
              </div>
            </div>
          </div>

          {/* Trends Section using Recharts AreaChart (Enlarged to fill remaining height) */}
          <div className={`flex-1 flex flex-col p-4 border rounded-2xl min-h-[300px] lg:min-h-0 ${theme.cardBg}`}>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block mb-2">Tendencia de Cobertura (Turno)</span>
            <div className="flex-grow min-h-0 w-full font-mono text-[9px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorCov" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={donutColor} stopOpacity={0.4}/>
                      <stop offset="95%" stopColor={donutColor} stopOpacity={0.0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={isTvView ? '#1e293b' : '#E2E8F0'} />
                  <XAxis dataKey="name" stroke={isTvView ? '#94a3b8' : '#64748B'} fontSize={8} />
                  <YAxis domain={[0, 100]} stroke={isTvView ? '#94a3b8' : '#64748B'} fontSize={8} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: isTvView ? '#0f172a' : '#FFFFFF', borderColor: isTvView ? '#1e293b' : '#E2E8F0', fontSize: 10, color: isTvView ? '#FFFFFF' : '#000000' }}
                    itemStyle={{ color: donutColor }}
                  />
                  <Area type="monotone" dataKey="Cobertura" stroke={donutColor} fillOpacity={1} fill="url(#colorCov)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>

        {/* COLUMN 2: Present Staff + Missing Staff lists */}
        <div className="flex flex-col gap-4 h-full min-h-0">
          
          {/* Present Staff List */}
          <div className={`flex-1 flex flex-col p-4 border rounded-2xl overflow-hidden min-h-[220px] lg:min-h-0 ${theme.cardBg}`}>
            <div className={`border-b pb-2 mb-2 flex justify-between items-center shrink-0 ${theme.borderDivider}`}>
              <span className={`text-[10px] uppercase font-bold tracking-widest block flex items-center gap-1.5 ${theme.textMain}`}>
                <UserCheck className="w-4 h-4 text-emerald-500" />
                Personal Presente
              </span>
              <span className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-2 py-0.5 rounded text-[10px] font-mono font-bold">
                {presentEmployeesList.length} Presentes
              </span>
            </div>

            <div className="flex-grow overflow-y-auto space-y-1.5 pr-1 min-h-0">
              {presentEmployeesList.map(emp => (
                <div key={emp.badge_id} className={`p-2 rounded-xl flex justify-between items-center text-xs transition-all ${theme.itemBg}`}>
                  <span className="font-semibold truncate max-w-[130px] flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 animate-pulse"></span>
                    {emp.name}
                  </span>
                  <span className={`font-mono text-[9px] px-1.5 py-0.5 rounded leading-none shrink-0 ${theme.badgeClass}`}>
                    {emp.scan_time}
                  </span>
                </div>
              ))}
              {presentEmployeesList.length === 0 && (
                <span className="text-xs text-slate-400 italic block text-center py-8">Ningún operador en turno</span>
              )}
            </div>
          </div>

          {/* Missing Staff List */}
          <div className={`flex-1 flex flex-col p-4 border rounded-2xl overflow-hidden min-h-[220px] lg:min-h-0 ${theme.cardBg}`}>
            <div className={`border-b pb-2 mb-2 flex justify-between items-center shrink-0 ${theme.borderDivider}`}>
              <span className={`text-[10px] uppercase font-bold tracking-widest block flex items-center gap-1.5 ${theme.textMain}`}>
                <AlertCircle className="w-4 h-4 text-red-500 animate-pulse" />
                Personal Faltante
              </span>
              <span className="bg-red-500/10 text-red-500 border border-red-500/20 px-2 py-0.5 rounded text-[10px] font-mono font-bold">
                {missingEmployeesList.length} Faltantes
              </span>
            </div>

            <div className="flex-grow overflow-y-auto space-y-1.5 pr-1 min-h-0">
              {missingEmployeesList.map(emp => (
                <div key={emp.badge_id} className={`p-2 rounded-xl flex justify-between items-center text-xs transition-all ${theme.itemBg}`}>
                  <span className="font-semibold truncate max-w-[150px] flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0"></span>
                    {emp.name}
                  </span>
                  <span className={`font-mono text-[9px] px-1.5 py-0.5 rounded leading-none shrink-0 ${theme.badgeClass}`}>
                    ID: {emp.badge_id}
                  </span>
                </div>
              ))}
              {missingEmployeesList.length === 0 && (
                <span className="text-xs text-emerald-600 font-bold block text-center py-8">¡Plantilla completa!</span>
              )}
            </div>
          </div>

        </div>

        {/* COLUMN 3: Digital Clock + Badge Scanner + Actions Panel */}
        <div className="flex flex-col gap-4 h-full min-h-0">
          
          {/* Reloj Digital Industrial Dominante */}
          <div className={`p-4 border rounded-2xl flex flex-col gap-4 shrink-0 ${theme.cardBgSolid} shadow-sm border-emerald-500/10`}>
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-slate-450 uppercase font-black tracking-wider">Reloj de Producción</span>
              <span className={`text-[10px] px-2.5 py-1 rounded-lg font-black font-mono bg-emerald-500/15 text-emerald-500 border border-emerald-500/25`}>
                TURNO {currentShiftName === 'Primero' ? '1' : currentShiftName === 'Segundo' ? '2' : '3'}
              </span>
            </div>
            
            {/* Giant Digital Clock */}
            <div className={`py-3.5 rounded-2xl text-center select-none font-mono ${theme.clockBg} flex flex-col justify-center shadow-inner`}>
              <span className={`text-4xl lg:text-5xl font-black tracking-widest ${theme.clockColor}`}>{currentTimeStr}</span>
              <span className="text-[10px] font-black text-slate-400 mt-1.5 uppercase tracking-widest">{ampmStr}</span>
            </div>

            {/* Compliance & Operations metadata */}
            <div className="text-[11px] font-mono space-y-2 bg-black/5 dark:bg-black/20 p-3 rounded-xl border border-black/5">
              <div className={`flex justify-between items-center pb-1.5 border-b ${theme.borderRow}`}>
                <span className="text-slate-400">Turno Activo:</span>
                <span className={`font-black uppercase text-emerald-500`}>{currentShiftName}</span>
              </div>
              <div className={`flex justify-between items-center pb-1.5 border-b ${theme.borderRow}`}>
                <span className="text-slate-450">Inicio de Turno:</span>
                <span className={`font-bold ${theme.textMain}`}>{currentShiftStartFormatted}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-450">Tiempo Transcurrido:</span>
                <span className="text-amber-500 font-black tracking-wider">{elapsedTimeStr}</span>
              </div>
            </div>

            {/* Compliance completion box */}
            {compliance && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-xl text-center">
                <span className="text-[8px] font-black text-emerald-500 block uppercase tracking-widest font-mono">Meta Alcanzada</span>
                <div className="flex justify-around mt-1 text-[9px] font-mono text-slate-400">
                  <p>Hora: <strong className={theme.textMain}>{compliance.complianceTime}</strong></p>
                  <p>T. Carga: <strong className={theme.textMain}>{compliance.elapsedMinutes} min</strong></p>
                </div>
              </div>
            )}
          </div>

          {/* Badge Scanner console box */}
          <div className={`p-4 border rounded-2xl shrink-0 ${theme.cardBgSolid}`}>
            <span className="text-[9px] font-bold text-slate-400 tracking-widest uppercase font-mono block mb-2">[ ESCANEO DE GAFETE ]</span>
            <form onSubmit={handleScanSubmit} className="flex gap-2">
              <input
                ref={scanInputRef}
                type="text"
                value={scanInput}
                onChange={(e) => setScanInput(e.target.value)}
                placeholder="Escanee gafete..."
                className={`flex-1 text-center font-bold font-mono tracking-widest rounded-xl text-xs py-2 focus:outline-none ${theme.inputBg}`}
              />
              <button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs px-4 rounded-xl cursor-pointer transition-colors">
                OK
              </button>
            </form>
            
            {scanFeedback.status && (
              <div className={`mt-2 p-1.5 rounded-xl border text-[9px] font-mono font-bold text-center ${
                scanFeedback.status === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-555' : 'bg-red-500/10 border-red-500/20 text-red-500'
              }`}>
                {scanFeedback.message}
              </div>
            )}
          </div>

          {/* Actions & History trigger (Replaces permanent scan list) */}
          <div className={`p-4 border rounded-2xl flex flex-col gap-2 shrink-0 ${theme.cardBgSolid}`}>
            <button
              onClick={() => setIsHistoryOpen(true)}
              className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-805 border border-slate-800 text-slate-200 hover:text-white py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
            >
              <History className="w-4 h-4 text-emerald-400 animate-pulse" />
              <span>Ver Historial de Escaneos</span>
            </button>

            <div className="flex justify-between items-center text-[10px] font-mono text-slate-400 px-1 mt-1">
              <span>Tiempo Muerto Activo:</span>
              <span className={`font-bold ${activeDowntimeMinutes > 0 ? 'text-red-500 animate-pulse font-black' : 'text-slate-400'}`}>
                {activeDowntimeMinutes} min
              </span>
            </div>
          </div>

        </div>

      </div>

      {/* Footer */}
      <div className={`px-6 py-2.5 border-t text-center text-[9px] text-slate-500 font-mono shrink-0 ${theme.borderDivider}`}>
        Consola Operativa LinePulse • Monitoreo de Planta Industrial en tiempo real.
      </div>

      {/* SECONDARY MODAL: Scan History List Popup */}
      {isHistoryOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
          <div className={`${isTvView ? 'bg-[#0B132B] border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-800'} border rounded-3xl p-5 max-w-lg w-full flex flex-col max-h-[70vh] shadow-2xl`}>
            
            <div className="flex justify-between items-center border-b border-slate-900/10 dark:border-slate-800 pb-2 mb-3 shrink-0">
              <h3 className="text-sm font-black uppercase tracking-wider flex items-center gap-1.5">
                <History className="w-4 h-4 text-emerald-450" />
                Historial de Escaneos ({currentShiftName})
              </h3>
              <button 
                onClick={() => setIsHistoryOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-800/10 dark:hover:bg-slate-800 transition-colors text-slate-455 hover:text-slate-700 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 text-xs font-mono min-h-0">
              {scanHistory.map(scan => (
                <div 
                  key={scan.id} 
                  className={`p-2.5 rounded-xl flex justify-between items-center ${
                    isTvView ? 'bg-slate-900/35 border-slate-900 text-slate-205' : 'bg-slate-50 border-slate-150 text-slate-700'
                  } border`}
                >
                  <div className="min-w-0 pr-1">
                    <span className="font-extrabold block truncate leading-none mb-1 text-slate-850 dark:text-slate-200">{scan.employee_name}</span>
                    <span className="text-[9px] text-slate-500 block leading-none">ID: {scan.badge_id}</span>
                  </div>
                  <div className="text-right shrink-0">
                    <span className={`px-1.5 py-0.5 rounded font-black text-[8px] leading-none block ${
                      scan.was_successful ? 'bg-emerald-500/10 text-emerald-555' : 'bg-red-500/10 text-red-500'
                    }`}>
                      {scan.was_successful ? 'ÉXITO' : 'RECHAZO'}
                    </span>
                    <span className="text-slate-500 text-[8px] block mt-1 leading-none">
                      {new Date(scan.event_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>
                </div>
              ))}
              {scanHistory.length === 0 && (
                <span className="text-xs text-slate-500 italic block text-center py-8">Sin registros de escaneo en este turno</span>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );

  return isModal ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 transition-all duration-300">
      <div className={`${theme.modalBg} border rounded-3xl w-[95vw] h-[90vh] max-w-6xl flex flex-col justify-between shadow-2xl overflow-hidden relative`}>
        {renderDashboardBody()}
      </div>
    </div>
  ) : (
    <div className="w-screen h-screen flex flex-col justify-between overflow-hidden relative">
      <div className={`${theme.modalBg} border-none rounded-none w-full h-full flex flex-col justify-between overflow-hidden relative`}>
        {renderDashboardBody()}
      </div>
    </div>
  );
};
