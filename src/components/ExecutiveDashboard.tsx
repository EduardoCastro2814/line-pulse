import React, { useEffect, useState } from 'react';
import { supabase, getActiveStaffingTarget } from '../lib/supabaseClient';
import { Users, AlertTriangle, Clock, Percent, Search, Utensils, ChevronRight } from 'lucide-react';
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

    const channel = supabase.channel('exec-dashboard-list-changes')
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

  return (
    <div className="bg-white text-slate-800 border border-[#DCE3EA] rounded-2xl flex-grow h-full flex flex-col overflow-hidden p-4 space-y-4 shadow-sm select-none">
      
      {/* 1. CORPORATE SUMMARY KPI BAR */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 shrink-0">
        
        {/* Coverage % */}
        <div className="bg-[#F5F7FA] border border-[#DCE3EA] p-3 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-500 tracking-wider uppercase block">Cobertura Global</span>
            <span className="text-xl font-black font-mono text-[#005486]">{globalCoveragePct}%</span>
          </div>
          <div className="p-2 bg-blue-50 rounded-lg text-[#005486]">
            <Percent className="w-4 h-4" />
          </div>
        </div>

        {/* Present / Required */}
        <div className="bg-[#F5F7FA] border border-[#DCE3EA] p-3 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-500 tracking-wider uppercase block">Plantilla</span>
            <span className="text-xl font-black font-mono text-slate-900">
              {totalPresent} <span className="text-xs text-slate-500 font-normal">/ {totalRequired}</span>
            </span>
          </div>
          <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
            <Users className="w-4 h-4" />
          </div>
        </div>

        {/* Missing Operators */}
        <div className="bg-[#F5F7FA] border border-[#DCE3EA] p-3 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-500 tracking-wider uppercase block">Ausentes</span>
            <span className="text-xl font-black font-mono text-[#EF4444]">{missingCount}</span>
          </div>
          <div className="p-2 bg-red-50 rounded-lg text-[#EF4444]">
            <AlertTriangle className="w-4 h-4" />
          </div>
        </div>

        {/* Accumulated Downtime */}
        <div className="bg-[#F5F7FA] border border-[#DCE3EA] p-3 rounded-xl flex items-center justify-between">
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

        {/* Search & Area Filter */}
        <div className="col-span-2 md:col-span-1 bg-[#F5F7FA] border border-[#DCE3EA] p-2 rounded-xl flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar línea..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-[#DCE3EA] rounded-lg pl-8 pr-2 py-1 text-xs text-slate-800 focus:outline-none focus:border-[#005486]"
            />
          </div>
          <select
            value={selectedArea}
            onChange={(e) => setSelectedArea(e.target.value)}
            className="bg-white border border-[#DCE3EA] rounded-lg px-2 py-1 text-[11px] text-slate-700 font-bold focus:outline-none cursor-pointer"
          >
            <option value="ALL">Todas</option>
            {areas.map((a: any) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>

      </div>

      {/* 2. CORPORATE LIST TABLE (UKG Workforce / SharePoint Lists Style) */}
      <div className="flex-1 min-h-0 w-full overflow-hidden border border-[#DCE3EA] rounded-xl bg-white flex flex-col">
        {filteredLines.length > 0 ? (
          <div className="w-full h-full overflow-y-auto">
            <table className="w-full text-left border-collapse">
              {/* Table Header */}
              <thead className="bg-[#F5F7FA] border-b border-[#DCE3EA] sticky top-0 z-10">
                <tr className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wider">
                  <th className="py-3 px-4 w-16 text-center">Estado</th>
                  <th className="py-3 px-4">Nombre Línea</th>
                  <th className="py-3 px-4">Cobertura %</th>
                  <th className="py-3 px-4">Personal</th>
                  <th className="py-3 px-4">Tiempo Muerto</th>
                  <th className="py-3 px-4">Turno</th>
                  <th className="py-3 px-4 w-12 text-right"></th>
                </tr>
              </thead>

              {/* Table Rows */}
              <tbody className="divide-y divide-[#DCE3EA] text-xs">
                {filteredLines.map((line: any) => {
                  const { target, isCoverageActive, activeShiftName } = getActiveStaffingTarget(line.id);
                  const present = getPresentOperatorsCount(line.id);
                  const pct = target > 0 ? Math.round((present / target) * 100) : 0;
                  const activeDtMin = getActiveDowntimeMinutes(line.id);

                  // Color Status Rules:
                  // 🟢 VERDE (#22C55E): 100%
                  // 🟡 AMARILLO (#EAB308): 80% - 99%
                  // 🔴 ROJO (#EF4444): < 80%
                  // 🔵 AZUL (#3B82F6): Cobertura de Comedor Activa (cumpliendo meta)
                  let statusColor = '#EF4444';
                  let statusEmoji = '🔴';

                  if (isCoverageActive && present >= target) {
                    statusColor = '#3B82F6';
                    statusEmoji = '🔵';
                  } else if (pct >= 100) {
                    statusColor = '#22C55E';
                    statusEmoji = '🟢';
                  } else if (pct >= 80) {
                    statusColor = '#EAB308';
                    statusEmoji = '🟡';
                  }

                  return (
                    <tr 
                      key={line.id}
                      onClick={() => navigate(`/linea/${line.id}`)}
                      className="hover:bg-[#F5F7FA] transition-colors cursor-pointer group"
                    >
                      {/* Estado Dot/Icon */}
                      <td className="py-3 px-4 text-center">
                        <span className="text-base select-none">{statusEmoji}</span>
                      </td>

                      {/* Nombre Línea */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-slate-900 group-hover:text-[#005486] transition-colors text-sm font-sans">
                            {line.name}
                          </span>
                          {isCoverageActive && (
                            <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold rounded flex items-center gap-1">
                              <Utensils className="w-2.5 h-2.5" />
                              Comedor
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Cobertura % + Inline Progress Bar */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3 max-w-[160px]">
                          <span className="font-mono font-black text-sm w-11" style={{ color: statusColor }}>
                            {pct}%
                          </span>
                          <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                            <div 
                              className="h-full transition-all duration-500 rounded-full" 
                              style={{ width: `${Math.min(100, pct)}%`, backgroundColor: statusColor }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Personal (Present / Target) */}
                      <td className="py-3 px-4">
                        <span className="font-mono font-bold text-slate-800 text-sm">
                          {present} <span className="text-slate-400 font-normal text-xs">/ {target}</span>
                        </span>
                      </td>

                      {/* Tiempo Muerto */}
                      <td className="py-3 px-4 font-mono font-semibold">
                        {activeDtMin > 0 ? (
                          <span className="text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            {activeDtMin} min
                          </span>
                        ) : (
                          <span className="text-slate-400">0 min</span>
                        )}
                      </td>

                      {/* Turno */}
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-700 font-semibold text-[11px]">
                          {activeShiftName}
                        </span>
                      </td>

                      {/* Chevron Action */}
                      <td className="py-3 px-4 text-right">
                        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-[#005486] transition-colors inline-block" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 text-xs italic">
            No se encontraron líneas registradas con los filtros actuales.
          </div>
        )}
      </div>

    </div>
  );
};
