import React, { useState } from 'react';
import { X, Check, Globe, RefreshCw, Shield, Bot } from 'lucide-react';
import { SystemSettings } from '../types';

interface SystemSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: SystemSettings;
  onSave: (updated: SystemSettings) => void;
}

export const SystemSettingsModal: React.FC<SystemSettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSave,
}) => {
  const [formData, setFormData] = useState<SystemSettings>(settings);
  const [saved, setSaved] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-white p-1 rounded-lg"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-800">
          <Shield className="w-6 h-6 text-indigo-400" />
          <div>
            <h2 className="text-lg font-bold text-white">System & Relay Proxy Settings</h2>
            <p className="text-xs text-slate-400">
              Configure extraction limits, auto-test intervals, and Iran proxy endpoints.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Iran Relay Proxy Endpoint */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
            <label className="block font-semibold text-slate-200 mb-1 flex items-center gap-2">
              <Globe className="w-4 h-4 text-violet-400" />
              Iran Relay Proxy URL (SOCKS5 / HTTP Proxy for Real Testing)
            </label>
            <input
              type="text"
              value={formData.iranRelayProxy || ''}
              onChange={(e) =>
                setFormData({ ...formData, iranRelayProxy: e.target.value })
              }
              placeholder="http://proxyuser:password@95.38.68.158:1080"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Used to route real cURL/HTTP probes through Iran network.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-medium text-slate-300 mb-1">
                Auto-Extract Interval (Minutes)
              </label>
              <input
                type="number"
                min={5}
                max={1440}
                value={formData.autoExtractInterval}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    autoExtractInterval: parseInt(e.target.value) || 30,
                  })
                }
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-300 mb-1">
                Auto-Test Interval (Minutes)
              </label>
              <input
                type="number"
                min={1}
                max={1440}
                value={formData.autoTestInterval}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    autoTestInterval: parseInt(e.target.value) || 10,
                  })
                }
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-medium text-slate-300 mb-1">
                Test Batch Worker Limit
              </label>
              <input
                type="number"
                min={10}
                max={500}
                value={formData.testBatchLimit}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    testBatchLimit: parseInt(e.target.value) || 100,
                  })
                }
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-300 mb-1">
                Branding Footer
              </label>
              <input
                type="text"
                value={formData.branding || ''}
                onChange={(e) => setFormData({ ...formData, branding: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-400 hover:text-white"
            >
              Cancel
            </button>

            <button
              type="submit"
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg transition-all flex items-center gap-2"
            >
              {saved ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  Saved!
                </>
              ) : (
                'Save Settings'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
