import React, { useState, useEffect } from 'react';
import { 
  X, 
  Play, 
  Terminal, 
  Copy, 
  Check, 
  Download, 
  Globe, 
  ShieldCheck, 
  AlertTriangle, 
  RefreshCw, 
  Activity, 
  Zap, 
  Layers, 
  Cpu, 
  Eye, 
  EyeOff, 
  CheckCircle2, 
  XCircle,
  HelpCircle,
  Smartphone,
  Radio,
  Server
} from 'lucide-react';

interface V2RaySimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialConfig?: string;
  defaultProxyUri?: string;
}

export const V2RaySimulatorModal: React.FC<V2RaySimulatorModalProps> = ({
  isOpen,
  onClose,
  initialConfig = '',
  defaultProxyUri = ''
}) => {
  const [configInput, setConfigInput] = useState(initialConfig);
  const [proxyUri, setProxyUri] = useState(defaultProxyUri);
  const [selectedIsp, setSelectedIsp] = useState<'all' | 'mci' | 'irancell' | 'rightel' | 'fixed'>('all');
  const [showPassword, setShowPassword] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'curl' | 'json' | 'headers' | 'logs'>('overview');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [presetsLoading, setPresetsLoading] = useState(false);
  const [presetConfigs, setPresetConfigs] = useState<Array<{ id: string; name: string; raw: string; latency: number | null }>>([]);
  
  const [simResult, setSimResult] = useState<any | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (initialConfig) setConfigInput(initialConfig);
    if (defaultProxyUri) setProxyUri(defaultProxyUri);
  }, [initialConfig, defaultProxyUri]);

  // Load preset configs when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchPresets();
    }
  }, [isOpen]);

  const fetchPresets = async () => {
    setPresetsLoading(true);
    try {
      const res = await fetch('/api/v2ray-simulator/preset-configs');
      const data = await res.json();
      if (data.success && Array.isArray(data.configs)) {
        setPresetConfigs(data.configs);
        if (!configInput && data.configs.length > 0) {
          setConfigInput(data.configs[0].raw);
        }
      }
    } catch (_) {}
    finally {
      setPresetsLoading(false);
    }
  };

  const handleRunSimulation = async () => {
    if (!configInput.trim()) {
      setErrorMsg('لطفاً لینک کانفیگ V2Ray (vless, vmess, trojan, ss) را وارد نمایید.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/v2ray-simulator/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawConfig: configInput.trim(),
          targetIsp: selectedIsp,
          proxyUri: proxyUri.trim()
        })
      });

      const data = await res.json();
      if (data.success) {
        setSimResult(data);
      } else {
        setErrorMsg(data.message || 'خطا در اجرای شبیه‌ساز V2Ray.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'خطا در ارتباط با سرور.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleDownloadJson = () => {
    if (!simResult?.clientConfigJson) return;
    const blob = new Blob([JSON.stringify(simResult.clientConfigJson, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'v2ray_client_relay_config.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/80 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-5xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] text-slate-100">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Activity className="w-5 h-5 text-white animate-pulse" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span>شبیه‌ساز و لابراتوار V2Ray از مسیر پروکسی ایران</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  V2Ray Sandbox
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                تست پورت، شبیه‌سازی آنالیز ISPهای ایرانی، استخراج cURL و تولید config.json کلاینت
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-6 overflow-y-auto flex-1 custom-scrollbar">
          
          {/* Config & Proxy Input Controls */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 bg-slate-800/60 p-4 rounded-xl border border-slate-800">
            
            {/* Input Config Area */}
            <div className="lg:col-span-2 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-indigo-400" />
                  <span>لینک کانفیگ V2Ray جهت شبیه‌سازی:</span>
                </label>
                {presetConfigs.length > 0 && (
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-slate-400">نمونه‌ها:</span>
                    <select
                      onChange={(e) => setConfigInput(e.target.value)}
                      className="bg-slate-900 border border-slate-700 text-xs text-indigo-300 rounded px-2 py-0.5 focus:outline-none"
                    >
                      <option value="">انتخاب از کانفیگ‌های فعال...</option>
                      {presetConfigs.map((p, idx) => (
                        <option key={p.id} value={p.raw}>
                          #{idx + 1} {p.name} ({p.latency ? `${p.latency}ms` : 'تست‌نشده'})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <textarea
                value={configInput}
                onChange={(e) => setConfigInput(e.target.value)}
                placeholder="vmess://... یا vless://... یا trojan://... یا ss://..."
                rows={3}
                className="w-full px-3 py-2 text-xs font-mono bg-slate-950 border border-slate-700 rounded-lg text-slate-200 focus:border-indigo-500 focus:outline-none placeholder-slate-600 dir-ltr text-left"
              />
            </div>

            {/* Proxy Override & Action */}
            <div className="space-y-3 flex flex-col justify-between">
              <div>
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5 mb-1.5">
                  <Globe className="w-3.5 h-3.5 text-emerald-400" />
                  <span>پروکسی واسط ایران (Relay Proxy):</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={proxyUri}
                    onChange={(e) => setProxyUri(e.target.value)}
                    placeholder="socks5://user:pass@185.x.x.x:1080"
                    className="w-full px-3 py-2 pr-9 text-xs font-mono bg-slate-950 border border-slate-700 rounded-lg text-slate-200 focus:border-emerald-500 focus:outline-none placeholder-slate-600 dir-ltr text-left"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  {proxyUri ? 'تست پورت‌ها از مسیر این سرور انجام خواهد شد.' : 'پروکسی خالی است؛ تست به‌صورت مستقیم انجام می‌شود.'}
                </p>
              </div>

              {/* ISP Selector Buttons */}
              <div>
                <span className="text-[11px] font-semibold text-slate-400 block mb-1">اپراتور هدف:</span>
                <div className="grid grid-cols-4 gap-1">
                  {[
                    { id: 'all', label: 'همه', color: 'bg-slate-700' },
                    { id: 'mci', label: 'همراه اول', color: 'bg-cyan-600/50' },
                    { id: 'irancell', label: 'ایرانسل', color: 'bg-amber-600/50' },
                    { id: 'fixed', label: 'ثابت', color: 'bg-emerald-600/50' }
                  ].map((isp) => (
                    <button
                      key={isp.id}
                      onClick={() => setSelectedIsp(isp.id as any)}
                      className={`px-2 py-1 text-[10px] font-bold rounded text-center transition-all cursor-pointer ${
                        selectedIsp === isp.id
                          ? 'bg-indigo-600 text-white shadow-md'
                          : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                      }`}
                    >
                      {isp.label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleRunSimulation}
                disabled={loading}
                className="w-full py-2.5 px-4 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 active:scale-95 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>در حال شبیه‌سازی و تست پورت...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-white" />
                    <span>اجرای شبیه‌سازی V2Ray</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Simulation Output Dashboard */}
          {simResult && (
            <div className="space-y-5 animate-fade-in">
              
              {/* Visual Pipeline Graph Diagram */}
              <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-800">
                <div className="text-xs font-bold text-slate-300 mb-3 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-indigo-400" />
                    <span>دیاگرام زنجیره اتصال و مسیر عبور ترافیک V2Ray:</span>
                  </span>
                  <span className="text-[11px] text-emerald-400 font-mono">
                    پینگ کلی: {simResult.proxyStatus?.latency || 999}ms
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-2 relative">
                  
                  {/* Node 1: Client */}
                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-center space-y-1">
                    <div className="w-7 h-7 mx-auto rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center">
                      <Smartphone className="w-3.5 h-3.5" />
                    </div>
                    <div className="text-[11px] font-bold text-slate-200">کلاینت V2Ray</div>
                    <div className="text-[9px] font-mono text-slate-400">127.0.0.1:10808</div>
                  </div>

                  {/* Node 2: Iran Proxy */}
                  <div className={`p-3 rounded-lg bg-slate-900 border text-center space-y-1 ${
                    simResult.proxyStatus?.active ? 'border-emerald-500/50 bg-emerald-950/10' : 'border-slate-800'
                  }`}>
                    <div className="w-7 h-7 mx-auto rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                      <Globe className="w-3.5 h-3.5" />
                    </div>
                    <div className="text-[11px] font-bold text-slate-200">پروکسی واسط ایران</div>
                    <div className="text-[9px] font-mono text-emerald-400 truncate dir-ltr">
                      {simResult.exitNode?.ip || 'بدون واسط'}
                    </div>
                  </div>

                  {/* Node 3: ISP Filter */}
                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-center space-y-1">
                    <div className="w-7 h-7 mx-auto rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center">
                      <ShieldCheck className="w-3.5 h-3.5" />
                    </div>
                    <div className="text-[11px] font-bold text-slate-200">فیلترینگ ISP</div>
                    <div className="text-[9px] text-amber-300 font-mono">
                      {simResult.proxyStatus?.working ? 'پورت باز (Pass)' : 'محدود/بسته'}
                    </div>
                  </div>

                  {/* Node 4: Target V2Ray */}
                  <div className={`p-3 rounded-lg bg-slate-900 border text-center space-y-1 ${
                    simResult.proxyStatus?.working ? 'border-emerald-500/50 bg-emerald-950/20' : 'border-red-500/40 bg-red-950/10'
                  }`}>
                    <div className={`w-7 h-7 mx-auto rounded-full flex items-center justify-center ${
                      simResult.proxyStatus?.working ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                    }`}>
                      <Server className="w-3.5 h-3.5" />
                    </div>
                    <div className="text-[11px] font-bold text-slate-200">سرور V2Ray مقصد</div>
                    <div className="text-[9px] font-mono text-slate-400 truncate dir-ltr">
                      {simResult.details?.host}:{simResult.details?.port}
                    </div>
                  </div>

                </div>
              </div>

              {/* Navigation Tabs */}
              <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto">
                {[
                  { id: 'overview', label: '📊 خلاصه نتایج و پایداری ISPها' },
                  { id: 'curl', label: '📋 دستورات Raw cURL & CLI' },
                  { id: 'json', label: '📄 کانفیگ JSON کلاینت Xray' },
                  { id: 'headers', label: '🔍 آنالیز پارامترهای پروتکل' },
                  { id: 'logs', label: '📜 لاگ گام‌به‌گام شبیه‌ساز' }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                      activeTab === tab.id
                        ? 'bg-indigo-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab 1: Overview */}
              {activeTab === 'overview' && (
                <div className="space-y-4">
                  
                  {/* Key Metrics */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                      <span className="text-[10px] text-slate-400 block">وضعیت پورت پینگ:</span>
                      <div className="flex items-center gap-1.5 mt-1">
                        {simResult.proxyStatus?.working ? (
                          <>
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            <span className="text-sm font-bold text-emerald-400">فعال ({simResult.proxyStatus.latency}ms)</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-4 h-4 text-red-400" />
                            <span className="text-sm font-bold text-red-400">تایم‌آوت / مسدود</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                      <span className="text-[10px] text-slate-400 block">پروتکل شناسایی‌شده:</span>
                      <span className="text-sm font-bold text-indigo-300 mt-1 block uppercase">
                        {simResult.details?.protocol} {simResult.details?.tls ? '+ TLS' : ''}
                      </span>
                    </div>

                    <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                      <span className="text-[10px] text-slate-400 block">IP خروجی واسط:</span>
                      <span className="text-xs font-mono font-bold text-emerald-400 mt-1 block dir-ltr truncate">
                        {simResult.exitNode?.ip}
                      </span>
                      <span className="text-[9px] text-slate-400 block">{simResult.exitNode?.isp}</span>
                    </div>

                    <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                      <span className="text-[10px] text-slate-400 block">پورت سرور:</span>
                      <span className="text-sm font-bold text-purple-300 mt-1 block font-mono">
                        {simResult.details?.port}
                      </span>
                    </div>
                  </div>

                  {/* ISP Compatibility Readiness Scores */}
                  <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
                    <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <Radio className="w-4 h-4 text-cyan-400" />
                      <span>پیش‌بینی درصد کارکرد در اپراتورهای اصلی ایران (ISP Readiness Matrix):</span>
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {[
                        { name: 'همراه اول (MCI)', score: simResult.ispScores?.mci, icon: '🩵' },
                        { name: 'ایرانسل (Irancell)', score: simResult.ispScores?.irancell, icon: '💛' },
                        { name: 'رایتل (Rightel)', score: simResult.ispScores?.rightel, icon: '💜' },
                        { name: 'اینترنت ثابت (شاتل/مخابرات)', score: simResult.ispScores?.fixed, icon: '🏠' }
                      ].map((isp, idx) => (
                        <div key={idx} className="p-3 bg-slate-900 rounded-lg border border-slate-800 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span>{isp.icon}</span>
                            <span className="text-xs font-bold text-slate-200">{isp.name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-24 bg-slate-800 h-2 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  (isp.score || 0) > 85 ? 'bg-emerald-500' : (isp.score || 0) > 60 ? 'bg-amber-500' : 'bg-red-500'
                                }`}
                                style={{ width: `${isp.score || 0}%` }}
                              />
                            </div>
                            <span className="text-xs font-mono font-bold text-slate-300">{isp.score}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Recommendations */}
                  {simResult.recommendations?.length > 0 && (
                    <div className="p-4 bg-indigo-950/30 border border-indigo-500/30 rounded-xl space-y-2">
                      <h4 className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                        <Zap className="w-4 h-4 text-indigo-400" />
                        <span>پیشنهادات هوشمند بهینه‌سازی کانفیگ:</span>
                      </h4>
                      <ul className="space-y-1 text-xs text-slate-300">
                        {simResult.recommendations.map((rec: string, i: number) => (
                          <li key={i} className="flex items-center gap-2">
                            <span className="text-indigo-400">•</span>
                            <span>{rec}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                </div>
              )}

              {/* Tab 2: cURL Commands */}
              {activeTab === 'curl' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-300">
                        دستور cURL تست مستقیم اتصال از طریق پروکسی:
                      </label>
                      <button
                        onClick={() => handleCopy(simResult.rawCurl, 'rawCurl')}
                        className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                      >
                        {copiedKey === 'rawCurl' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        <span>کپی دستور</span>
                      </button>
                    </div>

                    <pre className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-emerald-400 text-xs font-mono dir-ltr overflow-x-auto whitespace-pre-wrap">
                      {simResult.rawCurl}
                    </pre>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-300">
                        دستور اجرا در ترمینال لینوکس/مک با Xray Core CLI:
                      </label>
                      <button
                        onClick={() => handleCopy(simResult.xrayCliCommand, 'xrayCli')}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                      >
                        {copiedKey === 'xrayCli' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        <span>کپی دستور</span>
                      </button>
                    </div>

                    <pre className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-indigo-300 text-xs font-mono dir-ltr overflow-x-auto">
                      {simResult.xrayCliCommand}
                    </pre>
                  </div>
                </div>
              )}

              {/* Tab 3: JSON Client Config */}
              {activeTab === 'json' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-300">
                      فایل کانفیگ کلاینت Xray / v2rayN با زنجیره واسط پروکسی ایران (`config.json`):
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleCopy(JSON.stringify(simResult.clientConfigJson, null, 2), 'jsonConfig')}
                        className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                      >
                        {copiedKey === 'jsonConfig' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        <span>کپی JSON</span>
                      </button>

                      <button
                        onClick={handleDownloadJson}
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Download className="w-3 h-3" />
                        <span>دانلود config.json</span>
                      </button>
                    </div>
                  </div>

                  <pre className="p-4 bg-slate-950 border border-slate-800 rounded-xl text-cyan-300 text-xs font-mono dir-ltr max-h-80 overflow-y-auto custom-scrollbar whitespace-pre">
                    {JSON.stringify(simResult.clientConfigJson, null, 2)}
                  </pre>
                </div>
              )}

              {/* Tab 4: Protocol Headers */}
              {activeTab === 'headers' && (
                <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
                  <h4 className="text-xs font-bold text-slate-300">جزئیات فنی استخراج‌شده از لینک کانفیگ:</h4>
                  
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    <div className="p-2 bg-slate-900 rounded border border-slate-800">
                      <span className="text-slate-400 block text-[10px]">پروتکل:</span>
                      <span className="text-indigo-400 font-bold uppercase">{simResult.details?.protocol}</span>
                    </div>

                    <div className="p-2 bg-slate-900 rounded border border-slate-800">
                      <span className="text-slate-400 block text-[10px]">سرور / Host:</span>
                      <span className="text-slate-200 dir-ltr block truncate">{simResult.details?.host}</span>
                    </div>

                    <div className="p-2 bg-slate-900 rounded border border-slate-800">
                      <span className="text-slate-400 block text-[10px]">پورت:</span>
                      <span className="text-purple-300">{simResult.details?.port}</span>
                    </div>

                    <div className="p-2 bg-slate-900 rounded border border-slate-800">
                      <span className="text-slate-400 block text-[10px]">SNI:</span>
                      <span className="text-emerald-400 dir-ltr block truncate">{simResult.details?.sni || 'تنظیم نشده'}</span>
                    </div>

                    <div className="p-2 bg-slate-900 rounded border border-slate-800">
                      <span className="text-slate-400 block text-[10px]">Host Header:</span>
                      <span className="text-amber-300 dir-ltr block truncate">{simResult.details?.hostHeader || 'تنظیم نشده'}</span>
                    </div>

                    <div className="p-2 bg-slate-900 rounded border border-slate-800">
                      <span className="text-slate-400 block text-[10px]">امنیت TLS:</span>
                      <span className={simResult.details?.tls ? 'text-emerald-400' : 'text-slate-400'}>
                        {simResult.details?.tls ? 'فعال (TLS/REALITY)' : 'غیرفعال (None)'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 5: Real-time Simulation Logs */}
              {activeTab === 'logs' && (
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2 font-mono text-xs">
                  <div className="text-slate-400 text-[10px] mb-1">لاگ گام‌به‌گام اجرای آزمایشگاه V2Ray:</div>
                  <div className="space-y-1.5 max-h-60 overflow-y-auto custom-scrollbar">
                    {simResult.simLogs?.map((log: any, idx: number) => (
                      <div key={idx} className="flex items-start gap-2 text-[11px] dir-rtl">
                        <span className="text-slate-500 font-mono text-[10px] shrink-0">[{log.time}]</span>
                        <span className={
                          log.type === 'success' ? 'text-emerald-400' :
                          log.type === 'error' ? 'text-red-400' :
                          log.type === 'warn' ? 'text-amber-400' : 'text-slate-300'
                        }>
                          {log.message}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          )}

        </div>

      </div>
    </div>
  );
};
