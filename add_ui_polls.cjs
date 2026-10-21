const fs = require('fs');
let code = fs.readFileSync('src/components/AutoPostView.tsx', 'utf8');

const ch1Polls = `
            {/* Category 7: Smart Polls */}
            <div className="bg-gradient-to-br from-white to-blue-50/30 border border-blue-100 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-blue-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shadow-inner">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 9V5a2 2 0 0 0-2-2L2.59 13.41a2 2 0 0 0 0 2.82L10.6 24"/><path d="M9 14h10"/><path d="M9 10h10"/><path d="M9 18h10"/></svg>
                  </div>
                  <div>
                    <h4 className="font-black text-slate-900 text-sm flex items-center gap-2">
                      <span>۷. نظرسنجی‌های هوشمند و تعاملی (رشد تعامل)</span>
                      <span className={\`px-2 py-0.5 rounded-full text-[10px] font-bold \${autoPostForm.smartPollsEnabled !== false ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-500'}\`}>
                        {autoPostForm.smartPollsEnabled !== false ? 'روشن و فعال' : 'خاموش'}
                      </span>
                    </h4>
                    <p className="text-[10px] text-blue-800/80 font-medium">طرح سوالات چهارگزینه‌ای از کاربران برای بالا بردن تعامل (Engagement) و ذخیره دیتا برای تحلیل هوش مصنوعی</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setAutoPostForm(prev => ({ ...prev, smartPollsEnabled: prev.smartPollsEnabled === false }))}
                  className={\`w-12 h-6 rounded-full transition-all duration-200 cursor-pointer p-0.5 flex items-center \${
                    autoPostForm.smartPollsEnabled !== false ? 'bg-blue-600 justify-end' : 'bg-slate-200 justify-start'
                  }\`}
                >
                  <span className="w-5 h-5 rounded-full bg-white shadow-sm" />
                </button>
              </div>

              <div className="bg-blue-50/60 p-3.5 rounded-xl border border-blue-100 text-xs text-blue-900 leading-relaxed">
                💡 <strong>استراتژی:</strong> ارسال نظرسنجی‌ها باعث می‌شود اعضای کانال با ربات تعامل کنند، ویو بالا برود و رشد ارگانیک کانال تضمین شود. نتایج نظرسنجی‌ها به‌صورت زنده برای تحلیل‌های بعدی در دیتابیس ثبت می‌شود.
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">فاصله زمانی ارسال نظرسنجی</label>
                  <select
                    value={autoPostForm.smartPollsIntervalMinutes || 1440}
                    onChange={(e) => setAutoPostForm(prev => ({ ...prev, smartPollsIntervalMinutes: Number(e.target.value) }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs focus:border-blue-500 focus:outline-none cursor-pointer font-medium"
                  >
                    <option value="360">هر ۶ ساعت</option>
                    <option value="720">هر ۱۲ ساعت</option>
                    <option value="1440">هر ۲۴ ساعت (پیشنهادی)</option>
                    <option value="2880">هر ۴۸ ساعت</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <div className="text-[11px] text-slate-400">
                  {autoPostForm.lastSmartPollPostedAt ? \`آخرین ارسال: \${new Date(autoPostForm.lastSmartPollPostedAt).toLocaleString('fa-IR')}\` : 'هنوز ارسالی ثبت نشده'}
                </div>
              </div>
            </div>
`;

const ch1Target = `            {/* Presentation Settings */}`;
code = code.replace(ch1Target, ch1Polls + '\\n' + ch1Target);

const ch2Polls = `
                  {/* Category 7: Polls */}
                  <div className="p-3 bg-blue-50/30 rounded-xl border border-blue-100/50 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-blue-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 9V5a2 2 0 0 0-2-2L2.59 13.41a2 2 0 0 0 0 2.82L10.6 24"/><path d="M9 14h10"/><path d="M9 10h10"/><path d="M9 18h10"/></svg>
                        <span className="font-bold text-xs text-slate-800">نظرسنجی هوشمند در کانال ۲</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleChannel2Change('smartPollsEnabled', c2.smartPollsEnabled === false)}
                        className={\`w-10 h-5 rounded-full transition-all duration-200 cursor-pointer p-0.5 flex items-center \${
                          c2.smartPollsEnabled !== false ? 'bg-blue-500 justify-end' : 'bg-slate-300 justify-start'
                        }\`}
                      >
                        <span className="w-4 h-4 rounded-full bg-white shadow-sm" />
                      </button>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] text-slate-500 block mb-1">فاصله ارسال</label>
                        <select
                          value={c2.smartPollsIntervalMinutes || 1440}
                          onChange={(e) => handleChannel2Change('smartPollsIntervalMinutes', Number(e.target.value))}
                          className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-xs focus:border-blue-500 focus:outline-none"
                        >
                          <option value="360">هر ۶ ساعت</option>
                          <option value="720">هر ۱۲ ساعت</option>
                          <option value="1440">هر ۲۴ ساعت</option>
                        </select>
                      </div>
                    </div>
                  </div>
`;

const ch2Target = `                  {/* Tech Settings End */}`;
code = code.replace(ch2Target, ch2Polls + '\\n' + ch2Target);

const aiExportBtn = `
        <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
          <div className="flex flex-wrap items-center justify-between p-4 sm:px-6 gap-4">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Bot className="w-5 h-5 text-indigo-600" />
              تنظیمات هوشمند ارسال خودکار (پست‌زن)
            </h2>
            <div className="flex items-center gap-2">
              <a 
                href="/api/bot/export-ai-report"
                target="_blank"
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-bold transition-colors cursor-pointer flex items-center gap-2 border border-slate-200"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                دانلود گزارش برای هوش مصنوعی
              </a>
              <button 
                type="button"
                onClick={handleSave}
                disabled={loading}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-sm transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {loading ? 'در حال ذخیره...' : 'ذخیره تنظیمات'}
              </button>
            </div>
          </div>
        </div>
`;

const headerTarget = `        <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
          <div className="flex flex-wrap items-center justify-between p-4 sm:px-6 gap-4">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Bot className="w-5 h-5 text-indigo-600" />
              تنظیمات هوشمند ارسال خودکار (پست‌زن)
            </h2>
            <button 
              type="button"
              onClick={handleSave}
              disabled={loading}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-sm transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {loading ? 'در حال ذخیره...' : 'ذخیره تنظیمات'}
            </button>
          </div>
        </div>`;

code = code.replace(headerTarget, aiExportBtn);

fs.writeFileSync('src/components/AutoPostView.tsx', code);
console.log('done ui update');
