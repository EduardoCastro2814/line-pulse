import React, { useState } from 'react';
import { FileText, Download, FileSpreadsheet, Calendar, Filter, Printer, Layers, ChevronRight, Table } from 'lucide-react';

export const ReportsView: React.FC = () => {
  const [selectedReportType, setSelectedReportType] = useState('daily');
  const [dateRange, setDateRange] = useState({
    start: new Date().toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });
  const [selectedLine, setSelectedLine] = useState('ALL');
  const [selectedShift, setSelectedShift] = useState('ALL');

  const reportOptions = [
    { id: 'daily', title: 'Reporte Diario de Cobertura', desc: 'Resumen detallado de ingresos, ausencias y tiempo muerto por línea.', icon: FileText },
    { id: 'weekly', title: 'Reporte Semanal de Integración', desc: 'Tendencias de cumplimiento y tiempos promedio de completado de plantilla.', icon: Calendar },
    { id: 'monthly', title: 'Reporte Mensual MES & Downtime', desc: 'Indicadores globales de operaciones, paros acumulados y auditoría.', icon: Layers },
    { id: 'scans', title: 'Registro de Escaneos y Asistencia', desc: 'Historial completo de eventos de gafete con estampas de tiempo.', icon: Table }
  ];

  const handleExport = (format: 'pdf' | 'excel') => {
    alert(`Generando reporte en formato ${format.toUpperCase()} para el rango seleccionado...`);
  };

  return (
    <div className="bg-[#F5F7FA] text-slate-800 flex-grow h-full flex flex-col overflow-hidden p-4 space-y-4 select-none font-sans">
      
      {/* 1. TOP REPORT CONTROLS BAR (Microsoft Fabric / Power BI Style) */}
      <div className="bg-white border border-[#DCE3EA] p-4 rounded-2xl flex flex-wrap items-center justify-between gap-4 shadow-sm shrink-0">
        
        {/* Title */}
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-blue-50 text-[#005486] rounded-xl border border-blue-100">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-black text-slate-900 uppercase tracking-wider">Centro de Reportes Operativos</h2>
            <p className="text-xs text-slate-500 font-semibold">Generación y exportación de indicadores clave de producción MES</p>
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

          {/* Line Filter */}
          <div className="flex items-center gap-1 bg-[#F5F7FA] border border-[#DCE3EA] px-3 py-1.5 rounded-xl text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <select
              value={selectedLine}
              onChange={(e) => setSelectedLine(e.target.value)}
              className="bg-transparent text-slate-700 font-bold focus:outline-none cursor-pointer"
            >
              <option value="ALL">Todas las Líneas</option>
              <option value="line-14">Línea 14 (SMT)</option>
              <option value="line-15">Línea 15 (SMT)</option>
              <option value="line-1">Línea 01 (Ensamble)</option>
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
              <option value="shift-1">Turno 1 (Primero)</option>
              <option value="shift-2">Turno 2 (Segundo)</option>
              <option value="shift-3">Turno 3 (Tercero)</option>
            </select>
          </div>

          {/* Export Buttons */}
          <div className="flex items-center gap-2 pl-2 border-l border-[#DCE3EA]">
            <button
              onClick={() => handleExport('excel')}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3.5 py-2 rounded-xl text-xs transition-all shadow-sm cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Exportar Excel</span>
            </button>

            <button
              onClick={() => handleExport('pdf')}
              className="flex items-center gap-1.5 bg-[#005486] hover:bg-[#00426a] text-white font-bold px-3.5 py-2 rounded-xl text-xs transition-all shadow-sm cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Exportar PDF</span>
            </button>
          </div>

        </div>

      </div>

      {/* 2. REPORT SELECTION CARDS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 shrink-0">
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
                  <ChevronRight className={`w-4 h-4 ${isSelected ? 'text-[#005486]' : 'text-slate-300'}`} />
                </div>
                <h3 className="text-sm font-black text-slate-900 mb-1">{rep.title}</h3>
                <p className="text-xs text-slate-500 font-semibold leading-relaxed">{rep.desc}</p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold">
                <span className={isSelected ? 'text-[#005486]' : 'text-slate-400'}>
                  {isSelected ? 'Seleccionado' : 'Hacer clic para activar'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* 3. REPORT PREVIEW PLACEHOLDER CANVAS (Power BI Report Frame Style) */}
      <div className="flex-1 min-h-0 bg-white border border-[#DCE3EA] rounded-2xl p-6 flex flex-col shadow-sm overflow-hidden">
        
        {/* Report Frame Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#DCE3EA] shrink-0">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Vista Previa de Informe</span>
            <h3 className="text-lg font-black text-slate-900 font-mono">
              {reportOptions.find(r => r.id === selectedReportType)?.title}
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold font-mono">
              Rango: {dateRange.start} al {dateRange.end}
            </span>
            <button
              onClick={() => window.print()}
              className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all cursor-pointer border border-[#DCE3EA]"
              title="Imprimir Vista Previa"
            >
              <Printer className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Structured Data Preview Table Placeholder */}
        <div className="flex-1 min-h-0 overflow-y-auto mt-4 border border-[#DCE3EA] rounded-xl">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-[#F5F7FA] border-b border-[#DCE3EA] sticky top-0">
              <tr className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wider">
                <th className="py-3 px-4">Fecha / Hora</th>
                <th className="py-3 px-4">Línea de Producción</th>
                <th className="py-3 px-4">Turno</th>
                <th className="py-3 px-4">Meta Requerida</th>
                <th className="py-3 px-4">Plantilla Presente</th>
                <th className="py-3 px-4">Cumplimiento %</th>
                <th className="py-3 px-4">Tiempo Muerto (min)</th>
                <th className="py-3 px-4">Estado Operativo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DCE3EA] font-mono">
              <tr className="hover:bg-slate-50">
                <td className="py-3 px-4 text-slate-600 font-sans">2026-07-20 06:00:00</td>
                <td className="py-3 px-4 font-bold text-slate-900 font-sans">Línea 14</td>
                <td className="py-3 px-4 text-slate-700 font-sans">Turno 1 (Primero)</td>
                <td className="py-3 px-4 text-slate-800">6</td>
                <td className="py-3 px-4 font-bold text-[#005486]">6</td>
                <td className="py-3 px-4 font-bold text-emerald-600">100%</td>
                <td className="py-3 px-4 text-slate-600">0 min</td>
                <td className="py-3 px-4 font-sans">
                  <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-[10px] font-bold">
                    PLANTILLA COMPLETA
                  </span>
                </td>
              </tr>

              <tr className="hover:bg-slate-50">
                <td className="py-3 px-4 text-slate-600 font-sans">2026-07-20 06:00:00</td>
                <td className="py-3 px-4 font-bold text-slate-900 font-sans">Línea 15</td>
                <td className="py-3 px-4 text-slate-700 font-sans">Turno 1 (Primero)</td>
                <td className="py-3 px-4 text-slate-800">5</td>
                <td className="py-3 px-4 font-bold text-slate-900">4</td>
                <td className="py-3 px-4 font-bold text-amber-600">80%</td>
                <td className="py-3 px-4 text-amber-600 font-bold">8 min</td>
                <td className="py-3 px-4 font-sans">
                  <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded text-[10px] font-bold">
                    FALTA PERSONAL
                  </span>
                </td>
              </tr>

              <tr className="hover:bg-slate-50">
                <td className="py-3 px-4 text-slate-600 font-sans">2026-07-20 06:00:00</td>
                <td className="py-3 px-4 font-bold text-slate-900 font-sans">Línea 01</td>
                <td className="py-3 px-4 text-slate-700 font-sans">Turno 1 (Primero)</td>
                <td className="py-3 px-4 text-slate-800">8</td>
                <td className="py-3 px-4 font-bold text-red-600">6</td>
                <td className="py-3 px-4 font-bold text-red-600">75%</td>
                <td className="py-3 px-4 text-red-600 font-bold">25 min</td>
                <td className="py-3 px-4 font-sans">
                  <span className="px-2 py-0.5 bg-red-50 text-red-700 border border-red-200 rounded text-[10px] font-bold">
                    CRÍTICO
                  </span>
                </td>
              </tr>

              <tr className="hover:bg-slate-50">
                <td className="py-3 px-4 text-slate-600 font-sans">2026-07-20 12:00:00</td>
                <td className="py-3 px-4 font-bold text-slate-900 font-sans">Línea 14</td>
                <td className="py-3 px-4 text-slate-700 font-sans">Turno 1 (Comedor)</td>
                <td className="py-3 px-4 text-slate-800">3</td>
                <td className="py-3 px-4 font-bold text-blue-600">3</td>
                <td className="py-3 px-4 font-bold text-blue-600">100%</td>
                <td className="py-3 px-4 text-slate-600">0 min</td>
                <td className="py-3 px-4 font-sans">
                  <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded text-[10px] font-bold">
                    COBERTURA COMEDOR
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

      </div>

    </div>
  );
};
