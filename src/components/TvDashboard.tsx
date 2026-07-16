import React, { useEffect, useState } from 'react';
import { supabase, getActiveStaffingTarget } from '../lib/supabaseClient';
import { Clock, Maximize, Minimize, BarChart3 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const TvDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [lines, setLines] = useState<any[]>([]);
  const [scans, setScans] = useState<any[]>([]);
  const [downtimes, setDowntimes] = useState<any[]>([]);
  
  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false);

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

  const loadData = async () => {
    const { data: linesData } = await supabase.from('lineas').select('*');
    const { data: scansData } = await supabase.from('escaneos').select('*');
    const { data: dtData } = await supabase.from('tiempos_muertos').select('*');

    if (linesData) setLines(linesData);
    if (scansData) setScans(scansData);
    if (dtData) setDowntimes(dtData);
  };

  useEffect(() => {
    loadData();

    // Live subscription
    const channel = supabase.channel('tv-dashboard-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public' }, () => {
        loadData();
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, []);

  const getPresentOperatorsCount = (lineId: string) => {
    const lineScans = scans.filter((s: any) => s.line_id === lineId && s.was_successful);
    const lastEventMap: Record<string, string> = {};
    lineScans
      .sort((a: any, b: any) => new Date(a.event_time).getTime() - new Date(b.event_time).getTime())
      .forEach((scan: any) => {
        lastEventMap[scan.badge_id] = scan.event_type;
      });

    return Object.values(lastEventMap).filter(
      type => type === 'shift_start' || type === 'lunch_return'
    ).length;
  };

  const getActiveDowntimeMinutes = (lineId: string) => {
    const activeDt = downtimes.find((dt: any) => dt.line_id === lineId && !dt.resolved);
    if (!activeDt) return 0;
    const elapsedMs = new Date().getTime() - new Date(activeDt.start_time).getTime();
    return Math.max(0, Math.floor(elapsedMs / 60000));
  };

  // Counts for top summary
  let countComplete = 0;
  let countInProgress = 0;
  let countCritical = 0;

  lines.forEach((line: any) => {
    const { target, isCoverageActive } = getActiveStaffingTarget(line.id);
    const present = getPresentOperatorsCount(line.id);
    const pct = target > 0 ? Math.round((present / target) * 100) : 0;
    
    if (isCoverageActive || pct >= 100) {
      countComplete++;
    } else if (pct >= 80) {
      countInProgress++;
    } else {
      countCritical++;
    }
  });

  const totalLines = lines.length || 1;
  const pctComplete = Math.round((countComplete / totalLines) * 100);
  const pctInProgress = Math.round((countInProgress / totalLines) * 100);
  const pctCritical = Math.round((countCritical / totalLines) * 100);

  // Dynamic Row / Col Grid configurations
  const lineCount = lines.length;
  let gridCols = 4;
  if (lineCount <= 4) gridCols = 2;
  else if (lineCount <= 9) gridCols = 3;
  else if (lineCount <= 12) gridCols = 4;
  else if (lineCount <= 16) gridCols = 4;
  else gridCols = 5;

  const rowsCount = Math.ceil(lineCount / gridCols) || 1;
  
  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))`,
    gridTemplateRows: `repeat(${rowsCount}, minmax(0, 1fr))`,
    gap: '12px',
    height: '100%',
    width: '100%'
  };

  return (
    <div className="w-full h-full bg-[#050B18] text-slate-100 p-4 flex flex-col justify-between overflow-hidden select-none">
      
      {/* TV Header Banner */}
      <div className="flex justify-between items-center border-b border-slate-900 pb-2 mb-3 shrink-0">
        <div>
          <span className="text-[10px] tracking-widest text-emerald-450 font-bold font-mono uppercase block mb-0.5 animate-pulse">
            [ ESTADO EN TIEMPO REAL - PISO DE PRODUCCIÓN ]
          </span>
          <h1 className="text-xl font-black tracking-widest font-sans text-slate-100 flex items-center gap-2">
            LINEPULSE <span className="text-[#F59E0B] text-sm font-bold font-mono">MES DISPLAY</span>
          </h1>
        </div>
        
        <div className="flex items-center space-x-3.5">
          {/* Back to Executive Dashboard */}
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 hover:text-white px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all shadow-sm cursor-pointer"
          >
            <BarChart3 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Vista Ejecutivo</span>
          </button>

          {/* Fullscreen toggle */}
          <button
            onClick={toggleFullscreen}
            className="flex items-center gap-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-350 hover:text-white px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all shadow-sm cursor-pointer"
          >
            {isFullscreen ? <Minimize className="w-3.5 h-3.5 text-amber-400" /> : <Maximize className="w-3.5 h-3.5 text-emerald-450" />}
            <span>{isFullscreen ? 'Salir Fullscreen' : 'Pantalla Completa'}</span>
          </button>
          
          <div className="text-right">
            <span className="text-xs font-bold text-slate-400 block tracking-wider font-mono">Turno Activo: Primero</span>
            <span className="text-[10px] text-slate-500 font-mono">{new Date().toLocaleDateString('es-MX')}</span>
          </div>
        </div>
      </div>

      {/* Executive TV Summary Bar (High visibility counters) */}
      <div className="grid grid-cols-3 gap-3 mb-3 bg-[#0B132B] border border-slate-800 p-2 rounded-xl text-center shrink-0">
        <div className="flex items-center justify-center space-x-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#22C55E] shadow-[0_0_8px_#22C55E] animate-pulse"></span>
          <div>
            <span className="text-[9px] text-slate-400 block uppercase font-bold">Plantillas Completas</span>
            <span className="text-base font-black font-mono text-[#22C55E]">{countComplete} <span className="text-xs text-slate-500">({pctComplete}%)</span></span>
          </div>
        </div>

        <div className="flex items-center justify-center space-x-2 border-l border-slate-900">
          <span className="w-2.5 h-2.5 rounded-full bg-[#F59E0B] shadow-[0_0_8px_#F59E0B] animate-pulse"></span>
          <div>
            <span className="text-[9px] text-slate-400 block uppercase font-bold">Completándose (80-99%)</span>
            <span className="text-base font-black font-mono text-[#F59E0B]">{countInProgress} <span className="text-xs text-slate-500">({pctInProgress}%)</span></span>
          </div>
        </div>

        <div className="flex items-center justify-center space-x-2 border-l border-slate-900">
          <span className="w-2.5 h-2.5 rounded-full bg-[#EF4444] shadow-[0_0_8px_#EF4444] animate-pulse"></span>
          <div>
            <span className="text-[9px] text-slate-400 block uppercase font-bold">Plantilla Crítica (&lt;80%)</span>
            <span className="text-base font-black font-mono text-[#EF4444]">{countCritical} <span className="text-xs text-slate-500">({pctCritical}%)</span></span>
          </div>
        </div>
      </div>

      {/* Main Large Visual Grid (No-scroll stretching) */}
      <div className="flex-1 min-h-0 w-full mb-3">
        <div style={gridStyle}>
          {lines.map((line: any) => {
            const { target, isCoverageActive } = getActiveStaffingTarget(line.id);
            const present = getPresentOperatorsCount(line.id);
            const pct = target > 0 ? Math.round((present / target) * 100) : 0;
            const activeDowntime = getActiveDowntimeMinutes(line.id);

            let ringClass = 'glow-red';
            let glowClass = 'bg-[#EF4444] shadow-[0_0_12px_#EF4444]';
            let textStatus = '🔴 DENEGADO / METAS';
            let pctColor = 'text-[#EF4444]';

            if (isCoverageActive) {
              ringClass = 'glow-blue';
              glowClass = 'bg-[#3B82F6] shadow-[0_0_12px_#3B82F6]';
              textStatus = '🔵 COMEDOR ACTIVO';
              pctColor = 'text-[#3B82F6]';
            } else if (pct >= 100) {
              ringClass = 'glow-green';
              glowClass = 'bg-[#22C55E] shadow-[0_0_12px_#22C55E]';
              textStatus = '🟢 OPERATIVA COMPLETA';
              pctColor = 'text-[#22C55E]';
            } else if (pct >= 80) {
              ringClass = 'glow-yellow';
              glowClass = 'bg-[#F59E0B] shadow-[0_0_12px_#F59E0B]';
              textStatus = '🟡 COBERTURA MODERADA';
              pctColor = 'text-[#F59E0B]';
            }

            return (
              <div 
                key={line.id} 
                onClick={() => navigate(`/linea/${line.id}?tv=true`)}
                className={`bg-[#0B132B] border-2 rounded-xl p-4 flex items-center justify-between transition-all duration-500 relative overflow-hidden cursor-pointer hover:border-slate-700 ${ringClass}`}
              >
                {/* Information blocks */}
                <div className="flex flex-col justify-between h-full min-w-0 pr-2 z-10">
                  <div className="min-w-0">
                    <h3 className="text-[clamp(1rem,1.5vh,1.25rem)] font-extrabold tracking-wide text-slate-100 leading-none truncate">{line.name}</h3>
                    <span className={`text-[clamp(0.65rem,0.9vh,0.75rem)] font-bold tracking-widest ${pctColor} block mt-1.5 uppercase`}>{textStatus}</span>
                  </div>

                  <div className="mt-2 shrink-0">
                    <span className="text-[clamp(0.65rem,0.9vh,0.75rem)] text-slate-550 font-bold uppercase tracking-wider block mb-0.5">Operadores</span>
                    <span className="text-[clamp(0.9rem,1.3vh,1.1rem)] font-black font-mono text-slate-200">
                      {present} <span className="text-slate-500 text-xs font-normal">/ {target}</span>
                    </span>
                  </div>
                </div>

                {/* Right: Coverage + LED Status Indicator */}
                <div className="flex items-center gap-3 shrink-0 z-10">
                  {/* Downtime Alert indicator */}
                  {pct < 100 && activeDowntime > 0 && (
                    <div className="flex items-center gap-0.5 bg-red-950/60 border border-red-500/30 px-1.5 py-0.5 rounded-lg text-[10px] text-red-400 font-mono font-bold animate-pulse">
                      <Clock className="w-3.5 h-3.5 text-red-400 shrink-0" />
                      <span>{activeDowntime}m</span>
                    </div>
                  )}

                  {/* Large coverage percentage */}
                  <span className={`text-[clamp(1.7rem,2.8vh,2.3rem)] font-black font-mono leading-none tracking-tighter ${pctColor}`}>
                    {pct}%
                  </span>

                  {/* Large visual status indicator LED */}
                  <span className={`w-3.5 h-3.5 rounded-full ${glowClass} shrink-0 ml-1`} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Floor display tickers */}
      <div className="border-t border-slate-900 pt-2 flex justify-between text-[10px] text-slate-500 font-mono shrink-0">
        <span>SISTEMA DE PLANTA ACTIVO • LECTOR USB HABILITADO</span>
        <span>LINEPULSE TV-DASHBOARD v3.0.0</span>
      </div>

    </div>
  );
};

