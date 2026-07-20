import React, { useState, useEffect } from 'react';
import { 
  FileText, Download, Calendar, Filter, Printer, Table, Trash2, RefreshCw, Clock
} from 'lucide-react';
import { supabase, getLineIntegrationTimeMinutes, calculateLineMetrics } from '../lib/supabaseClient';

export const ReportsView: React.FC = () => {
  const [selectedReportType, setSelectedReportType] = useState<'scans' | 'downtime'>('scans');
  
  // Filters state
  const [dateRange, setDateRange] = useState({
    start: new Date().toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });
  const [selectedLine, setSelectedLine] = useState('ALL');
  const [selectedArea, setSelectedArea] = useState('ALL');
  const [selectedShift, setSelectedShift] = useState('ALL');

  // Supabase Data State
  const [lines, setLines] = useState<any[]>([]);
  const [areas, setAreas] = useState<any[]>([]);
  const [scans, setScans] = useState<any[]>([]);
  const [downtimes, setDowntimes] = useState<any[]>([]);
  const [posiciones, setPosiciones] = useState<any[]>([]);
  const [coverages, setCoverages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  // Load all foundational data
  const loadReportData = async () => {
    setLoading(true);
    try {
      const [resLines, resAreas, resScans, resDowntimes, resPos, resCov] = await Promise.all([
        supabase.from('lineas').select('*').order('name'),
        supabase.from('areas').select('*').order('name'),
        supabase.from('escaneos').select('*, lineas(id, name, area_id)').order('scan_time', { ascending: false }),
        supabase.from('tiempos_muertos').select('*, lineas(id, name)').order('start_time', { ascending: false }),
        supabase.from('posiciones').select('*'),
        supabase.from('coberturas').select('*')
      ]);

      if (resLines.data) setLines(resLines.data);
      if (resAreas.data) setAreas(resAreas.data);
      if (resScans.data) setScans(resScans.data);
      if (resDowntimes.data) setDowntimes(resDowntimes.data);
      if (resPos.data) setPosiciones(resPos.data);
      if (resCov.data) setCoverages(resCov.data);
    } catch (err) {
      console.error('Error al cargar datos de reportes:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReportData();
  }, []);

  const reportOptions = [
    { 
      id: 'scans' as const, 
      title: 'Escaneos y Asistencia', 
      desc: 'Historial completo de eventos de gafete con timestamps, líneas, áreas y turnos.', 
      icon: Table 
    },
    { 
      id: 'downtime' as const, 
      title: 'Reporte de Downtime', 
      desc: 'Análisis detallado de tiempos muertos, minutos de integración de plantilla y cobertura por línea.', 
      icon: Clock 
    }
  ];

  // Helper filter scans
  const getFilteredScans = () => {
    return scans.filter(s => {
      // Date filter
      const scanDate = new Date(s.scan_time || s.created_at || s.event_time || 0);
      if (isNaN(scanDate.getTime())) return false;
      const dateIso = scanDate.toISOString().split('T')[0];
      if (dateIso < dateRange.start || dateIso > dateRange.end) return false;

      // Line filter
      if (selectedLine !== 'ALL' && s.line_id !== selectedLine) return false;

      // Area filter
      if (selectedArea !== 'ALL') {
        const lineObj = lines.find(l => l.id === s.line_id);
        if (!lineObj || lineObj.area_id !== selectedArea) return false;
      }

      // Shift filter
      if (selectedShift !== 'ALL') {
        const scanShift = s.shift || '';
        if (!scanShift.toLowerCase().includes(selectedShift.toLowerCase())) return false;
      }

      return true;
    });
  };

  // Helper filter downtime rows per line
  const getFilteredDowntimeRows = () => {
    return lines.filter(line => {
      if (selectedLine !== 'ALL' && line.id !== selectedLine) return false;
      if (selectedArea !== 'ALL' && line.area_id !== selectedArea) return false;
      return true;
    }).map(line => {
      const lineDts = downtimes.filter(d => {
        if (d.line_id !== line.id) return false;
        if (d.date < dateRange.start || d.date > dateRange.end) return false;
        return true;
      });

      const totalDowntimeMin = lineDts.reduce((sum, d) => sum + (d.duration_minutes || 0), 0);
      const integrationMin = getLineIntegrationTimeMinutes(line, scans);
      const metrics = calculateLineMetrics(line.id, posiciones, scans, coverages);

      return {
        lineId: line.id,
        lineName: line.name,
        areaName: areas.find(a => a.id === line.area_id)?.name || 'SMT',
        shiftName: selectedShift !== 'ALL' ? selectedShift : 'Turno Activo',
        downtimeMin: totalDowntimeMin,
        integrationMin: integrationMin,
        coveragePct: metrics.coveragePct,
        target: metrics.target,
        scannedCount: metrics.scannedCount
      };
    });
  };

  // Single record deletion
  const handleDeleteSingleScan = async (id: string) => {
    if (!window.confirm('¿Está seguro de eliminar este registro de escaneo?')) return;
    const { error } = await supabase.from('escaneos').delete().eq('id', id);
    if (error) {
      alert(`Error al eliminar registro: ${error.message}`);
    } else {
      setActionFeedback('Registro eliminado con éxito.');
      setTimeout(() => setActionFeedback(null), 3000);
      loadReportData();
    }
  };

  // Bulk deletion for current filter
  const handleDeleteAllFilteredScans = async () => {
    const filtered = getFilteredScans();
    if (filtered.length === 0) {
      alert('No hay registros visibles para eliminar.');
      return;
    }

    if (!window.confirm(`⚠️ ¿Está seguro de eliminar PERMANENTEMENTE los ${filtered.length} registros que coinciden con los filtros actuales?`)) {
      return;
    }

    const idsToDelete = filtered.map(s => s.id);
    const { error } = await supabase.from('escaneos').delete().in('id', idsToDelete);
    if (error) {
      alert(`Error al eliminar registros: ${error.message}`);
    } else {
      setActionFeedback(`Se eliminaron ${filtered.length} registros correctamente.`);
      setTimeout(() => setActionFeedback(null), 3000);
      loadReportData();
    }
  };

  // CSV Export for Scans & Attendance
  const exportScansCSV = () => {
    const filtered = getFilteredScans();
    if (filtered.length === 0) {
      alert('No hay datos para exportar con los filtros seleccionados.');
      return;
    }

    const headers = ['Número empleado', 'Línea', 'Fecha', 'Hora', 'Turno', 'Tipo Evento'];
    const rows = filtered.map(s => {
      const dt = new Date(s.scan_time || s.created_at || s.event_time);
      const dateStr = !isNaN(dt.getTime()) ? dt.toISOString().split('T')[0] : '';
      const timeStr = !isNaN(dt.getTime()) ? dt.toLocaleTimeString('es-MX', { hour12: false }) : '';
      const lineName = s.lineas?.name || lines.find(l => l.id === s.line_id)?.name || 'N/A';
      return [
        `"${s.employee_number || s.badge_id || ''}"`,
        `"${lineName}"`,
        `"${dateStr}"`,
        `"${timeStr}"`,
        `"${s.shift || 'Turno 1'}"`,
        `"${s.event_type || 'TURN_START'}"`
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `escaneos_asistencia_${dateRange.start}_a_${dateRange.end}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // CSV Export for Downtime
  const exportDowntimeCSV = () => {
    const rowsData = getFilteredDowntimeRows();
    if (rowsData.length === 0) {
      alert('No hay datos de downtime para exportar.');
      return;
    }

    const headers = ['Línea', 'Área', 'Turno', 'Tiempo Muerto (min)', 'Tiempo Integración (min)', 'Cobertura Final %', 'Plantilla Requerida', 'Escaneados'];
    const rows = rowsData.map(r => [
      `"${r.lineName}"`,
      `"${r.areaName}"`,
      `"${r.shiftName}"`,
      r.downtimeMin,
      r.integrationMin,
      `"${r.coveragePct}%"`,
      r.target,
      r.scannedCount
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `reporte_downtime_${dateRange.start}_a_${dateRange.end}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredScansList = getFilteredScans();
  const filteredDowntimeList = getFilteredDowntimeRows();

  return (
    <div className="bg-[#F5F7FA] text-slate-800 flex-grow h-full flex flex-col overflow-hidden p-4 space-y-4 select-none font-sans">
      
      {/* 1. TOP REPORT CONTROLS & FILTERS BAR */}
      <div className="bg-white border border-[#DCE3EA] p-4 rounded-2xl flex flex-wrap items-center justify-between gap-4 shadow-sm shrink-0">
        
        {/* Title */}
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-blue-50 text-[#005486] rounded-xl border border-blue-100">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-black text-slate-900 uppercase tracking-wider">Centro de Reportes Operativos</h2>
            <p className="text-xs text-slate-500 font-semibold">Consulta histórica, auditoría y exportación de datos MES desde Supabase</p>
          </div>
        </div>

        {/* Global Filters & Export Actions */}
        <div className="flex items-center flex-wrap gap-3">
          
          {/* Date range picker */}
          <div className="flex items-center gap-1.5 bg-[#F5F7FA] border border-[#DCE3EA] px-3 py-1.5 rounded-xl text-xs">
            <Calendar className="w-4 h-4 text-slate-500" />
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              className="bg-transparent text-slate-700 font-bold focus:outline-none cursor-pointer"
            />
            <span className="text-slate-400 font-mono">-</span>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              className="bg-transparent text-slate-700 font-bold focus:outline-none cursor-pointer"
            />
          </div>

          {/* Area Filter */}
          <div className="flex items-center gap-1 bg-[#F5F7FA] border border-[#DCE3EA] px-3 py-1.5 rounded-xl text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <select
              value={selectedArea}
              onChange={(e) => setSelectedArea(e.target.value)}
              className="bg-transparent text-slate-700 font-bold focus:outline-none cursor-pointer"
            >
              <option value="ALL">Todas las Áreas</option>
              {areas.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>

          {/* Line Filter */}
          <div className="flex items-center gap-1 bg-[#F5F7FA] border border-[#DCE3EA] px-3 py-1.5 rounded-xl text-xs">
            <select
              value={selectedLine}
              onChange={(e) => setSelectedLine(e.target.value)}
              className="bg-transparent text-slate-700 font-bold focus:outline-none cursor-pointer"
            >
              <option value="ALL">Todas las Líneas</option>
              {lines.map(l => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>

          {/* Shift Filter */}
          <div className="flex items-center gap-1 bg-[#F5F7FA] border border-[#DCE3EA] px-3 py-1.5 rounded-xl text-xs">
            <select
              value={selectedShift}
              onChange={(e) => setSelectedShift(e.target.value)}
              className="bg-transparent text-slate-700 font-bold focus:outline-none cursor-pointer"
            >
              <option value="ALL">Todos los Turnos</option>
              <option value="Turno 1">Turno 1</option>
              <option value="Turno 2">Turno 2</option>
              <option value="Turno 3">Turno 3</option>
            </select>
          </div>

          <button
            onClick={loadReportData}
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all cursor-pointer border border-[#DCE3EA]"
            title="Recargar datos"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#005486]' : ''}`} />
          </button>

        </div>

      </div>

      {/* 2. REPORT TYPE SELECTION CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 shrink-0">
        {reportOptions.map((rep) => {
          const IconComp = rep.icon;
          const isSelected = selectedReportType === rep.id;

          return (
            <div
              key={rep.id}
              onClick={() => setSelectedReportType(rep.id)}
              className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between select-none ${
                isSelected
                  ? 'bg-white border-[#005486] shadow-md'
                  : 'bg-white border-[#DCE3EA] hover:border-slate-300 hover:shadow-sm'
              }`}
            >
              <div>
                <div className="flex justify-between items-start mb-2">
                  <div className={`p-2 rounded-xl ${isSelected ? 'bg-blue-50 text-[#005486]' : 'bg-slate-100 text-slate-600'}`}>
                    <IconComp className="w-5 h-5" />
                  </div>
                  <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${isSelected ? 'bg-[#005486] text-white' : 'bg-slate-100 text-slate-500'}`}>
                    {isSelected ? 'ACTIVO' : 'SELECCIONAR'}
                  </span>
                </div>
                <h3 className="text-sm font-black text-slate-900 mb-1">{rep.title}</h3>
                <p className="text-xs text-slate-500 font-semibold leading-relaxed">{rep.desc}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Feedback message banner */}
      {actionFeedback && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold animate-in fade-in shrink-0">
          {actionFeedback}
        </div>
      )}

      {/* 3. REPORT PREVIEW AND TABLE CANVAS */}
      <div className="flex-1 min-h-0 bg-white border border-[#DCE3EA] rounded-2xl p-5 flex flex-col shadow-sm overflow-hidden">
        
        {/* Report Canvas Header */}
        <div className="flex flex-wrap items-center justify-between pb-3 border-b border-[#DCE3EA] gap-3 shrink-0">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Informe Histórico en Vivo</span>
            <h3 className="text-lg font-black text-slate-900 font-mono">
              {selectedReportType === 'scans' ? 'Escaneos y Asistencia' : 'Reporte de Downtime'}
            </h3>
          </div>

          <div className="flex items-center gap-3">
            {/* CSV Export Button */}
            <button
              onClick={selectedReportType === 'scans' ? exportScansCSV : exportDowntimeCSV}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold px-4 py-2 rounded-xl text-xs transition-all shadow-sm cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Exportar CSV</span>
            </button>

            {/* Borrar Todo Button for Scans */}
            {selectedReportType === 'scans' && (
              <button
                onClick={handleDeleteAllFilteredScans}
                className="flex items-center gap-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-extrabold px-3 py-2 rounded-xl text-xs transition-all shadow-sm cursor-pointer"
                title="Eliminar todos los registros que coincidan con los filtros actuales"
              >
                <Trash2 className="w-4 h-4 text-red-600" />
                <span>Borrar Todo</span>
              </button>
            )}

            <button
              onClick={() => window.print()}
              className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all cursor-pointer border border-[#DCE3EA]"
              title="Imprimir"
            >
              <Printer className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* DATA TABLE VIEWPORT */}
        <div className="flex-1 min-h-0 overflow-y-auto mt-3 border border-[#DCE3EA] rounded-xl">
          
          {selectedReportType === 'scans' ? (
            
            /* TABLA 1: ESCANEOS Y ASISTENCIA */
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-[#F5F7FA] border-b border-[#DCE3EA] sticky top-0 z-10 text-[10px] font-black uppercase text-slate-600 tracking-wider">
                <tr>
                  <th className="py-2.5 px-4">Número Empleado</th>
                  <th className="py-2.5 px-4">Fecha</th>
                  <th className="py-2.5 px-4">Hora</th>
                  <th className="py-2.5 px-4">Turno</th>
                  <th className="py-2.5 px-4">Línea</th>
                  <th className="py-2.5 px-4">Área</th>
                  <th className="py-2.5 px-4">Tipo Evento</th>
                  <th className="py-2.5 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DCE3EA] font-mono">
                {filteredScansList.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400 font-sans font-semibold">
                      No se encontraron registros de escaneo para el filtro y rango de fechas seleccionados.
                    </td>
                  </tr>
                ) : (
                  filteredScansList.map((scan) => {
                    const dt = new Date(scan.scan_time || scan.created_at || scan.event_time);
                    const isValid = !isNaN(dt.getTime());
                    const dateStr = isValid ? dt.toISOString().split('T')[0] : scan.scan_date || 'N/A';
                    const timeStr = isValid ? dt.toLocaleTimeString('es-MX', { hour12: false }) : scan.scan_time || 'N/A';
                    const lineObj = lines.find(l => l.id === scan.line_id);
                    const areaObj = areas.find(a => a.id === (scan.lineas?.area_id || lineObj?.area_id));

                    return (
                      <tr key={scan.id} className="hover:bg-[#F5F7FA] transition-colors">
                        <td className="py-2.5 px-4 font-black text-[#005486]">
                          {scan.employee_number || scan.badge_id || 'N/A'}
                        </td>
                        <td className="py-2.5 px-4 text-slate-700">{dateStr}</td>
                        <td className="py-2.5 px-4 text-slate-900 font-bold">{timeStr}</td>
                        <td className="py-2.5 px-4 text-slate-700 font-sans font-bold">{scan.shift || 'Turno 1'}</td>
                        <td className="py-2.5 px-4 font-sans font-black text-slate-900">{scan.lineas?.name || lineObj?.name || 'N/A'}</td>
                        <td className="py-2.5 px-4 font-sans text-slate-600 font-bold">{areaObj?.name || 'SMT'}</td>
                        <td className="py-2.5 px-4 font-sans">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                            scan.event_type === 'MEAL_COVERAGE' ? 'bg-blue-100 text-blue-700 border border-blue-200' : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                          }`}>
                            {scan.event_type || 'TURN_START'}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <button
                            onClick={() => handleDeleteSingleScan(scan.id)}
                            className="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-lg text-[11px] font-bold cursor-pointer transition-all inline-flex items-center gap-1 font-sans"
                            title="Eliminar este registro"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Eliminar</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>

          ) : (

            /* TABLA 2: REPORTE DE DOWNTIME */
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-[#F5F7FA] border-b border-[#DCE3EA] sticky top-0 z-10 text-[10px] font-black uppercase text-slate-600 tracking-wider">
                <tr>
                  <th className="py-2.5 px-4">Línea</th>
                  <th className="py-2.5 px-4">Área</th>
                  <th className="py-2.5 px-4">Turno</th>
                  <th className="py-2.5 px-4">Tiempo Muerto (min)</th>
                  <th className="py-2.5 px-4">Tiempo Integración (min)</th>
                  <th className="py-2.5 px-4">Cobertura Final</th>
                  <th className="py-2.5 px-4">Plantilla Requerida</th>
                  <th className="py-2.5 px-4">Escaneados Presentes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DCE3EA] font-mono">
                {filteredDowntimeList.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400 font-sans font-semibold">
                      No hay líneas configuradas o datos disponibles para los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  filteredDowntimeList.map((row) => (
                    <tr key={row.lineId} className="hover:bg-[#F5F7FA] transition-colors">
                      <td className="py-3 px-4 font-sans font-black text-slate-900">{row.lineName}</td>
                      <td className="py-3 px-4 font-sans text-slate-600 font-bold">{row.areaName}</td>
                      <td className="py-3 px-4 font-sans text-slate-700 font-bold">{row.shiftName}</td>
                      <td className="py-3 px-4 text-amber-600 font-bold">{row.downtimeMin} min</td>
                      <td className="py-3 px-4 text-emerald-600 font-bold">{row.integrationMin} min</td>
                      <td className="py-3 px-4">
                        <span className={`font-bold ${row.coveragePct >= 100 ? 'text-emerald-600' : row.coveragePct >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                          {row.coveragePct}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-900 font-bold">{row.target} op</td>
                      <td className="py-3 px-4 text-[#005486] font-bold">{row.scannedCount} op</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

          )}

        </div>

      </div>

    </div>
  );
};
