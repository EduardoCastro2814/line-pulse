import React, { useEffect, useState } from 'react';
import { supabase, getActiveStaffingTarget } from '../lib/supabaseClient';
import { Users, AlertTriangle, Clock, Percent, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

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

  // CSS Grid style to fit 12-20 lines nicely at 100% zoom
  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(clamp(150px, 14vw, 200px), 1fr))',
    gridAutoRows: 'clamp(58px, 8vh, 76px)',
    gap: 'clamp(8px, 1.2vh, 12px)',
    height: '100%',
    width: '100%',
    overflowY: 'auto' as const,
    alignContent: 'start'
  };

  return (
    <div className="bg-white text-slate-800 border border-slate-200 rounded-2xl flex-grow h-full flex flex-col overflow-hidden p-4 space-y-4 shadow-sm select-none">
      
      {/* 1. COMPACT EXECUTIVE SUMMARY BAR (Power BI Style) */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 shrink-0">
        
        {/* Coverage % */}
        <div className="bg-slate-50 border border-slate-200/80 p-3 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase block">Cobertura Global</span>
            <span className="text-xl font-black font-mono text-slate-800">{globalCoveragePct}%</span>
          </div>
          <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
            <Percent className="w-4 h-4" />
          </div>
        </div>

        {/* Present / Required */}
        <div className="bg-slate-50 border border-slate-200/80 p-3 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase block">Plantilla</span>
            <span className="text-xl font-black font-mono text-slate-800">
              {totalPresent} <span className="text-xs text-slate-400 font-normal">/ {totalRequired}</span>
            </span>
          </div>
          <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
            <Users className="w-4 h-4" />
          </div>
        </div>

        {/* Missing Operators */}
        <div className="bg-slate-50 border border-slate-200/80 p-3 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase block">Ausentes</span>
            <span className="text-xl font-black font-mono text-[#EF4444]">{missingCount}</span>
          </div>
          <div className="p-2 bg-red-50 rounded-lg text-[#EF4444]">
            <AlertTriangle className="w-4 h-4" />
          </div>
        </div>

        {/* Accumulated Downtime */}
        <div className="bg-slate-50 border border-slate-200/80 p-3 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase block">Tiempo Muerto</span>
            <span className="text-xl font-black font-mono text-[#F59E0B]">
              {totalDowntimeToday} <span className="text-xs text-slate-400 font-normal">min</span>
            </span>
          </div>
          <div className="p-2 bg-amber-50 rounded-lg text-[#F59E0B]">
            <Clock className="w-4 h-4" />
          </div>
        </div>

        {/* Filters Panel integrated */}
        <div className="col-span-2 md:col-span-1 bg-slate-50 border border-slate-200 p-2 rounded-xl flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg pl-8 pr-2 py-1 text-xs text-slate-700 focus:outline-none focus:border-slate-400"
            />
          </div>
          <div className="relative">
            <select
              value={selectedArea}
              onChange={(e) => setSelectedArea(e.target.value)}
              className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-[11px] text-slate-600 font-bold focus:outline-none cursor-pointer"
            >
              <option value="ALL">Área</option>
              {areas.map((a: any) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
        </div>

      </div>

      {/* 2. MAIN GRID OF PRODUCTION LINES (Scroll-free stretch grid) */}
      <div className="flex-1 min-h-0 w-full overflow-hidden">
        {filteredLines.length > 0 ? (
          <div style={gridStyle}>
            {filteredLines.map((line: any) => {
              const { target, isCoverageActive } = getActiveStaffingTarget(line.id);
              const present = getPresentOperatorsCount(line.id);
              const pct = target > 0 ? Math.round((present / target) * 100) : 0;
              
              let statusColor = '#EF4444'; // Red
              
              if (isCoverageActive) {
                statusColor = '#3B82F6'; // Blue (lunch coverage)
              } else if (pct >= 100) {
                statusColor = '#22C55E'; // Green
              } else if (pct >= 80) {
                statusColor = '#F59E0B'; // Yellow
              }

              return (
                <div 
                  key={line.id} 
                  onClick={() => navigate(`/linea/${line.id}`)}
                  className="bg-white border border-slate-200 hover:border-slate-350 hover:shadow-md px-3.5 py-2.5 rounded-xl transition-all flex items-center justify-between cursor-pointer overflow-hidden min-w-0"
                >
                  {/* Left block (LED + Name, and operators) */}
                  <div className="flex flex-col justify-center min-w-0 pr-1 h-full">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {/* Indicator visual (LED) */}
                      <span 
                        className="w-2.5 h-2.5 rounded-full shrink-0 animate-pulse" 
                        style={{ 
                          backgroundColor: statusColor,
                          boxShadow: `0 0 8px ${statusColor}`
                        }}
                      />
                      <span className="text-[clamp(0.8rem,1.2vh,1rem)] font-extrabold text-slate-800 truncate leading-none">
                        {line.name}
                      </span>
                    </div>
                    <span className="text-[clamp(0.7rem,1vh,0.85rem)] text-slate-500 font-mono font-bold mt-1.5 block leading-none">
                      {present} <span className="text-slate-400 font-normal">/ {target}</span>
                    </span>
                  </div>

                  {/* Right block (Coverage percentage) */}
                  <div className="text-right shrink-0">
                    <span 
                      className="text-[clamp(0.95rem,1.4vh,1.25rem)] font-black font-mono leading-none"
                      style={{ color: statusColor }}
                    >
                      {pct}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center border border-dashed border-slate-200 rounded-xl bg-slate-50 text-slate-400 text-xs italic">
            No se encontraron líneas registradas con los filtros actuales.
          </div>
        )}
      </div>

    </div>
  );
};

