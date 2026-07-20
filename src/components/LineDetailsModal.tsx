import React, { useEffect, useState, useRef } from 'react';
import { supabase, getActiveStaffingTarget, DEFAULT_SMT_LAYOUT, validateAndMapScanInsert, mapScanFromSupabase, calculateLineMetrics } from '../lib/supabaseClient';
import { Clock, QrCode, Maximize, Minimize, Utensils, CheckCircle2, AlertTriangle, ArrowLeft } from 'lucide-react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';

interface LineDetailsModalProps {
  lineId?: string;
  isOpen?: boolean;
  onClose?: () => void;
  isTvView?: boolean;
}

// Light theme SVG Circular Gauge component for bottom status indicator
const LargeCircularGauge: React.FC<{ percentage: number; color: string; present: number; target: number }> = ({
  percentage,
  color,
  present,
  target
}) => {
  const size = 100;
  const radius = (size - 14) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (Math.min(100, Math.max(0, percentage)) / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center shrink-0">
      <svg className="transform -rotate-90" width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#E2E8F0"
          strokeWidth="9"
          fill="transparent"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth="9"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="transparent"
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center text-center">
        <span className="text-2xl font-black font-mono leading-none" style={{ color }}>
          {percentage}%
        </span>
        <span className="text-xs font-mono font-bold text-slate-[#64748B] mt-1">
          {present}/{target}
        </span>
      </div>
    </div>
  );
};

