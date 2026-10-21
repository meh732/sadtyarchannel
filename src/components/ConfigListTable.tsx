import React, { useState } from 'react';
import { Copy, Check, Trash2, ExternalLink, Search, RefreshCw, Zap, Shield, Eye } from 'lucide-react';
import { ConfigItem } from '../types';

interface ConfigListTableProps {
  configs: ConfigItem[];
  onDeleteConfig: (id: string) => void;
  onTestSingleConfig: (config: ConfigItem) => void;
  onSimulateConfig: (config: ConfigItem) => void;
}

export const ConfigListTable: React.FC<ConfigListTableProps> = ({
  configs,
  onDeleteConfig,
  onTestSingleConfig,
  onSimulateConfig,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (raw: string, id: string) => {
    navigator.clipboard.writeText(raw);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filtered = configs.filter((c) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      c.remark.toLowerCase().includes(term) ||
      c.protocol.toLowerCase().includes(term) ||
      c.server.toLowerCase().includes(term) ||
      c.source.toLowerCase().includes(term) ||
      c.raw.toLowerCase().includes(term)
    );
  });

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
      {/* Search Header */}
      <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search remark, server, protocol, source..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>

        <div className="text-xs text-slate-400 font-mono tabular-nums">
          Showing <span className="text-white font-semibold">{filtered.length}</span> of {configs.length} configs
        </div>
      </div>

      {/* Table for Desktop & Cards for Mobile */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-950/80 text-slate-400 uppercase font-mono text-[10px] tracking-wider border-b border-slate-800">
            <tr>
              <th className="py-3 px-4">Status & Ping</th>
              <th className="py-3 px-4">Protocol</th>
              <th className="py-3 px-4">Remark / Server</th>
              <th className="py-3 px-4">Source</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-12 text-center text-slate-500 font-sans">
                  No configurations found matching current filters.
                </td>
              </tr>
            ) : (
              filtered.slice(0, 100).map((config) => {
                const isWorking = config.status === 'working';
                const isFailed = config.status === 'failed';

                return (
                  <tr
                    key={config.id}
                    className="hover:bg-slate-800/40 transition-colors group"
                  >
                    {/* Status & Latency */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      {isWorking ? (
                        <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                          <span>{config.latency ? `${config.latency} ms` : 'Working'}</span>
                        </div>
                      ) : isFailed ? (
                        <div className="flex items-center gap-1.5 text-rose-400">
                          <span className="w-2 h-2 rounded-full bg-rose-400"></span>
                          <span>Failed</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-amber-400">
                          <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                          <span>Untested</span>
                        </div>
                      )}
                    </td>

                    {/* Protocol */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${
                          config.protocol === 'vmess'
                            ? 'bg-purple-950 text-purple-300 border border-purple-800/50'
                            : config.protocol === 'vless'
                            ? 'bg-sky-950 text-sky-300 border border-sky-800/50'
                            : config.protocol === 'trojan'
                            ? 'bg-amber-950 text-amber-300 border border-amber-800/50'
                            : config.protocol === 'ss'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/50'
                            : config.protocol === 'npv' || config.isNpv
                            ? 'bg-indigo-950 text-indigo-300 border border-indigo-800/50'
                            : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {config.protocol}
                      </span>
                    </td>

                    {/* Remark & Server */}
                    <td className="py-3 px-4 max-w-xs truncate">
                      <div className="font-semibold text-slate-100 truncate font-sans">
                        {config.remark || 'Unnamed Config'}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate font-mono">
                        {config.server}:{config.port}
                      </div>
                    </td>

                    {/* Source */}
                    <td className="py-3 px-4 whitespace-nowrap text-slate-400">
                      <span className="text-[11px] font-sans truncate max-w-[120px] block">
                        {config.source || 'Scraped Channel'}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => onSimulateConfig(config)}
                          className="p-1.5 text-slate-400 hover:text-sky-300 hover:bg-slate-800 rounded transition-colors"
                          title="Simulate / Inspect JSON"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => onTestSingleConfig(config)}
                          className="p-1.5 text-slate-400 hover:text-indigo-300 hover:bg-slate-800 rounded transition-colors"
                          title="Test HTTP cURL"
                        >
                          <Zap className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => handleCopy(config.raw, config.id)}
                          className="p-1.5 text-slate-400 hover:text-emerald-300 hover:bg-slate-800 rounded transition-colors"
                          title="Copy Link"
                        >
                          {copiedId === config.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>

                        <button
                          onClick={() => onDeleteConfig(config.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {filtered.length > 100 && (
        <div className="p-3 bg-slate-950 text-center text-xs text-slate-500 border-t border-slate-800">
          Displaying first 100 of {filtered.length} matching items. Use search to narrow down results.
        </div>
      )}
    </div>
  );
};
