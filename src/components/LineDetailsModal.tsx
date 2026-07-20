import React, { useEffect, useState, useRef } from 'react';
import { supabase, getActiveStaffingTarget, DEFAULT_SMT_LAYOUT } from '../lib/supabaseClient';
import { X, Clock, QrCode, Maximize, Minimize, User, Utensils, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';

interface LineDetailsModalProps {
  lineId?: string;
  isOpen?: boolean;
  onClose?: () => void;
  isTvView?: boolean;
}

// SVG Circular Gauge component for bottom status indicator
const LargeCircularGauge: React.FC<{ percentage: number; color: string; present: number; target: number }> = ({
  percentage,
  color,
  present,
  target
}) => {
  const size = 110;
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
          stroke="currentColor"
          strokeWidth="10"
          className="text-slate-200 dark:text-slate-800"
          fill="transparent"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth="10"
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
        <span className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400 mt-1">
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

  // Inline scanner drawer toggle / input modal
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

    // Load line info
    const { data: lineData } = await supabase.from('lineas').select('*, area:areas(*)').eq('id', lineId);
    if (lineData && lineData.length > 0) setLine(lineData[0]);

    // Load ALL scans
    const { data: escData } = await supabase.from('escaneos').select('*').eq('line_id', lineId);
    if (escData) setEscaneos(escData);

    // Load assignments
    const { data: assignData } = await supabase.from('empleados_linea').select('*, empleado:empleados(*)').eq('line_id', lineId);
    if (assignData) setAssignments(assignData);

    // Load positions mapping
    const { data: posData } = await supabase.from('posiciones').select('*, empleado:empleados(*)').eq('line_id', lineId);
    if (posData) setPosiciones(posData);

    // Load downtime logs
    const { data: tmData } = await supabase.from('tiempos_muertos').select('*').eq('line_id', lineId);
    if (tmData) setTiemposMuertos(tmData);
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

      const channel = supabase.channel(`line-detail-realtime-${lineId}`)
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

  // Color logic for large bottom circle & header
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
    <div className="fixed inset-0 z-50 flex flex-col bg-[#050B18] text-slate-100 overflow-hidden font-sans select-none">
      
      {/* 1. INDUSTRIAL CABECERA (Header) */}
      <header className="h-16 shrink-0 bg-slate-950 border-b border-slate-800 px-6 flex items-center justify-between z-20 shadow-md">
        
        {/* Left: Line Name & Shift Info */}
        <div className="flex items-center space-x-4">
          <button 
            onClick={handleClose}
            className="p-2 rounded-xl bg-slate-850 hover:bg-slate-750 text-slate-300 hover:text-white transition-all cursor-pointer border border-slate-700"
            title="Volver al Dashboard"
          >
            <X className="w-5 h-5" />
          </button>

          <div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full animate-pulse" style={{ backgroundColor: statusColor }} />
              <h1 className="text-xl font-black tracking-wider uppercase text-white font-mono">{line.name}</h1>
              <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono font-bold">
                {line.area?.name || 'SMT'}
              </span>
            </div>
            <span className="text-[11px] text-slate-400 font-semibold block">
              {line.process || 'Línea de Ensamble y Producción'}
            </span>
          </div>
        </div>

        {/* Center: Industrial Digital Clock & Active Shift */}
        <div className="flex items-center gap-6 bg-slate-900 border border-slate-800 px-5 py-1.5 rounded-2xl shadow-inner">
          <div className="text-center">
            <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 block">Turno Activo</span>
            <span className="text-xs font-black font-mono text-emerald-400 uppercase">{activeShiftName}</span>
          </div>

          <div className="h-6 w-px bg-slate-800" />

          {/* Clock */}
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-emerald-400" />
            <span className="text-xl font-black font-mono tracking-widest text-white">{currentTimeStr}</span>
          </div>

          <div className="h-6 w-px bg-slate-800 hidden md:block" />

          <div className="text-right hidden md:block">
            <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 block">Fecha</span>
            <span className="text-xs font-bold text-slate-300">{currentDateStr}</span>
          </div>
        </div>

        {/* Right: Actions (Fullscreen & Exit) */}
        <div className="flex items-center space-x-3">
          {isCoverageActive && (
            <div className="flex items-center gap-1.5 bg-blue-950/80 border border-blue-500/40 text-blue-400 px-3 py-1.5 rounded-xl text-xs font-bold animate-pulse">
              <Utensils className="w-4 h-4 text-blue-400" />
              <span>Cobertura de Comedor Activa</span>
            </div>
          )}

          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white transition-all cursor-pointer border border-slate-800"
            title="Pantalla Completa"
          >
            {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* 2. MAIN VISUAL CANVAS (Layout Blueprint + Real-Time Position Markers) */}
      <main className="flex-grow min-h-0 relative p-4 bg-[#080E1E] flex flex-col justify-center items-center overflow-hidden">
        
        {/* Visual Blueprint Container */}
        <div className="relative w-full h-full max-w-[1400px] max-h-[720px] bg-slate-950/80 border border-slate-800 rounded-2xl shadow-2xl flex items-center justify-center overflow-hidden p-2">
          
          {/* Blueprint Layout Background Image */}
          <img 
            src={layoutImageSrc} 
            alt={`Layout ${line.name}`} 
            className="w-full h-full object-contain rounded-xl opacity-90 select-none pointer-events-none"
          />

          {/* Real-time Operator Overlay Markers */}
          {posiciones.map((pos, idx) => {
            const assignedEmp = pos.empleado || assignments.find(a => a.employee_id === pos.employee_id)?.empleado;
            const badgeId = assignedEmp?.badge_id;
            const empName = assignedEmp?.name || pos.employee_name || 'Sin Asignar';
            
            const isPresent = badgeId && presentBadges.includes(badgeId);

            // COLOR CODE RULES:
            // VERDE (#22C55E): Operador presente, escaneado correctamente
            // ROJO (#EF4444): Operador faltante, no registrado
            // AZUL (#3B82F6): Operador presente durante cobertura de comedor
            // GRIS (#64748B): Operador en comedor (posición desocupada temporalmente)
            let markerColor = '#EF4444'; // RED default (missing)
            let statusBadgeLabel = 'FALTANTE';

            if (isCoverageActive) {
              if (isPresent) {
                markerColor = '#3B82F6'; // BLUE (covering line)
                statusBadgeLabel = 'COBERTURA COMEDOR';
              } else {
                markerColor = '#64748B'; // GREY (in cafeteria)
                statusBadgeLabel = 'EN COMEDOR';
              }
            } else {
              if (isPresent) {
                markerColor = '#22C55E'; // GREEN (present)
                statusBadgeLabel = 'PRESENTE';
              } else {
                markerColor = '#EF4444'; // RED (missing)
                statusBadgeLabel = 'AUSENTE';
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
                {/* Operator Pin Badge */}
                <div 
                  style={{
                    backgroundColor: `${markerColor}20`,
                    borderColor: markerColor,
                    boxShadow: `0 0 16px ${markerColor}60`
                  }}
                  className="bg-slate-900/95 border-2 rounded-xl px-2.5 py-1.5 shadow-2xl flex flex-col items-center justify-center min-w-[110px] text-center hover:scale-105 transition-transform"
                >
                  {/* Position Code & Station */}
                  <div className="flex items-center justify-between w-full gap-1 border-b border-slate-700/60 pb-1 mb-1">
                    <span className="text-[10px] font-black font-mono text-white tracking-wider">
                      {pos.code || `POS${idx + 1}`}
                    </span>
                    <span 
                      className="w-2.5 h-2.5 rounded-full shrink-0 animate-pulse" 
                      style={{ backgroundColor: markerColor }} 
                    />
                  </div>

                  {/* Station Name */}
                  <span className="text-[10px] font-bold text-slate-300 truncate w-full block">
                    {pos.station_name}
                  </span>

                  {/* Employee Name */}
                  <div className="flex items-center gap-1 mt-0.5">
                    <User className="w-3 h-3 text-slate-400" />
                    <span className="text-[11px] font-extrabold text-white truncate max-w-[90px]">
                      {empName}
                    </span>
                  </div>

                  {/* Badge ID */}
                  {badgeId && (
                    <span className="text-[9px] font-mono text-slate-400 font-semibold mt-0.5 block">
                      #{badgeId}
                    </span>
                  )}
                </div>

                {/* Extended Status Tooltip on Hover */}
                <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-slate-950 border border-slate-800 p-2 rounded-lg text-center pointer-events-none z-30 min-w-[140px] shadow-2xl">
                  <span className="text-[9px] font-bold tracking-wider uppercase block" style={{ color: markerColor }}>
                    {statusBadgeLabel}
                  </span>
                  <span className="text-[10px] text-slate-300 block font-mono">
                    Coordenadas: ({pos.x_percent}%, {pos.y_percent}%)
                  </span>
                </div>
              </div>
            );
          })}

        </div>
      </main>

      {/* 3. INDICADORES INFERIORES Y BOTON DE ESCANEO (Bottom Bar) */}
      <footer className="h-32 shrink-0 bg-slate-950 border-t border-slate-800 px-6 py-3 flex items-center justify-between z-20 shadow-2xl">
        
        {/* Left: Large Circular Gauge & Coverage KPI */}
        <div className="flex items-center space-x-5">
          <LargeCircularGauge percentage={coveragePct} color={statusColor} present={presentCount} target={target} />

          <div className="flex flex-col justify-center">
            <span className="text-2xl font-black uppercase text-white font-mono tracking-wider">
              {line.name}
            </span>
            <span className="text-xs text-slate-400 font-semibold mt-0.5">
              Cobertura de Plantilla en Tiempo Real
            </span>
            <div className="flex items-center gap-2 mt-2">
              <span 
                className="px-2 py-0.5 rounded text-[10px] font-black font-mono uppercase"
                style={{ backgroundColor: `${statusColor}25`, color: statusColor, border: `1px solid ${statusColor}` }}
              >
                {isCoverageActive ? 'EN COBERTURA DE COMEDOR' : coveragePct >= 100 ? 'PLANTILLA COMPLETA' : 'FALTA PERSONAL'}
              </span>
            </div>
          </div>
        </div>

        {/* Center: Secondary Downtime Status */}
        <div className="hidden lg:flex items-center gap-3 bg-slate-900 border border-slate-800 px-4 py-2.5 rounded-2xl">
          <div className="p-2 bg-amber-500/10 text-amber-500 rounded-xl">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block">Tiempo Muerto Activo</span>
            <span className="text-lg font-black font-mono text-amber-400">
              {activeDowntimeMinutes} <span className="text-xs font-normal text-slate-400">minutos</span>
            </span>
          </div>
        </div>

        {/* Right: Big Quick Scan Button */}
        <div className="flex items-center space-x-4">
          <button
            onClick={() => setIsScannerOpen(!isScannerOpen)}
            className="flex items-center gap-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold px-6 py-3.5 rounded-2xl shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all cursor-pointer transform hover:scale-105"
          >
            <QrCode className="w-6 h-6" />
            <span className="text-sm uppercase tracking-wider">Escanear Gafete</span>
          </button>
        </div>

      </footer>

      {/* Inline Quick Scan Modal Drawer */}
      {isScannerOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md p-6 rounded-2xl shadow-2xl relative">
            <button
              onClick={() => setIsScannerOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl">
                <QrCode className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-white">Escanear Gafete</h3>
                <p className="text-xs text-slate-400">Ingrese o escanee el número de empleado</p>
              </div>
            </div>

            <form onSubmit={handlePerformScan} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Número de Gafete / Empleado
                </label>
                <input
                  ref={scanInputRef}
                  type="text"
                  placeholder="Ej. 100234"
                  value={scanBadgeInput}
                  onChange={(e) => setScanBadgeInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white font-mono text-base focus:outline-none focus:border-emerald-500"
                  autoFocus
                />
              </div>

              {scanFeedback.message && (
                <div className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
                  scanFeedback.status === 'success' ? 'bg-emerald-950 border border-emerald-500/30 text-emerald-400' : 'bg-red-950 border border-red-500/30 text-red-400'
                }`}>
                  {scanFeedback.status === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                  <span>{scanFeedback.message}</span>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsScannerOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-extrabold cursor-pointer"
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
