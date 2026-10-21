import React from 'react';
import { Terminal, Trash2, Info, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import { SystemLog } from '../types';

interface LogsViewProps {
  logs: SystemLog[];
  onClearLogs: () => void;
}

export const LogsView: React.FC<LogsViewProps> = ({ logs, onClearLogs }) => {
  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-6">
      <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
        <div className="flex items-center gap-2">
          <Terminal className="w-5 h-5 text-indigo-400" />
          <h2 className="text-base font-bold text-white">System Execution Logs</h2>
        </div>

        <button
          onClick={onClearLogs}
          className="px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-all border border-slate-700 flex items-center gap-1.5"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Clear Logs
        </button>
      </div>

      <div className="bg-slate-950 rounded-lg p-4 font-mono text-xs max-h-96 overflow-y-auto divide-y divide-slate-900">
        {logs.length === 0 ? (
          <div className="text-slate-600 text-center py-8 font-sans">
            No system logs recorded yet.
          </div>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="py-2 flex items-start gap-3">
              <span className="text-slate-500 text-[10px] whitespace-nowrap pt-0.5">
                {new Date(log.timestamp).toLocaleTimeString()}
              </span>

              {log.type === 'info' && <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />}
              {log.type === 'success' && <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />}
              {log.type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />}
              {log.type === 'error' && <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />}

              <span
                className={`break-all ${
                  log.type === 'error'
                    ? 'text-rose-300'
                    : log.type === 'warning'
                    ? 'text-amber-300'
                    : log.type === 'success'
                    ? 'text-emerald-300'
                    : 'text-slate-300'
                }`}
              >
                {log.message}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
