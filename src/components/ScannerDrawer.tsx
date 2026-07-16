import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { X, QrCode, ClipboardList, CheckCircle, XCircle } from 'lucide-react';

interface ScannerDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ScannerDrawer: React.FC<ScannerDrawerProps> = ({ isOpen, onClose }) => {
  const [badgeInput, setBadgeInput] = useState('');
  const [eventType, setEventType] = useState('shift_start');
  const [selectedLine, setSelectedLine] = useState('');
  const [recentScans, setRecentScans] = useState<any[]>([]);

  // Simulation states
  const [employeesList, setEmployeesList] = useState<any[]>([]);
  const [lines, setLines] = useState<any[]>([]);
  
  // Alert banner feedback
  const [feedback, setFeedback] = useState<{
    status: 'success' | 'error' | null;
    message: string;
    employeeName?: string;
  }>({ status: null, message: '' });

  const inputRef = useRef<HTMLInputElement>(null);

  const loadData = async () => {
    const { data: empData } = await supabase.from('empleados').select('*');
    const { data: linesData } = await supabase.from('lineas').select('*');
    const { data: scansData } = await supabase.from('escaneos')
      .select('*, linea:lineas(*)')
      .order('event_time', { ascending: false });

    if (empData) setEmployeesList(empData);
    if (linesData) {
      setLines(linesData);
      if (linesData.length > 0 && !selectedLine) {
        setSelectedLine(linesData[0].id);
      }
    }
    if (scansData) setRecentScans(scansData.slice(0, 8));
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
      // Auto-focus barcode input
      setTimeout(() => inputRef.current?.focus(), 250);
    }
  }, [isOpen]);

  // Audio feedback synthesizer
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

  const handleScan = async (badgeId: string) => {
    if (!badgeId.trim() || !selectedLine) return;

    const emp = employeesList.find(e => e.badge_id.trim() === badgeId.trim());

    const { data: scanResult, error } = await supabase.from('escaneos').insert({
      badge_id: badgeId.trim(),
      line_id: selectedLine,
      event_type: eventType
    });

    if (error) {
      playBeep('error');
      setFeedback({
        status: 'error',
        message: error.message || 'Error al validar gafete'
      });
    } else if (scanResult && !scanResult.was_successful) {
      playBeep('error');
      setFeedback({
        status: 'error',
        message: `ALERTA: ${scanResult.error_message}`
      });
      loadData();
    } else {
      playBeep('success');
      let actionStr = 'INICIÓ TURNO';
      if (eventType === 'lunch_start') actionStr = 'SALIDA A COMEDOR';
      if (eventType === 'lunch_return') actionStr = 'REGRESO DE COMEDOR';
      if (eventType === 'shift_end') actionStr = 'FINALIZÓ TURNO';

      setFeedback({
        status: 'success',
        message: `${scanResult.employee_name} - ${actionStr}`,
        employeeName: scanResult.employee_name
      });
      loadData();
    }

    setBadgeInput('');
    setTimeout(() => {
      setFeedback(prev => {
        if (prev.employeeName === emp?.name || prev.status === 'error') {
          return { status: null, message: '' };
        }
        return prev;
      });
    }, 4000);
    inputRef.current?.focus();
  };

  const handleQuickClick = (emp: any) => {
    handleScan(emp.badge_id);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm transition-opacity duration-300">
      {/* Click outside container to close */}
      <div className="absolute inset-0 -z-10" onClick={onClose}></div>

      {/* Drawer Body Sheet */}
      <div className="w-full max-w-md h-full bg-[#050B18] border-l border-slate-800 text-slate-100 flex flex-col justify-between shadow-2xl p-6 relative overflow-y-auto animate-in slide-in-from-right duration-200">
        
        {/* Header */}
        <div className="flex justify-between items-center pb-4 border-b border-slate-850">
          <div className="flex items-center gap-2">
            <QrCode className="text-emerald-400 w-5 h-5" />
            <h3 className="text-md font-extrabold tracking-wide uppercase">Terminal Simuladora</h3>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-slate-200 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content body wrapper */}
        <div className="flex-grow space-y-5 py-4 overflow-y-auto pr-1">
          {/* Select Options */}
          <div className="space-y-3.5 bg-[#0B132B] p-4 rounded-xl border border-slate-850">
            <div>
              <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Evento de Registro</label>
              <select
                value={eventType}
                onChange={(e) => setEventType(e.target.value)}
                className="w-full bg-[#050B18] border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 cursor-pointer"
              >
                <option value="shift_start">Inicio de Turno</option>
                <option value="lunch_start">Inicio Cobertura Comedor</option>
                <option value="lunch_return">Regreso de Comedor</option>
                <option value="shift_end">Fin de Turno</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Línea de Producción</label>
              <select
                value={selectedLine}
                onChange={(e) => setSelectedLine(e.target.value)}
                className="w-full bg-[#050B18] border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 cursor-pointer"
              >
                {lines.map(l => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Barcode scanner emulation console box */}
          <div className="relative border border-slate-800 bg-[#0B132B]/20 p-4 rounded-xl overflow-hidden laser-scan-overlay">
            <div className="text-center py-3">
              <span className="text-[9px] tracking-widest text-emerald-400 font-mono block mb-1">[ LECTOR LÁSER USB ACTIVO ]</span>
              <div className="flex gap-2 justify-center">
                <input
                  ref={inputRef}
                  type="text"
                  value={badgeInput}
                  onChange={(e) => setBadgeInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleScan(badgeInput)}
                  placeholder="Gafete ID"
                  className="bg-black border border-emerald-550/20 text-emerald-400 text-xl font-bold font-mono px-3 py-1 w-44 text-center tracking-widest rounded focus:outline-none focus:border-emerald-400 uppercase"
                />
                <button
                  onClick={() => handleScan(badgeInput)}
                  className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded font-mono font-bold text-xs uppercase"
                >
                  Ok
                </button>
              </div>
            </div>

            {/* Simulated terminal feedback bar */}
            {feedback.status && (
              <div className={`mt-3 p-3 rounded border text-xs flex items-center space-x-2 ${
                feedback.status === 'success' 
                  ? 'bg-emerald-950/85 border-emerald-500/40 text-emerald-400' 
                  : 'bg-red-950/85 border-red-500/40 text-red-400'
              }`}>
                {feedback.status === 'success' ? (
                  <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                )}
                <span className="font-mono font-bold">{feedback.message}</span>
              </div>
            )}
          </div>

          {/* Operator Grid List Quick check-in */}
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-2">Simular Operadores (Catálogo)</span>
            <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
              {employeesList.map(emp => (
                <button
                  key={emp.id}
                  onClick={() => handleQuickClick(emp)}
                  className="bg-[#0B132B]/50 hover:bg-[#0B132B] border border-slate-850 hover:border-blue-500 rounded-lg p-2.5 text-left text-[11px] transition-all flex flex-col justify-between"
                >
                  <span className="font-bold text-slate-200 truncate block w-full text-xs">{emp.name}</span>
                  <div className="flex justify-between w-full mt-1.5 pt-1 border-t border-slate-800/40 text-[10px] text-slate-450 font-mono">
                    <span>Gafete:</span>
                    <span className="text-blue-400 font-bold">{emp.badge_id}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Recent Scans feed */}
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-2 flex items-center gap-1">
              <ClipboardList className="w-3.5 h-3.5 text-emerald-400" />
              Historial Reciente de Escaneo
            </span>
            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
              {recentScans.map(scan => (
                <div 
                  key={scan.id} 
                  className={`p-2 border rounded-lg flex justify-between items-center text-[10px] ${
                    scan.was_successful 
                      ? 'bg-slate-900/30 border-slate-850' 
                      : 'bg-red-950/10 border-red-500/10 text-red-300'
                  }`}
                >
                  <div>
                    <span className="font-bold block">{scan.employee_name}</span>
                    <span className="text-[9px] text-slate-500 font-mono block mt-0.5">Gafete: {scan.badge_id} | Línea: {scan.linea?.name || 'N/A'}</span>
                  </div>
                  <div className="text-right">
                    <span className={`font-mono text-[8px] px-1 rounded block ${
                      scan.was_successful ? 'bg-emerald-950 text-emerald-450' : 'bg-red-950 text-red-400'
                    }`}>
                      {scan.was_successful ? 'VÁLIDO' : 'DENEGADO'}
                    </span>
                    <span className="text-slate-650 font-mono mt-0.5 block">{new Date(scan.event_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
              ))}
              {recentScans.length === 0 && (
                <span className="text-xs text-slate-600 italic block py-4 text-center">Sin escaneos hoy</span>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-850 text-center text-[9px] text-slate-500 font-mono">
          Simulación de Gafete • LP LinePulse v2.0
        </div>
      </div>
    </div>
  );
};
