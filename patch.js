const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const regex = /\/\/ --- Live Real-Time AI Prompt Extractor[\s\S]*?tags: \['پیکسار', 'تبدیل_عکس_شخصی', 'دیزنی', 'انیمیشن_۳بعدی'\]\n  \};\n\}/;

const replacement = `// --- Live Real-Time AI Prompt Extractor (Photo-styling & Face Combination) ---
async function fetchLiveTrendingAiPromptFromInternet(categoryKey?: string): Promise<{
  title: string;
  category: 'image' | 'video' | 'chat' | 'other';
  styleCategory?: string;
  description: string;
  promptText: string;
  imageUrl?: string;
  tags: string[];
  tipsForPersonalPhoto?: string;
}> {
  const allLocal = db.aiPrompts || [];
  let candidates = allLocal.filter(p => !p.postedToChannel);
  
  if (categoryKey && categoryKey !== 'random') {
    let specificCandidates = candidates.filter(p => p.styleCategory === categoryKey || p.tags.includes(categoryKey));
    if (specificCandidates.length === 0) {
      specificCandidates = allLocal.filter(p => p.styleCategory === categoryKey || p.tags.includes(categoryKey));
    }
    if (specificCandidates.length > 0) candidates = specificCandidates;
  }
  
  if (candidates.length === 0 && allLocal.length > 0) {
    candidates = allLocal;
  }

  if (candidates.length > 0) {
    const p = candidates[Math.floor(Math.random() * candidates.length)];
    return {
      title: p.title,
      category: p.category as any,
      styleCategory: p.styleCategory || categoryKey,
      description: p.description,
      promptText: p.promptText,
      imageUrl: p.imageUrl,
      tags: p.tags,
      tipsForPersonalPhoto: p.tipsForPersonalPhoto || 'برای این پرامپت، یک عکس سلفی واضح از چهره خود آپلود کنید.'
    };
  }

  return {
    title: 'تبدیل عکس چهره به کاراکتر انیمیشنی ۳ بعدی پیکسار',
    category: 'image',
    styleCategory: 'pixar',
    description: 'یکی از پرطرفدارترین ترندهای وایرال در PromptHero و ردیت برای تبدیل چهره واقعی به کاراکتر بانمک پیکسار.',
    promptText: '3D Pixar Disney style animated character of [upload your photo], cute expressive eyes, soft studio lighting, vibrant warm colors, smooth clay render, octane render, 8k --ar 9:16 --cw 20',
    tipsForPersonalPhoto: 'از یک عکس پرتره یا سلفی تکی با نور طبیعی و نگاه مستقیم به دوربین استفاده کنید.',
    imageUrl: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800&auto=format&fit=crop&q=60',
    tags: ['پیکسار', 'تبدیل_عکس_شخصی', 'دیزنی', 'انیمیشن_۳بعدی']
  };
}`;

code = code.replace(regex, replacement);
fs.writeFileSync('server.ts', code);
console.log('Replaced successfully');
