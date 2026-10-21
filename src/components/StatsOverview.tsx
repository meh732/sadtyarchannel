import React from 'react';
import { Layers, CheckCircle2, XCircle, Globe, Zap, Cpu } from 'lucide-react';
import { ConfigItem, SystemSettings } from '../types';

interface StatsOverviewProps {
  configs: ConfigItem[];
  settings: SystemSettings;
}

export const StatsOverview: React.FC<StatsOverviewProps> = ({ configs, settings }) => {
  const total = configs.length;
  const working = configs.filter((c) => c.status === 'working').length;
  const failed = configs.filter((c) => c.status === 'failed').length;
  const pending = configs.filter((c) => c.status === 'pending' || !c.status).length;
  const npvCount = configs.filter((c) => c.isNpv || c.protocol === 'npv').length;

  const successRate = total > 0 ? Math.round((working / (working + failed || 1)) * 100) : 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
      <div className="bg-slate-900/80 border border-slate-800 p-3.5 rounded-xl">
        <div className="flex items-center justify-between text-slate-400 mb-1">
          <span className="text-xs font-medium">Total Configs</span>
          <Layers className="w-4 h-4 text-indigo-400" />
        </div>
        <div className="text-xl font-bold text-white tabular-nums">{total}</div>
        <div className="text-[10px] text-slate-500 mt-0.5">Last 48h limit active</div>
      </div>

      <div className="bg-slate-900/80 border border-slate-800 p-3.5 rounded-xl">
        <div className="flex items-center justify-between text-slate-400 mb-1">
          <span className="text-xs font-medium">Working (HTTP)</span>
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
        </div>
        <div className="text-xl font-bold text-emerald-400 tabular-nums">{working}</div>
        <div className="text-[10px] text-emerald-500/80 mt-0.5">{successRate}% pass rate</div>
      </div>

      <div className="bg-slate-900/80 border border-slate-800 p-3.5 rounded-xl">
        <div className="flex items-center justify-between text-slate-400 mb-1">
          <span className="text-xs font-medium">Failed</span>
          <XCircle className="w-4 h-4 text-rose-400" />
        </div>
        <div className="text-xl font-bold text-rose-400 tabular-nums">{failed}</div>
        <div className="text-[10px] text-slate-500 mt-0.5">Tested via cURL</div>
      </div>

      <div className="bg-slate-900/80 border border-slate-800 p-3.5 rounded-xl">
        <div className="flex items-center justify-between text-slate-400 mb-1">
          <span className="text-xs font-medium">Pending Test</span>
          <Zap className="w-4 h-4 text-amber-400" />
        </div>
        <div className="text-xl font-bold text-amber-400 tabular-nums">{pending}</div>
        <div className="text-[10px] text-slate-500 mt-0.5">In queue</div>
      </div>

      <div className="bg-slate-900/80 border border-slate-800 p-3.5 rounded-xl">
        <div className="flex items-center justify-between text-slate-400 mb-1">
          <span className="text-xs font-medium">NPV Configs</span>
          <Cpu className="w-4 h-4 text-sky-400" />
        </div>
        <div className="text-xl font-bold text-sky-400 tabular-nums">{npvCount}</div>
        <div className="text-[10px] text-slate-500 mt-0.5">NapsternetV tunnel</div>
      </div>

      <div className="bg-slate-900/80 border border-slate-800 p-3.5 rounded-xl">
        <div className="flex items-center justify-between text-slate-400 mb-1">
          <span className="text-xs font-medium">Iran Relay Proxy</span>
          <Globe className="w-4 h-4 text-violet-400" />
        </div>
        <div className="text-xs font-semibold text-slate-200 truncate mt-1">
          {settings.iranRelayProxy ? settings.iranRelayProxy.replace(/:\/\/([^:]+):([^@]+)@/, '://***:***@') : 'Direct'}
        </div>
        <div className="text-[10px] text-violet-400 mt-1">Real HTTP Probe active</div>
      </div>
    </div>
  );
};
