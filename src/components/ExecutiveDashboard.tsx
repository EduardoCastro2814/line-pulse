import React, { useEffect, useState } from 'react';
import { supabase, getActiveStaffingTarget } from '../lib/supabaseClient';
import { Users, AlertTriangle, Clock, Percent, Search, Utensils } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// SVG Circular Gauge component for ultra-compact line compliance display
const CircularGauge: React.FC<{ percentage: number; color: string; size?: number }> = ({ percentage, color, size = 46 }) => {
  const radius = (size - 6) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (Math.min(100, Math.max(0, percentage)) / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth="4"
          className="text-slate-100 dark:text-slate-800"
          fill="transparent"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth="4"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="transparent"
          className="transition-all duration-500 ease-out"
        />
      </svg>
      <span className="absolute font-mono font-black text-[11px] text-slate-800 dark:text-slate-100">
        {percentage}%
      </span>
    </div>
  );
};

export const ExecutiveDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [lines, setLines] = useState<any[]>([]);
  const [scans, setScans] = useState<any[]>([]);
  const [downtimes, setDowntimes] = useState<any[]>([]);
  const [areas, setAreas] = useState<any[]>([]);

  // Filtering states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedArea, setSelectedArea] = useState('ALL');

  const loadData = async () => {
    const { data: linesData } = await supabase.from('lineas').select('*');
    const { data: scansData } = await supabase.from('escaneos').select('*');
    const { data: dtData } = await supabase.from('tiempos_muertos').select('*');
    const { data: areasData } = await supabase.from('areas').select('*');

    if (linesData) setLines(linesData);
    if (scansData) setScans(scansData);
    if (dtData) setDowntimes(dtData);
    if (areasData) setAreas(areasData);
  };

  useEffect(() => {
    loadData();

    // Live subscription for updates
    const channel = supabase.channel('exec-dashboard-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public' }, () => {
        loadData();
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, []);

  // Helper to count present operators for a line
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

  // Helper to get active downtime duration in minutes
  const getActiveDowntimeMinutes = (lineId: string) => {
    const activeDt = downtimes.find((dt: any) => dt.line_id === lineId && !dt.resolved);
    if (!activeDt) return 0;
    const elapsedMs = new Date().getTime() - new Date(activeDt.start_time).getTime();
    return Math.max(0, Math.floor(elapsedMs / 60000));
  };

  // KPI calculations
  let totalRequired = 0;
  let totalPresent = 0;
  let missingCount = 0;
  let totalDowntimeToday = 0;

  lines.forEach((line: any) => {
    const { target } = getActiveStaffingTarget(line.id);
    const present = getPresentOperatorsCount(line.id);
    totalRequired += target;
    totalPresent += present;
    
    if (present < target) {
      missingCount += (target - present);
    }
  });

  const todayStr = new Date().toISOString().split('T')[0];
  downtimes.forEach((dt: any) => {
    if (dt.date === todayStr) {
      const duration = dt.resolved 
        ? (dt.duration_minutes || 0)
        : getActiveDowntimeMinutes(dt.line_id);
      totalDowntimeToday += duration;
    }
  });

  const globalCoveragePct = totalRequired > 0 ? Math.round((totalPresent / totalRequired) * 100) : 0;

  // Filter lines
  const filteredLines = lines.filter((line: any) => {
    const matchesSearch = line.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesArea = selectedArea === 'ALL' || line.area_id === selectedArea;
    return matchesSearch && matchesArea;
  });

  // Grid style to display 15 to 20 lines on standard viewport
  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
    gap: '12px',
    height: '100%',
    width: '100%',
    overflowY: 'auto' as const,
    alignContent: 'start'
  };

  return (
    <div className="bg-white dark:bg-[#0B1329] text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-800 rounded-2xl flex-grow h-full flex flex-col overflow-hidden p-4 space-y-4 shadow-sm select-none">
      
      {/* 1. EXECUTIVE SUMMARY KPI BAR */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 shrink-0">
        
        {/* Coverage % */}
        <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase block">Cobertura Global</span>
            <span className="text-xl font-black font-mono text-slate-800 dark:text-white">{globalCoveragePct}%</span>
          </div>
          <div className="p-2 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg text-emerald-600 dark:text-emerald-400">
            <Percent className="w-4 h-4" />
          </div>
        </div>

        {/* Present / Required */}
        <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase block">Plantilla</span>
            <span className="text-xl font-black font-mono text-slate-800 dark:text-white">
              {totalPresent} <span className="text-xs text-slate-400 font-normal">/ {totalRequired}</span>
            </span>
          </div>
          <div className="p-2 bg-blue-50 dark:bg-blue-950/40 rounded-lg text-blue-600 dark:text-blue-400">
            <Users className="w-4 h-4" />
          </div>
        </div>

        {/* Missing Operators */}
        <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase block">Ausentes</span>
            <span className="text-xl font-black font-mono text-[#EF4444]">{missingCount}</span>
          </div>
          <div className="p-2 bg-red-50 dark:bg-red-950/40 rounded-lg text-[#EF4444]">
            <AlertTriangle className="w-4 h-4" />
          </div>
        </div>

        {/* Accumulated Downtime */}
        <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase block">Tiempo Muerto</span>
            <span className="text-xl font-black font-mono text-[#F59E0B]">
              {totalDowntimeToday} <span className="text-xs text-slate-400 font-normal">min</span>
            </span>
          </div>
          <div className="p-2 bg-amber-50 dark:bg-amber-950/40 rounded-lg text-[#F59E0B]">
            <Clock className="w-4 h-4" />
          </div>
        </div>

        {/* Search & Area Filter */}
        <div className="col-span-2 md:col-span-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2 rounded-xl flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar línea..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg pl-8 pr-2 py-1 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:border-slate-400 dark:focus:border-slate-600"
            />
          </div>
          <select
            value={selectedArea}
            onChange={(e) => setSelectedArea(e.target.value)}
            className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1 text-[11px] text-slate-600 dark:text-slate-300 font-bold focus:outline-none cursor-pointer"
          >
            <option value="ALL">Todas</option>
            {areas.map((a: any) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>

      </div>

      {/* 2. COMPACT EXECUTIVE ANDON LINE CARDS (15-20 visible on screen) */}
      <div className="flex-1 min-h-0 w-full overflow-hidden">
        {filteredLines.length > 0 ? (
          <div style={gridStyle} className="pr-1">
            {filteredLines.map((line: any) => {
              const { target, isCoverageActive } = getActiveStaffingTarget(line.id);
              const present = getPresentOperatorsCount(line.id);
              const pct = target > 0 ? Math.round((present / target) * 100) : 0;
              
              // Color rules:
              // AZUL (#3B82F6): Cobertura de comedor activa y cumplimiento correcto
              // VERDE (#22C55E): 100%
              // AMARILLO (#EAB308): 80% a 99%
              // ROJO (#EF4444): Menor a 80%
              let statusColor = '#EF4444'; // Red

              if (isCoverageActive && present >= target) {
                statusColor = '#3B82F6'; // Blue
              } else if (pct >= 100) {
                statusColor = '#22C55E'; // Green
              } else if (pct >= 80) {
                statusColor = '#EAB308'; // Yellow
              }

              return (
                <div 
                  key={line.id} 
                  onClick={() => navigate(`/linea/${line.id}`)}
                  style={{ 
                    borderColor: statusColor,
                    boxShadow: `0 0 10px ${statusColor}15`
                  }}
                  className="bg-white dark:bg-slate-900/90 border-2 hover:border-[3px] hover:shadow-md p-3 rounded-xl transition-all flex items-center justify-between cursor-pointer select-none group min-h-[72px]"
                >
                  {/* Left block: Line Name & Staffing */}
                  <div className="flex flex-col justify-center min-w-0 pr-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span 
                        className="w-2 h-2 rounded-full shrink-0 animate-pulse" 
                        style={{ backgroundColor: statusColor }}
                      />
                      <span className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-100 truncate group-hover:text-emerald-500 transition-colors uppercase tracking-wider">
                        {line.name}
                      </span>
                    </div>

                    <div className="mt-1.5 flex items-baseline gap-1 font-mono">
                      <span className="text-sm font-black text-slate-900 dark:text-white">
                        {present}
                      </span>
                      <span className="text-xs text-slate-400 font-semibold">
                        / {target}
                      </span>
                      {isCoverageActive && (
                        <span className="ml-1 px-1 py-0.5 bg-blue-500/10 text-blue-500 text-[9px] font-sans font-bold rounded flex items-center gap-0.5">
                          <Utensils className="w-2.5 h-2.5" />
                          Comedor
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right block: Circular Gauge compliance */}
                  <CircularGauge percentage={pct} color={statusColor} size={46} />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950 text-slate-400 text-xs italic">
            No se encontraron líneas registradas con los filtros actuales.
          </div>
        )}
      </div>

    </div>
  );
};