export const LineDetailsModal: React.FC<LineDetailsModalProps> = ({ 
  lineId: propLineId, 
  isOpen: propIsOpen, 
  onClose: propOnClose, 
  isTvView: propIsTvView 
}) => {
  const { lineId: routeLineId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const lineId = routeLineId || propLineId || '';
  const isTvView = searchParams.get('tv') === 'true' || propIsTvView || false;
  const isOpen = propIsOpen !== undefined ? propIsOpen : !!lineId;

  const [line, setLine] = useState<any>(null);
  const [escaneos, setEscaneos] = useState<any[]>([]);
  const [posiciones, setPosiciones] = useState<any[]>([]);
  const [tiemposMuertos, setTiemposMuertos] = useState<any[]>([]);

  // Escaneos Ref to prevent stale closures in event listeners
  const escaneosRef = useRef<any[]>([]);
  useEffect(() => {
    escaneosRef.current = escaneos;
  }, [escaneos]);

  // Inline scanner states & USB Direct Capture
  const [manualScanInput, setManualScanInput] = useState('');
  const [scanFeedback, setScanFeedback] = useState<{ status: 'success' | 'error' | null; message: string }>({
    status: null,
    message: ''
  });

  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Digital Industrial Clock states
  const [currentTimeStr, setCurrentTimeStr] = useState('00:00:00');
  const [currentDateStr, setCurrentDateStr] = useState('');

  const usbInputRef = useRef<HTMLInputElement>(null);

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
        console.error('Fullscreen error:', err);
      });
    } else {
      document.exitFullscreen().catch(err => {
        console.error('Exit fullscreen error:', err);
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

    try {
      // Load line info
      const { data: lineData } = await supabase.from('lineas').select('*, area:areas(*)').eq('id', lineId);
      if (lineData && lineData.length > 0) setLine(lineData[0]);

      // Load ALL scans mapped consistently (Fresh from Supabase)
      const { data: escData } = await supabase.from('escaneos').select('*').eq('line_id', lineId).order('created_at', { ascending: true });
      const freshMappedScans = (escData || []).map(mapScanFromSupabase);
      setEscaneos(freshMappedScans);
      escaneosRef.current = freshMappedScans;

      // Load positions mapping (try 'posiciones' then fallback to 'line_positions')
      let posRes = await supabase.from('posiciones').select('*, empleado:empleados(*)').eq('line_id', lineId).order('code', { ascending: true });
      if (!posRes.data || posRes.data.length === 0) {
        posRes = await supabase.from('line_positions').select('*, empleado:empleados(*)').eq('line_id', lineId).order('code', { ascending: true });
      }
      setPosiciones(posRes.data || []);

      // Load downtime logs
      const { data: tmData } = await supabase.from('tiempos_muertos').select('*').eq('line_id', lineId);
      setTiemposMuertos(tmData || []);
    } catch (err) {
      console.warn('Handling empty line details in LineDetailsModal:', err);
    }
  };

  // Industrial Clock Ticker
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setCurrentTimeStr(now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }));
      
      const dateOptions: Intl.DateTimeFormatOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
      const formattedDate = now.toLocaleDateString('es-MX', dateOptions);
      setCurrentDateStr(formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1));
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  // Supabase Realtime Subscription for Scans & Line Changes
  useEffect(() => {
    if (isOpen && lineId) {
      loadData();

      const channel = supabase.channel(`line-detail-realtime-${lineId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'escaneos' }, () => {
          loadData();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'lineas' }, () => {
          loadData();
        })
        .subscribe();

      return () => {
        channel.unsubscribe();
      };
    }
  }, [isOpen, lineId]);

  // Execute Direct USB Scan Processing with Strict Rules (Reglas 1 - 5) & escaneosRef
  const processDirectScan = async (empNum: string) => {
    setManualScanInput('');
    if (!lineId) return;

    // REGLAS 2 & 3: Strip whitespace & ignore empty
    const cleanNum = (empNum || '').trim();
    if (!cleanNum) return;

    // REGLA 1: Numeric Characters ONLY
    if (!/^\d+$/.test(cleanNum)) {
      setScanFeedback({
        status: 'error',
        message: 'Escaneo inválido. Solo se permiten números de empleado.'
      });
      setTimeout(() => setScanFeedback({ status: null, message: '' }), 3500);
      return;
    }

    const configuredPositionsCount = posiciones.length;
    const { target: shiftTarget, isCoverageActive } = getActiveStaffingTarget(lineId);
    const target = isCoverageActive 
      ? shiftTarget 
      : (configuredPositionsCount > 0 ? configuredPositionsCount : (shiftTarget > 0 ? shiftTarget : 6));

    // Current scanned list of distinct numbers for this line from FRESH REF (Single Source of Truth)
    const activeScans = escaneosRef.current;
    const currentScannedList = Array.from(
      new Set(
        activeScans
          .filter(s => s.line_id === lineId && s.was_successful !== false)
          .map(s => (s.employee_number || s.badge_id || '').trim())
          .filter(Boolean)
      )
    );

    console.log('[DEBUG MONITOR KPIS PRE-INSERT]:', {
      lineId,
      configuredPositionsCount,
      target,
      scannedCount: currentScannedList.length,
      currentScannedList,
      attemptedNumber: cleanNum
    });

    // REGLA 4: No Duplicates in Same Shift
    if (currentScannedList.includes(cleanNum)) {
      setScanFeedback({
        status: 'error',
        message: 'Empleado ya registrado en este turno.'
      });
      setTimeout(() => setScanFeedback({ status: null, message: '' }), 3500);
      return;
    }

    // REGLA 5: Do NOT exceed target capacity (ONLY block if scannedCount >= target)
    if (currentScannedList.length >= target) {
      setScanFeedback({
        status: 'error',
        message: 'Plantilla completa. No se requieren más registros.'
      });
      setTimeout(() => setScanFeedback({ status: null, message: '' }), 3500);
      return;
    }

    const eventType = isCoverageActive ? 'MEAL_COVERAGE' : 'TURN_START';

    // 1. Pre-validation and strict payload mapping (avoids hardcoded unrecognized columns)
    const validation = validateAndMapScanInsert({
      line_id: lineId,
      employee_number: cleanNum,
      event_type: eventType,
      was_successful: true
    });

    if (!validation.isValid || !validation.mappedRecord) {
      console.error('[SCAN INSERT ABORTADO POR VALIDACIÓN]:', validation.error);
      setScanFeedback({
        status: 'error',
        message: `❌ Error: ${validation.error}`
      });
      return;
    }

    const { mappedRecord } = validation;
    console.log('[SUPABASE INSERT ESCANEO Payload]:', mappedRecord);

    const newScanRecord = {
      id: `temp-${Date.now()}`,
      line_id: lineId,
      employee_number: cleanNum,
      badge_id: cleanNum,
      scan_time: mappedRecord.event_time,
      event_time: mappedRecord.event_time,
      event_type: eventType,
      was_successful: true
    };

    // 2. Immediately update local state so UI turns GREEN instantly!
    const updatedScansList = [...activeScans, newScanRecord];
    setEscaneos(updatedScansList);
    escaneosRef.current = updatedScansList;

    setScanFeedback({
      status: 'success',
      message: `✅ Escaneo registrado: Empleado #${cleanNum}`
    });

    // 3. Persist mapped record to Supabase
    try {
      const { error: insertError } = await supabase.from('escaneos').insert(mappedRecord);

      if (insertError) {
        console.error('[SUPABASE INSERT ERROR DETALLADO]:', insertError);
        setScanFeedback({
          status: 'error',
          message: `❌ Error Supabase: ${insertError.message || insertError.details || 'Error de inserción'}`
        });
      } else {
        console.log('[SUPABASE INSERT EXITOSO]: Escaneo registrado correctamente en base de datos');

        // Calculate new status:
        // 0% -> FALTA PERSONAL
        // 1% - 99% -> INTEGRANDO PERSONAL
        // 100% -> PLANTILLA COMPLETA
        const updatedCount = currentScannedList.length + 1;
        const newPct = target > 0 ? Math.round((updatedCount / target) * 100) : 0;

        let newStatus = 'FALTA PERSONAL';
        if (isCoverageActive) {
          newStatus = 'COBERTURA DE COMEDOR';
        } else if (newPct >= 100) {
          newStatus = 'PLANTILLA COMPLETA';
        } else if (newPct > 0) {
          newStatus = 'INTEGRANDO PERSONAL';
        }

        await supabase.from('lineas').update({ status: newStatus }).eq('id', lineId);
      }
    } catch (err: any) {
      console.error('[SUPABASE CATCH ERROR]:', err);
    }

    loadData();

    setTimeout(() => {
      setScanFeedback({ status: null, message: '' });
    }, 3500);
  };

  // Global USB Barcode Reader Keyboard Listener (Emulates USB Keyboard Input ending with Enter)
  useEffect(() => {
    if (!isOpen) return;

    let buffer = '';
    let timer: any = null;

    const handleKeyDown = (e: KeyboardEvent) => {
      const targetTag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (targetTag === 'textarea') return;

      if (e.key === 'Enter') {
        if (buffer.trim()) {
          processDirectScan(buffer.trim());
          buffer = '';
        }
      } else if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        buffer += e.key;
        clearTimeout(timer);
        timer = setTimeout(() => {
          buffer = '';
        }, 600);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearTimeout(timer);
    };
  }, [isOpen, lineId, escaneos]);

  // Keep USB Input Focused Automatically
  useEffect(() => {
    if (isOpen && usbInputRef.current) {
      usbInputRef.current.focus();
    }
  }, [isOpen]);

  if (!isOpen || !line) return null;

  // Active Staffing Target & Coverage Calculations driven by UNIFIED calculateLineMetrics
  const metrics = calculateLineMetrics(line.id, posiciones, escaneos, []);
  const { 
    target, 
    scannedCount, 
    coveragePct, 
    missingCount, 
    statusColor, 
    statusBadgeText, 
    activeShiftName,
    isCoverageActive
  } = metrics;

  const distinctScannedEmployees = Array.from(
    new Set(
      escaneos
        .map(s => (s.employee_number || s.badge_id || '').trim())
        .filter(Boolean)
    )
  );

  let shiftColorEmoji = '🟢';
  if (activeShiftName === 'Turno 2') {
    shiftColorEmoji = '🟡';
  } else if (activeShiftName === 'Turno 3') {
    shiftColorEmoji = '🔵';
  }

  console.log('[DEBUG MONITOR KPIS]:', {
    lineId: line.id,
    posicionesRequeridas: target,
    escaneosActivos: scannedCount,
    coberturaCalculada: `${coveragePct}%`,
    estadoCalculado: statusBadgeText,
    activeShiftName,
    distinctScannedEmployees
  });

  // Active Downtime calculation
  const activeDt = tiemposMuertos.find(tm => !tm.resolved);
  const activeDowntimeMinutes = activeDt
    ? Math.max(1, Math.floor((new Date().getTime() - new Date(activeDt.start_time).getTime()) / 60000))
    : 0;

  // Layout Image (Default SMT Blueprint if none uploaded)
  const layoutImageSrc = line.layout_url || DEFAULT_SMT_LAYOUT;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#F5F7FA] text-slate-800 overflow-hidden font-sans select-none">
      
      {/* 1. INDUSTRIAL MES / ANDON DOMINANT HEADER (#005486) */}
      <header className="h-28 shrink-0 bg-[#005486] border-b-2 border-[#003c61] px-6 lg:px-8 flex items-center justify-between z-20 shadow-lg text-white gap-4 flex-wrap lg:flex-nowrap">
        
        {/* Left: Back Button & Line Info */}
        <div className="flex items-center space-x-4 shrink-0">
          <button 
            onClick={handleClose}
            className="p-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer border border-white/20 shadow-sm"
            title="Volver al Dashboard"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>

          <div>
            <div className="flex items-center gap-3">
              <span className="w-3.5 h-3.5 rounded-full animate-pulse shadow-md" style={{ backgroundColor: statusColor }} />
              <h1 className="text-2xl font-black tracking-wider uppercase text-white font-mono">{line.name}</h1>
              <span className="text-xs px-3 py-1 rounded-lg bg-white/15 border border-white/20 text-white font-mono font-black uppercase">
                {line.area?.name || 'SMT'}
              </span>
            </div>
            <span className="text-xs text-white/80 font-bold block mt-1">
              {line.process || 'Línea de Ensamble y Producción'}
            </span>
          </div>
        </div>

        {/* Center: Dominant Clock (48px) & Active Shift Badge */}
        <div className="flex items-center gap-6 bg-black/25 border border-white/15 px-6 py-2 rounded-2xl shadow-inner text-white">
          
          {/* Active Shift & Target Template */}
          <div className="flex flex-col justify-center">
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-300 block font-mono">
              TURNO ACTIVO
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-xl font-black font-mono text-white uppercase flex items-center gap-1.5">
                <span>{shiftColorEmoji}</span>
                <span>{activeShiftName}</span>
              </span>
            </div>
            <span className="text-xs font-bold text-white/90 font-mono mt-0.5">
              Plantilla: <strong className="text-emerald-300 font-mono font-black">{target} op</strong>
            </span>
          </div>

          <div className="h-10 w-px bg-white/20" />

          {/* Dominant Clock (48px) */}
          <div className="flex flex-col items-center justify-center">
            <div className="flex items-center gap-2">
              <Clock className="w-6 h-6 text-emerald-400 animate-pulse" />
              <span className="text-3xl lg:text-4xl xl:text-5xl font-black font-mono tracking-widest text-white leading-none">
                {currentTimeStr}
              </span>
            </div>
            <span className="text-[11px] font-bold text-white/70 block mt-1 tracking-wide">
              {currentDateStr}
            </span>
          </div>

        </div>

        {/* Right: Live MES / Andon Executive KPIs (Escaneados, Cobertura, Faltantes, Estado) */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-4 bg-white/10 border border-white/20 px-4 py-2 rounded-2xl shadow-sm font-mono">
            
            {/* Escaneados / Target */}
            <div className="text-center">
              <span className="text-[9px] font-black uppercase tracking-wider text-white/70 block">Escaneados</span>
              <span className="text-lg font-black text-white">
                {scannedCount} / {target}
              </span>
            </div>

            <div className="h-7 w-px bg-white/20" />

            {/* Cobertura % */}
            <div className="text-center">
              <span className="text-[9px] font-black uppercase tracking-wider text-white/70 block">Cobertura</span>
              <span className="text-lg font-black" style={{ color: statusColor }}>
                {coveragePct}%
              </span>
            </div>

            <div className="h-7 w-px bg-white/20" />

            {/* Faltantes */}
            <div className="text-center">
              <span className="text-[9px] font-black uppercase tracking-wider text-white/70 block">Faltantes</span>
              <span className="text-lg font-black text-red-300">
                {missingCount}
              </span>
            </div>

          </div>

          {/* Status Badge & Fullscreen */}
          <div className="flex items-center gap-2">
            {isCoverageActive && (
              <div className="hidden xl:flex items-center gap-1 bg-blue-500/20 border border-blue-200/40 text-white px-2.5 py-1 rounded-xl text-[10px] font-bold animate-pulse">
                <Utensils className="w-3.5 h-3.5 text-white" />
                <span>Comedor</span>
              </div>
            )}

            <span 
              className="px-3 py-2 rounded-xl text-xs font-black uppercase font-mono tracking-wider shadow-sm border text-center max-w-[160px]"
              style={{ backgroundColor: `${statusColor}25`, color: '#FFFFFF', borderColor: `${statusColor}60` }}
            >
              {statusBadgeText}
            </span>

            <button
              onClick={toggleFullscreen}
              className="p-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer border border-white/20"
              title="Pantalla Completa"
            >
              {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* 2. MAIN LAYOUT CANVAS (Maximized Blueprint + Clean Dot Indicators ONLY) */}
      <main className="flex-grow min-h-0 relative p-4 bg-[#F5F7FA] flex flex-col justify-center items-center overflow-hidden">
        
        {/* Visual Blueprint Container */}
        <div className="relative w-full h-full max-w-[1450px] max-h-[750px] bg-white border border-[#DCE3EA] rounded-2xl shadow-sm flex items-center justify-center overflow-hidden p-3">
          
          {/* Blueprint Background Image */}
          <img 
            src={layoutImageSrc} 
            alt={`Layout ${line.name}`} 
            className="w-full h-full object-contain rounded-xl opacity-95 select-none pointer-events-none"
          />

          {/* Minimalist Operator Pins (CIRCULAR ICONS ONLY - SEQUENTIAL OCCUPATION BY SCANS) */}
          {posiciones.map((pos, idx) => {
            const isOccupied = idx < scannedCount;
            const isWithinTarget = idx < target;

            // COLOR RULES:
            // 🟢 VERDE (#22C55E): Posición cubierta por escaneo
            // 🔴 ROJO (#EF4444): Posición vacante / pendiente de escaneo
            // 🔵 AZUL (#3B82F6): Cobertura de comedor activa
            // ⚪ GRIS (#94A3B8): Sin estado (fuera de plantilla)
            let markerColor = '#94A3B8'; // GREY (Sin estado)
            let statusLabel = 'Sin Estado';

            if (isOccupied) {
              if (isCoverageActive) {
                markerColor = '#3B82F6'; // BLUE
                statusLabel = 'Cobertura Activa';
              } else {
                markerColor = '#22C55E'; // GREEN
                statusLabel = 'Cubierta';
              }
            } else if (isWithinTarget) {
              markerColor = '#EF4444'; // RED
              statusLabel = 'Vacante / Pendiente Escaneo';
            }

            return (
              <div 
                key={pos.id || pos.code || idx}
                style={{
                  left: `${pos.x_percent}%`,
                  top: `${pos.y_percent}%`,
                  transform: 'translate(-50%, -50%)'
                }}
                className="absolute z-10 transition-all duration-300 group cursor-pointer"
              >
                {/* 🟢🔴🔵⚪ Minimalist Circular Operator Pin (Dot Only) */}
                <div className="relative flex items-center justify-center">
                  {/* Outer pulse ring */}
                  <span 
                    className={`absolute w-8 h-8 rounded-full opacity-40 ${isOccupied ? 'animate-ping' : ''}`}
                    style={{ backgroundColor: markerColor }}
                  />
                  {/* Outer solid border ring */}
                  <span 
                    className="absolute w-7 h-7 rounded-full border-2 bg-white/80 shadow-md"
                    style={{ borderColor: markerColor }}
                  />
                  {/* Inner Status Circle Dot */}
                  <span 
                    className="relative w-5 h-5 rounded-full shadow-inner transform transition-transform group-hover:scale-125"
                    style={{ 
                      backgroundColor: markerColor,
                      boxShadow: `0 0 10px ${markerColor}90`
                    }}
                  />
                </div>

                {/* Floating Tooltip ON HOVER ONLY (Shows Position Code and Operational Status) */}
                <div className="opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2.5 bg-slate-900 text-white p-2.5 rounded-xl z-30 min-w-[150px] shadow-xl border border-slate-800 text-center scale-95 group-hover:scale-100">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-1 mb-1">
                    <span className="text-xs font-black font-mono text-emerald-400 uppercase tracking-wider">
                      ● {pos.code || `POS${String(idx + 1).padStart(2, '0')}`}
                    </span>
                    <span 
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: markerColor }}
                    />
                  </div>

                  <span className="text-[11px] font-bold text-slate-300 block truncate">
                    {pos.station_name || pos.code || `Estación POS${idx + 1}`}
                  </span>

                  <span 
                    className="text-[10px] font-extrabold uppercase tracking-wider block mt-1 pt-1 border-t border-slate-800/60"
                    style={{ color: markerColor }}
                  >
                    {statusLabel}
                  </span>

                  {/* Tooltip triangle tail */}
                  <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-900" />
                </div>
              </div>
            );
          })}

          {/* Toast Notification Banner for USB Scans */}
          {scanFeedback.message && (
            <div className={`absolute top-4 left-1/2 -translate-x-1/2 z-40 px-5 py-2.5 rounded-2xl shadow-2xl border font-mono text-xs font-extrabold flex items-center gap-2 animate-in fade-in zoom-in duration-200 ${
              scanFeedback.status === 'error' ? 'bg-red-900 text-white border-red-700' : 'bg-slate-900 text-white border-slate-700'
            }`}>
              {scanFeedback.status === 'error' ? <AlertTriangle className="w-4 h-4 text-red-400" /> : <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
              <span>{scanFeedback.message}</span>
            </div>
          )}

        </div>
      </main>

      {/* 3. MINIMALIST LIGHT INDICATORS BAR (Bottom Bar with USB Scan Capture Input) */}
      <footer className="h-28 shrink-0 bg-white border-t border-[#DCE3EA] px-8 py-3 flex items-center justify-between z-20 shadow-sm gap-4">
        
        {/* Left: Large Circular Gauge & Coverage KPI */}
        <div className="flex items-center space-x-6">
          <LargeCircularGauge percentage={coveragePct} color={statusColor} present={scannedCount} target={target} />

          <div className="flex flex-col justify-center">
            <span className="text-2xl font-black uppercase text-slate-900 font-mono tracking-wider">
              {line.name}
            </span>
            <div className="flex items-center gap-2 mt-1">
              <span 
                className="px-2.5 py-0.5 rounded-md text-xs font-extrabold font-mono uppercase"
                style={{ backgroundColor: `${statusColor}15`, color: statusColor, border: `1px solid ${statusColor}40` }}
              >
                {statusBadgeText}
              </span>
              <span className="px-2 py-0.5 rounded-md text-xs font-mono font-extrabold bg-red-50 text-red-700 border border-red-200">
                Faltantes: {missingCount}
              </span>
            </div>
          </div>
        </div>

        {/* Center: Permanent Hands-Free USB Barcode Reader Status Indicator */}
        <div 
          onClick={() => usbInputRef.current?.focus()}
          className="flex-1 max-w-xl bg-emerald-50 border-2 border-emerald-500 rounded-2xl p-2.5 flex items-center justify-between shadow-sm cursor-pointer group"
          title="Haga clic para asegurar el foco del escáner USB"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-600 text-white rounded-xl shadow">
              <QrCode className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                <span className="text-xs font-black text-emerald-900 uppercase tracking-wider font-mono">
                  🟢 ESCÁNER USB ACTIVO
                </span>
              </div>
              <span className="text-[11px] font-bold text-emerald-700 block mt-0.5">
                Listo para recibir lectura de gafetes...
              </span>
            </div>
          </div>

          <form 
            onSubmit={(e) => {
              e.preventDefault();
              if (manualScanInput.trim()) {
                processDirectScan(manualScanInput);
              }
            }}
            className="flex items-center gap-2"
          >
            <input
              ref={usbInputRef}
              type="text"
              placeholder="Escaneo auto (Ej. 1163146 + Enter)..."
              value={manualScanInput}
              onChange={(e) => setManualScanInput(e.target.value)}
              onBlur={() => {
                setTimeout(() => {
                  usbInputRef.current?.focus();
                }, 150);
              }}
              className="w-48 bg-white border border-emerald-300 rounded-xl px-3 py-1.5 text-xs text-slate-800 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
              autoFocus
            />
          </form>
        </div>

        {/* Right: Secondary Downtime Indicator */}
        <div className="hidden xl:flex items-center gap-3.5 bg-[#F5F7FA] border border-[#DCE3EA] px-5 py-2.5 rounded-2xl">
          <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block">Tiempo Muerto</span>
            <span className="text-lg font-black font-mono text-amber-600">
              {activeDowntimeMinutes} <span className="text-xs font-normal text-slate-500">min</span>
            </span>
          </div>
        </div>

      </footer>

    </div>
  );
};
