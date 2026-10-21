const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const injection = `
// --- AI Prompts Background Auto-Updater ---
async function fetchLiveAiPromptsFromWeb(): Promise<number> {
  const ai = getGeminiClient();
  if (!ai) return 0;
  
  const categories = [
    { key: 'pixar', query: 'disney pixar 3d character prompt midjourney lexica' },
    { key: 'family', query: 'family portrait baby parents cozy photography prompt midjourney' },
    { key: 'couple', query: 'romantic couple wedding photoshoot cinematic prompt midjourney' },
    { key: 'cyberpunk', query: 'cyberpunk neon futuristic portrait prompt midjourney' },
    { key: 'royal', query: 'royal king queen historical portrait oil painting prompt' },
    { key: 'artistic', query: 'studio ghibli anime style portrait prompt midjourney' },
    { key: 'fashion', query: 'high fashion editorial studio lighting portrait prompt lexica' },
    { key: 'random', query: 'top trending latest hyperrealistic photography prompt midjourney 2024' }
  ];

  let addedCount = 0;
  
  // Pick 3 random categories to refresh each time to avoid giant requests
  const shuffledCats = categories.sort(() => 0.5 - Math.random()).slice(0, 3);
  
  for (const cat of shuffledCats) {
    try {
      const prompt = \`You are an expert AI Prompt Engineer. Use Google Search to find the LATEST and most trending prompts for Midjourney/Stable Diffusion related to: "\${cat.query}".
Find exactly 2 unique, highly detailed, and professional English prompts. Do not repeat generic ones. Find complex and beautiful ones.
Return a valid JSON array of objects (no markdown, just JSON) with this exact structure:
[
  {
    "title": "A catchy Persian title (e.g. پرتره سایبرپانک نئونی)",
    "description": "A very attractive Persian description of the result.",
    "promptText": "The exact original English prompt text.",
    "tipsForPersonalPhoto": "یک نکته کوتاه فارسی برای ترکیب این پرامپت با عکس شخصی کاربر",
    "tags": ["پرامپت", "میدجرنی"]
  }
]\`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.7-flash',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          tools: [{ googleSearch: {} }],
          temperature: 0.9,
          responseMimeType: 'application/json'
        }
      });

      const content = response.text();
      if (content) {
        let parsed = [];
        try {
          const cleaned = content.replace(/\`\`\`json\n?|\n?\`\`\`/g, '').trim();
          parsed = JSON.parse(cleaned);
        } catch(e) { continue; }
        
        if (!db.aiPrompts) db.aiPrompts = [];
        const existingTexts = new Set(db.aiPrompts.map(p => p.promptText.trim().toLowerCase()));
        
        for (const p of parsed) {
          if (!p.promptText || p.promptText.length < 15) continue;
          if (existingTexts.has(p.promptText.trim().toLowerCase())) continue;
          
          db.aiPrompts.unshift({
            id: 'prompt-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
            title: p.title || 'پرامپت هوش مصنوعی',
            category: 'image',
            styleCategory: cat.key,
            description: p.description || 'پرامپت جذاب و کاربردی',
            promptText: p.promptText,
            tipsForPersonalPhoto: p.tipsForPersonalPhoto,
            imageUrl: 'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?w=800&auto=format&fit=crop&q=60',
            tags: Array.isArray(p.tags) ? [...p.tags, cat.key] : [cat.key],
            createdAt: new Date().toISOString()
          });
          addedCount++;
        }
      }
    } catch (err) {
      console.error('Error fetching prompt for cat', cat.key, err);
    }
    // Small delay between searches
    await new Promise(r => setTimeout(r, 3000));
  }
  return addedCount;
}

function purgeOldAiPrompts(maxDays = 7): number {
  if (!db.aiPrompts || db.aiPrompts.length === 0) return 0;
  
  const initialCount = db.aiPrompts.length;
  const cutoffTime = Date.now() - (maxDays * 24 * 60 * 60 * 1000);
  
  db.aiPrompts = db.aiPrompts.filter(item => {
    if (!item.postedToChannel) return true;
    if (item.id.startsWith('prompt-') && item.id.length < 10) return true;
    
    if (item.postedAt) {
      const postedTime = new Date(item.postedAt).getTime();
      return postedTime > cutoffTime;
    }
    
    const createdTime = new Date(item.createdAt).getTime();
    return createdTime > cutoffTime;
  });
  
  if (db.aiPrompts.length > 50) {
    db.aiPrompts = db.aiPrompts.slice(0, 50);
  }
  
  return initialCount - db.aiPrompts.length;
}

async function refreshAiPromptsAndPurgeOld(force = false): Promise<{ added: number; purged: number; total: number }> {
  const maxDays = 7;
  const purged = purgeOldAiPrompts(maxDays);
  const added = await fetchLiveAiPromptsFromWeb();
  
  if (added > 0 || purged > 0 || force) {
    saveDatabase();
    if (added > 0) {
      addLog('info', \`🎨 بروزرسانی پرامپت‌های هوش مصنوعی: \${added} پرامپت جدید از وب دریافت شد.\`);
    }
  }
  
  return {
    added,
    purged,
    total: db.aiPrompts ? db.aiPrompts.length : 0
  };
}

// Master refresh function that seeds, fetches fresh RSS, purges old and saves
`;

code = code.replace(/\/\/ Master refresh function that seeds, fetches fresh RSS, purges old and saves\n/g, injection);
fs.writeFileSync('server.ts', code);
console.log('Injected successfully');
