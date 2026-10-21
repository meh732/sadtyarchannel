import React from 'react';
import { Play, Square, Trash2, Filter, Shield, AlertTriangle, CheckCircle } from 'lucide-react';
import { TestStatus, SystemSettings } from '../types';

interface ConfigTesterPanelProps {
  testStatus: TestStatus;
  onStartTest: (mode: 'real_http_curl' | 'port_check') => void;
  onStopTest: () => void;
  onPurgeFailed: () => void;
  settings: SystemSettings;
  filter: string;
  setFilter: (f: string) => void;
  protocolFilter: string;
  setProtocolFilter: (p: string) => void;
}

export const ConfigTesterPanel: React.FC<ConfigTesterPanelProps> = ({
  testStatus,
  onStartTest,
  onStopTest,
  onPurgeFailed,
  settings,
  filter,
  setFilter,
  protocolFilter,
  setProtocolFilter,
}) => {
  const percentage = testStatus.total > 0 ? Math.round((testStatus.tested / testStatus.total) * 100) : 0;

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 mb-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Shield className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base font-bold text-white">
              Real Iran-Proxy HTTP Config Tester
            </h2>
            <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-md">
              cURL HTTP 204 Probe
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Tests actual end-to-end HTTP web routing via Iran Relay Proxy (<code className="text-slate-300">{settings.iranRelayProxy ? 'Configured' : 'Direct'}</code>), not just raw TCP socket opening.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {testStatus.isRunning ? (
            <button
              onClick={onStopTest}
              className="px-4 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white rounded-lg transition-all flex items-center gap-2 shadow-sm"
            >
              <Square className="w-4 h-4 fill-current" />
              Stop Test Worker
            </button>
          ) : (
            <>
              <button
                onClick={() => onStartTest('real_http_curl')}
                className="px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-all flex items-center gap-2 shadow-lg shadow-indigo-600/25"
              >
                <Play className="w-4 h-4 fill-current" />
                Start Full HTTP cURL Test
              </button>

              <button
                onClick={() => onStartTest('port_check')}
                className="px-3 py-2 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-all border border-slate-700"
                title="Quick fallback port check"
              >
                Port Check Only
              </button>
            </>
          )}

          <button
            onClick={onPurgeFailed}
            className="px-3 py-2 text-xs font-medium bg-slate-800 hover:bg-rose-950/40 text-rose-400 hover:text-rose-300 rounded-lg transition-all border border-slate-700 hover:border-rose-800/50 flex items-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear Failed
          </button>
        </div>
      </div>

      {/* Progress Bar when running */}
      {testStatus.isRunning && (
        <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 mb-4">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="text-slate-300 font-medium flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              Testing in progress ({testStatus.mode === 'real_http_curl' ? 'Real HTTP Request' : 'TCP Port Check'})...
            </span>
            <span className="text-slate-400 font-mono tabular-nums">
              {testStatus.tested} / {testStatus.total} ({percentage}%)
            </span>
          </div>

          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden mb-2">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 via-sky-400 to-emerald-400 transition-all duration-300"
              style={{ width: `${percentage}%` }}
            ></div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
            <span className="flex items-center gap-1 text-emerald-400">
              <CheckCircle className="w-3 h-3" /> Working: {testStatus.working}
            </span>
            <span className="flex items-center gap-1 text-rose-400">
              <AlertTriangle className="w-3 h-3" /> Failed: {testStatus.failed}
            </span>
            {testStatus.currentConfig && (
              <span className="truncate max-w-xs text-slate-500">
                Current: {testStatus.currentConfig}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Filter and Protocol Selectors */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 font-medium rounded-md transition-all ${
              filter === 'all'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('working')}
            className={`px-3 py-1.5 font-medium rounded-md transition-all ${
              filter === 'working'
                ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/50 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Working Green Only
          </button>
          <button
            onClick={() => setFilter('failed')}
            className={`px-3 py-1.5 font-medium rounded-md transition-all ${
              filter === 'failed'
                ? 'bg-rose-950/60 text-rose-300 border border-rose-800/50 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Failed
          </button>
          <button
            onClick={() => setFilter('pending')}
            className={`px-3 py-1.5 font-medium rounded-md transition-all ${
              filter === 'pending'
                ? 'bg-amber-950/60 text-amber-300 border border-amber-800/50 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Untested / Pending
          </button>
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={protocolFilter}
            onChange={(e) => setProtocolFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-indigo-500"
          >
            <option value="all">All Protocols</option>
            <option value="vmess">VMess</option>
            <option value="vless">VLESS</option>
            <option value="trojan">Trojan</option>
            <option value="ss">Shadowsocks</option>
            <option value="npv">NapsternetV (NPV)</option>
            <option value="tuic">TUIC / Hysteria</option>
          </select>
        </div>
      </div>
    </div>
  );
};
