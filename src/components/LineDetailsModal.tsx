import React, { useEffect, useState, useRef } from 'react';
import { supabase, getActiveStaffingTarget, DEFAULT_SMT_LAYOUT } from '../lib/supabaseClient';
import { X, Clock, QrCode, Maximize, Minimize, Utensils, AlertTriangle, CheckCircle2, ArrowLeft } from 'lucide-react';
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
        <span className="text-xs font-mono font-bold text-slate-500 mt-1">
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
  const [assignments, setAssignments] = useState<any[]>([]);
  const [posiciones, setPosiciones] = useState<any[]>([]);
  const [tiemposMuertos, setTiemposMuertos] = useState<any[]>([]);

  // Inline quick scanner drawer states
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scanBadgeInput, setScanBadgeInput] = useState('');
  const [scanFeedback, setScanFeedback] = useState<{ status: 'success' | 'error' | null; message: string }>({
    status: null,
    message: ''
  });

  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Digital Industrial Clock states
  const [currentTimeStr, setCurrentTimeStr] = useState('00:00:00');
  const [currentDateStr, setCurrentDateStr] = useState('');

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

      // Load ALL scans
      const { data: escData } = await supabase.from('escaneos').select('*').eq('line_id', lineId);
      setEscaneos(escData || []);

      // Load assignments
      const { data: assignData } = await supabase.from('empleados_linea').select('*, empleado:empleados(*)').eq('line_id', lineId);
      setAssignments(assignData || []);

      // Load positions mapping (try 'posiciones' then fallback to 'line_positions')
      let posRes = await supabase.from('posiciones').select('*, empleado:empleados(*)').eq('line_id', lineId);
      if (!posRes.data || posRes.data.length === 0) {
        posRes = await supabase.from('line_positions').select('*, empleado:empleados(*)').eq('line_id', lineId);
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

  useEffect(() => {
    if (isOpen && lineId) {
      loadData();

      const channel = supabase.channel(`line-detail-[#005486]-realtime-${lineId}`)
        .on('postgres_changes', { event: '*', schema: 'public' }, () => {
          loadData();
        })
        .subscribe();

      return () => {
        channel.unsubscribe();
      };
    }
  }, [isOpen, lineId]);

  // Execute quick scan
  const handlePerformScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scanBadgeInput.trim()) return;

    setScanFeedback({ status: null, message: '' });

    const { error } = await supabase.from('escaneos').insert({
      badge_id: scanBadgeInput.trim(),
      line_id: lineId,
      event_type: 'shift_start'
    });

    if (error) {
      setScanFeedback({ status: 'error', message: error.message || 'Error al validar gafete' });
    } else {
      setScanFeedback({ status: 'success', message: 'Escaneo registrado exitosamente' });
      setScanBadgeInput('');
      loadData();
      setTimeout(() => {
        setIsScannerOpen(false);
        setScanFeedback({ status: null, message: '' });
      }, 1200);
    }
  };

  if (!isOpen || !line) return null;

  // Active Staffing Target & Coverage Calculations
  const { target, isCoverageActive, activeShiftName } = getActiveStaffingTarget(line.id);

  // Group successful scans to determine present operators
  const successfulScans = escaneos.filter(s => s.was_successful);
  const lastScanByBadge: Record<string, any> = {};
  successfulScans
    .sort((a, b) => new Date(a.event_time).getTime() - new Date(b.event_time).getTime())
    .forEach(scan => {
      lastScanByBadge[scan.badge_id] = scan;
    });

  const presentBadges = Object.values(lastScanByBadge)
    .filter((s: any) => s.event_type === 'shift_start' || s.event_type === 'lunch_return')
    .map((s: any) => s.badge_id);

  const presentCount = presentBadges.length;
  const coveragePct = target > 0 ? Math.round((presentCount / target) * 100) : 0;

  // Color logic for overall line status
  let statusColor = '#EF4444'; // Red
  if (isCoverageActive && presentCount >= target) {
    statusColor = '#3B82F6'; // Blue
  } else if (coveragePct >= 100) {
    statusColor = '#22C55E'; // Green
  } else if (coveragePct >= 80) {
    statusColor = '#EAB308'; // Yellow
  }

  // Active Downtime calculation
  const activeDt = tiemposMuertos.find(tm => !tm.resolved);
  const activeDowntimeMinutes = activeDt
    ? Math.max(1, Math.floor((new Date().getTime() - new Date(activeDt.start_time).getTime()) / 60000))
    : 0;

  // Layout Image (Default SMT Blueprint if none uploaded)
  const layoutImageSrc = line.layout_url || DEFAULT_SMT_LAYOUT;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#F5F7FA] text-slate-800 overflow-hidden font-sans select-none">
      
      {/* 1. CORPORATE HEADER (#005486) */}
      <header className="h-16 shrink-0 bg-[#005486] border-b border-[#00426a] px-6 flex items-center justify-between z-20 shadow-md text-white">
        
        {/* Left: Back Button + Line Title */}
        <div className="flex items-center space-x-4">
          <button 
            onClick={handleClose}
            className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer border border-white/20"
            title="Volver al Dashboard"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div>
            <div className="flex items-center gap-2.5">
              <span className="w-3 h-3 rounded-full animate-pulse" style={{ backgroundColor: statusColor }} />
              <h1 className="text-xl font-black tracking-wider uppercase text-white font-mono">{line.name}</h1>
              <span className="text-xs px-2.5 py-0.5 rounded-md bg-white/15 border border-white/20 text-white font-mono font-bold uppercase">
                {line.area?.name || 'SMT'}
              </span>
            </div>
            <span className="text-xs text-white/80 font-semibold block mt-0.5">
              {line.process || 'Línea de Ensamble y Producción'}
            </span>
          </div>
        </div>

        {/* Center: Industrial Digital Clock & Active Shift */}
        <div className="flex items-center gap-6 bg-black/15 border border-white/10 px-5 py-2 rounded-2xl shadow-inner text-white">
          <div className="text-center">
            <span className="text-[10px] font-bold uppercase tracking-widest text-white/70 block">Turno Activo</span>
            <span className="text-xs font-black font-mono text-white uppercase">{activeShiftName}</span>
          </div>

          <div className="h-6 w-px bg-white/20" />

          {/* Digital Clock */}
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-emerald-300" />
            <span className="text-xl font-black font-mono tracking-widest text-white">{currentTimeStr}</span>
          </div>

          <div className="h-6 w-px bg-white/20 hidden md:block" />

          <div className="text-right hidden md:block">
            <span className="text-[10px] font-bold uppercase tracking-widest text-white/70 block">Fecha</span>
            <span className="text-xs font-bold text-white">{currentDateStr}</span>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center space-x-3">
          {isCoverageActive && (
            <div className="flex items-center gap-1.5 bg-blue-500/20 border border-blue-200/40 text-white px-3 py-1.5 rounded-xl text-xs font-bold animate-pulse">
              <Utensils className="w-4 h-4 text-white" />
              <span>Cobertura de Comedor</span>
            </div>
          )}

          <button
            onClick={toggleFullscreen}
            className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer border border-white/20"
            title="Pantalla Completa"
          >
            {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
          </button>
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

          {/* Minimalist Operator Pins (CIRCULAR ICONS ONLY - NO TEXT CARDS ON CANVAS) */}
          {posiciones.map((pos, idx) => {
            const assignedEmp = pos.empleado || assignments.find(a => a.employee_id === pos.employee_id)?.empleado;
            const badgeId = assignedEmp?.badge_id;
            const isPresent = Boolean(badgeId && presentBadges.includes(badgeId));

            // COLOR RULES:
            // 🟢 VERDE (#22C55E): Operador presente
            // 🔴 ROJO (#EF4444): Operador faltante
            // 🔵 AZUL (#3B82F6): Cobertura de comedor activa (operador en línea)
            // ⚪ GRIS (#94A3B8): Operador en comedor (posición desocupada temporalmente)
            let markerColor = '#EF4444'; // RED (missing)
            let statusLabel = 'Operador Faltante';

            if (isCoverageActive) {
              if (isPresent) {
                markerColor = '#3B82F6'; // BLUE
                statusLabel = 'En Cobertura de Comedor';
              } else {
                markerColor = '#94A3B8'; // GREY
                statusLabel = 'En Comedor';
              }
            } else {
              if (isPresent) {
                markerColor = '#22C55E'; // GREEN
                statusLabel = 'Operador Presente';
              } else {
                markerColor = '#EF4444'; // RED
                statusLabel = 'Operador Faltante';
              }
            }

            return (
              <div 
                key={pos.id || idx}
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
                    className="absolute w-8 h-8 rounded-full animate-ping opacity-40"
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
                <div className="opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2.5 bg-slate-900 text-white p-2.5 rounded-xl z-30 min-w-[140px] shadow-xl border border-slate-800 text-center scale-95 group-hover:scale-100">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-1 mb-1">
                    <span className="text-xs font-black font-mono text-emerald-400 uppercase tracking-wider">
                      ● {pos.code || `POS${idx + 1}`}
                    </span>
                    <span 
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: markerColor }}
                    />
                  </div>

                  <span className="text-[11px] font-bold text-slate-300 block truncate">
                    {pos.station_name || pos.code}
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

        </div>
      </main>

      {/* 3. MINIMALIST LIGHT INDICATORS BAR (Bottom Bar) */}
      <footer className="h-28 shrink-0 bg-white border-t border-[#DCE3EA] px-8 py-3 flex items-center justify-between z-20 shadow-sm">
        
        {/* Left: Large Circular Gauge & Coverage KPI */}
        <div className="flex items-center space-x-6">
          <LargeCircularGauge percentage={coveragePct} color={statusColor} present={presentCount} target={target} />

          <div className="flex flex-col justify-center">
            <span className="text-2xl font-black uppercase text-slate-900 font-mono tracking-wider">
              {line.name}
            </span>
            <div className="flex items-center gap-2 mt-1">
              <span 
                className="px-2.5 py-0.5 rounded-md text-xs font-extrabold font-mono uppercase"
                style={{ backgroundColor: `${statusColor}15`, color: statusColor, border: `1px solid ${statusColor}40` }}
              >
                {isCoverageActive ? 'EN COBERTURA DE COMEDOR' : coveragePct >= 100 ? 'PLANTILLA COMPLETA' : 'FALTA PERSONAL'}
              </span>
            </div>
          </div>
        </div>

        {/* Center: Secondary Downtime Indicator */}
        <div className="hidden lg:flex items-center gap-3.5 bg-[#F5F7FA] border border-[#DCE3EA] px-5 py-2.5 rounded-2xl">
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

        {/* Right: Clean Corporate Scan Button */}
        <div className="flex items-center space-x-4">
          <button
            onClick={() => setIsScannerOpen(!isScannerOpen)}
            className="flex items-center gap-2.5 bg-[#005486] hover:bg-[#00426a] text-white font-extrabold px-6 py-3.5 rounded-2xl shadow-md transition-all cursor-pointer transform hover:scale-105"
          >
            <QrCode className="w-5 h-5" />
            <span className="text-xs uppercase tracking-wider">Escanear Gafete</span>
          </button>
        </div>

      </footer>

      {/* Inline Quick Scan Modal Drawer (Corporate Light Theme) */}
      {isScannerOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-[#DCE3EA] w-full max-w-md p-6 rounded-2xl shadow-2xl relative">
            <button
              onClick={() => setIsScannerOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 bg-blue-50 text-[#005486] rounded-xl border border-blue-100">
                <QrCode className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900">Escanear Gafete</h3>
                <p className="text-xs text-slate-500">Ingrese o escanee el número de empleado</p>
              </div>
            </div>

            <form onSubmit={handlePerformScan} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Número de Gafete / Empleado
                </label>
                <input
                  ref={scanInputRef}
                  type="text"
                  placeholder="Ej. 100234"
                  value={scanBadgeInput}
                  onChange={(e) => setScanBadgeInput(e.target.value)}
                  className="w-full bg-[#F5F7FA] border border-[#DCE3EA] rounded-xl px-4 py-3 text-slate-900 font-mono text-base focus:outline-none focus:border-[#005486]"
                  autoFocus
                />
              </div>

              {scanFeedback.message && (
                <div className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
                  scanFeedback.status === 'success' ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' : 'bg-red-50 border border-red-200 text-red-700'
                }`}>
                  {scanFeedback.status === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                  <span>{scanFeedback.message}</span>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsScannerOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#005486] hover:bg-[#00426a] text-white rounded-xl text-xs font-extrabold cursor-pointer shadow-sm"
                >
                  Validar Escaneo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
