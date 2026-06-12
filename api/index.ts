import express from 'express';
import OpenAI from 'openai';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';

// ============================================================
// Zod Schemas
// ============================================================
const FrameworkStepSchema = z.object({
  n: z.string().min(1),
  d: z.string().min(1),
  ex: z.string().min(1),
});

const FrameworkSchema = z.object({
  id: z.number(),
  name: z.string().min(1),
  funnel: z.enum(['tof', 'mof', 'bof']),
  desc: z.string().min(1),
  tags: z.array(z.string()),
  steps: z.array(FrameworkStepSchema).min(1),
});

const AIGenerateSchema = z.object({
  product: z.string().min(1, 'Product is required').max(500),
  audience: z.string().min(1, 'Audience is required').max(500),
  pain: z.string().max(1000).optional().default(''),
  tone: z.object({
    label: z.string().min(1),
    vibe: z.string().min(1),
  }).optional().default({ label: 'edukatif', vibe: 'Conversational' }),
  framework: FrameworkSchema,
});

const PersonalizedInsightsSchema = z.object({
  savedScripts: z.array(z.any()).optional().default([]),
  profileInfo: z.object({
    product: z.string().optional().default(''),
    audience: z.string().optional().default(''),
  }).optional().default({ product: '', audience: '' }),
});

// ============================================================
// Rate Limiting
// ============================================================
const aiGenerateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Terlalu banyak permintaan. Silakan tunggu 1 menit.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const insightsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: 'Terlalu banyak permintaan insight. Silakan tunggu 1 menit.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ============================================================
// DeepSeek Client
// ============================================================
let aiInstance: OpenAI | null = null;

function getDeepSeekClient(): OpenAI {
  if (!aiInstance) {
    const key = process.env.DEEPSEEK_API_KEY;
    if (!key || key === '') {
      throw new Error('DEEPSEEK_API_KEY is required. Please set it in Vercel Environment Variables.');
    }
    aiInstance = new OpenAI({
      apiKey: key,
      baseURL: 'https://api.deepseek.com',
    });
  }
  return aiInstance;
}

/**
 * Safely parse JSON from AI response, handling markdown code block wrappers.
 */
function safeParseAIResponse(responseText: string): any {
  if (!responseText || responseText.trim() === '') {
    throw new Error('AI mengembalikan respons kosong.');
  }

  let cleaned = responseText.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/g, '').trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch {
        // fall through
      }
    }
    const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      try {
        return JSON.parse(arrayMatch[0]);
      } catch {
        // fall through
      }
    }
    throw new Error(
      `AI mengembalikan respons yang tidak valid: ${responseText.slice(0, 200)}...`
    );
  }
}

// ============================================================
// Create Express App
// ============================================================
const app = express();
app.use(express.json({ limit: '1mb' }));

// --- Health Check ---
app.get('/api/health', (_req, res) => {
  const hasDeepSeekKey = !!process.env.DEEPSEEK_API_KEY && process.env.DEEPSEEK_API_KEY !== '';
  res.json({
    status: 'ok',
    hasDeepSeekKey,
  });
});

// --- AI Script Generation ---
app.post('/api/ai-generate', aiGenerateLimiter, async (req, res) => {
  try {
    const parseResult = AIGenerateSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Validasi input gagal',
        details: parseResult.error.issues.map(i => ({ field: i.path.join('.'), message: i.message }))
      });
    }

    const { product, audience, pain, tone, framework } = parseResult.data;
    const ai = getDeepSeekClient();
    const stepsGuide = framework.steps
      .map((s, i) => `${i + 1}. [${s.n}]: ${s.d} (Contoh: "${s.ex}")`)
      .join('\n');

    const systemPrompt = `Kamu adalah pakar strategi konten media sosial dan copywriter TikTok paling terkemuka di Indonesia.
Tugasmu adalah menyusun draf script video konten pendek (TikTok/Reels/Shorts) berdurasi 30-60 detik yang viral, persuasif, dan alami berdasarkan instruksi pengguna.

FORMAT OUTPUT WAJIB:
Kamu harus membalas HANYA dengan struktur JSON valid menggunakan skema berikut:
{
  "script": "Seluruh teks script gabungan secara lengkap, memakai bahasa Indonesia yang luwes, santai, persuasif, berbobot, dan menggunakan emoji yang natural. Hindari pemisah kurung siku layaknya '[Hook]' atau '[Problem]' di dalam naskah ini.",
  "sections": [
    {
      "label": "Bagian Framework",
      "text": "Naskah spesifik untuk bagian ini"
    }
  ],
  "hook_type": "Tipe hook dominan (misalnya 'Shock & Surprise', 'Curiosity Hook', 'Pattern Interrupt')",
  "caption": "Saran caption TikTok SEO-friendly 150-250 karakter, diawali keyword utama di 3 kata pertama, menggunakan emoji yang relevan",
  "hashtags": ["#fyp", "#viral", "minimal 6-8 hashtag kombinasi mega, medium, dan niche"],
  "why_it_works": "Penjelasan singkat 1-2 kalimat dari sudut pandang psikologi audiens kenapa naskah ini sangat kuat.",
  "estimated_duration": 45
}

Ketentuan Naskah:
- Topik / Jasa: ${product}
- Target Audiens: ${audience}
- Masalah / Pain Point: ${pain || 'Umum'}
- Tone of Voice: ${tone.label} (${tone.vibe})
- Framework: "${framework.name}" - ${framework.desc}
- Gunakan struktur framework berikut dengan teliti:
${stepsGuide}`;

    const response = await ai.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: 'Kamu adalah asisten penulis skenario konten TikTok/Reels profesional. Pastikan output selalu berupa objek JSON valid dan tidak ada teks pembuka atau penutup lain di luar JSON.' },
        { role: 'user', content: systemPrompt }
      ],
      temperature: 0.8,
    });

    const responseText = response.choices[0]?.message?.content || '';
    const resultObj = safeParseAIResponse(responseText);
    res.json(resultObj);
  } catch (error: any) {
    console.error('Error in /api/ai-generate:', error);
    res.status(500).json({ error: error.message || 'Fatal error occurred calling DeepSeek API.' });
  }
});

// --- AI Score ---
app.post('/api/ai-score', async (req, res) => {
  try {
    const { script, framework, caption, hashtags, hookType, partsTexts } = req.body;
    if (!script || !framework) {
      return res.status(400).json({ error: 'Script and framework are required' });
    }

    const ai = getDeepSeekClient();
    const stepsContext = framework.steps
      ? framework.steps.map((s: any, i: number) => `${i + 1}. [${s.n}]: ${s.d}`).join('\n')
      : '';
    const partsContext = partsTexts && partsTexts.length > 0
      ? partsTexts.map((t: string, i: number) => `Step ${i + 1}: "${t}"`).join('\n')
      : 'Not provided';

    const prompt = `Kamu adalah AI Script Analyzer. Analisis script TikTok/Reels berikut secara kritis.

Framework: "${framework.name}" (${framework.funnel.toUpperCase()})
Steps: ${stepsContext || 'N/A'}
Isian: ${partsContext}
Caption: ${caption || '-'}
Hashtags: ${hashtags ? hashtags.join(', ') : '-'}
Hook: ${hookType || '-'}

SCRIPT:
${script}

Beri skor 0-100 untuk: hookStrength, readability, seo, emotion, cta, overall.
BALAS HANYA JSON:
{"aiHookScore":0,"aiReadScore":0,"aiSeoScore":0,"aiEmotionScore":0,"aiCtaScore":0,"aiOverall":0,"feedback":"...","suggestions":["..."],"hookAnalysis":"...","readabilityAnalysis":"...","emotionAnalysis":"...","ctaAnalysis":"..."}`;

    const response = await ai.chat.completions.create({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
    });

    const responseText = response.choices[0]?.message?.content || '';
    const resultObj = safeParseAIResponse(responseText);
    res.json(resultObj);
  } catch (error: any) {
    console.error('Error in /api/ai-score:', error);
    res.status(500).json({ error: error.message || 'Fatal error during AI scoring.' });
  }
});

// --- AI Calendar Plan (generate N days at a time) ---
app.post('/api/ai-calendar-plan', async (req, res) => {
  try {
    const { month, year, startDay = 1, daysCount = 7, savedScripts, product, audience } = req.body;
    const ai = getDeepSeekClient();

    const scriptsContext = savedScripts && savedScripts.length > 0
      ? savedScripts.map((s: any) => `${s.title}: ${s.framework?.name}`).join(', ')
      : 'Kosong';

    const endDay = startDay + daysCount - 1;
    const prompt = `Buat rencana konten hari ${startDay}-${endDay} ${month} ${year}.
Produk: ${product || '-'}
Audiens: ${audience || '-'}
Riwayat: ${scriptsContext}
Aturan: 45% TOF, 30% MOF, 25% BOF. Setiap hari framework berbeda.

BALAS HANYA JSON:
{"month":"${month}","year":${year},"days":[{"day":${startDay},"date":"YYYY-MM-DD","frameworkName":"...","funnel":"tof/mof/bof","suggestedHook":"...","contentIdea":"Ide","reason":"..."}]}`;

    const response = await ai.chat.completions.create({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
    });

    const responseText = response.choices[0]?.message?.content || '';
    const resultObj = safeParseAIResponse(responseText);
    res.json(resultObj);
  } catch (error: any) {
    console.error('Error in /api/ai-calendar-plan:', error);
    res.status(500).json({ error: error.message || 'Fatal error during AI calendar plan.' });
  }
});

// --- AI Calendar Idea ---
app.post('/api/ai-calendar-idea', async (req, res) => {
  try {
    const { product, audience, existingCalendar, date } = req.body;
    const ai = getDeepSeekClient();

    const calendarContext = existingCalendar && Object.keys(existingCalendar).length > 0
      ? Object.entries(existingCalendar)
          .map(([d, entry]: any) => `${d}: ${entry.title} (${entry.funnel})`)
          .slice(-7).join('\n')
      : 'Belum ada jadwal terisi.';

    const prompt = `Ide konten untuk ${date}.
Produk: ${product || '-'}
Audiens: ${audience || '-'}
Jadwal 7 hari terakhir: ${calendarContext}

BALAS HANYA JSON:
{"frameworkName":"...","funnel":"tof/mof/bof","hookType":"...","contentIdea":"Ide konten","estimatedScore":80,"tip":"Saran"}`;

    const response = await ai.chat.completions.create({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
    });

    const responseText = response.choices[0]?.message?.content || '';
    const resultObj = safeParseAIResponse(responseText);
    res.json(resultObj);
  } catch (error: any) {
    console.error('Error in /api/ai-calendar-idea:', error);
    res.status(500).json({ error: error.message || 'Fatal error during AI calendar idea.' });
  }
});

// --- AI Retention Prediction ---
app.post('/api/ai-retention', async (req, res) => {
  try {
    const { script, framework, caption, hashtags, hookType } = req.body;
    if (!script) {
      return res.status(400).json({ error: 'Script is required' });
    }

    const ai = getDeepSeekClient();

    const prompt = `Analisis retention script TikTok/Reels.
Framework: "${framework?.name || '-'}" (${framework?.funnel?.toUpperCase() || '-'})
Caption: ${caption || '-'}
Hashtags: ${hashtags ? hashtags.join(', ') : '-'}
Hook: ${hookType || '-'}

SCRIPT:
${script}

Beri prediksi retention di detik 0,3,10,20,30,45,60.
BALAS HANYA JSON:
{"points":[{"second":0,"retention":100},{"second":3,"retention":80},{"second":10,"retention":60},{"second":20,"retention":50},{"second":30,"retention":40},{"second":45,"retention":30},{"second":60,"retention":20}],"analysis":"..."}`;

    const response = await ai.chat.completions.create({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
    });

    const responseText = response.choices[0]?.message?.content || '';
    const resultObj = safeParseAIResponse(responseText);
    res.json(resultObj);
  } catch (error: any) {
    console.error('Error in /api/ai-retention:', error);
    res.status(500).json({ error: error.message || 'Fatal error during AI retention analysis.' });
  }
});

// --- AI Caption Generator ---
app.post('/api/ai-caption', async (req, res) => {
  try {
    const { script, product, audience, tone } = req.body;
    if (!script) {
      return res.status(400).json({ error: 'Script is required' });
    }

    const ai = getDeepSeekClient();

    const prompt = `Buat 3 caption TikTok/Reels untuk script berikut.
Produk: ${product || '-'}
Audiens: ${audience || '-'}
Tone: ${tone || 'edukatif'}
Script: ${script.slice(0, 500)}

BALAS HANYA JSON:
{"captions":["Caption 1 ~150-250 karakter","Caption 2","Caption 3"]}`;

    const response = await ai.chat.completions.create({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
    });

    const responseText = response.choices[0]?.message?.content || '';
    const resultObj = safeParseAIResponse(responseText);
    res.json(resultObj);
  } catch (error: any) {
    console.error('Error in /api/ai-caption:', error);
    res.status(500).json({ error: error.message || 'Fatal error during AI caption generation.' });
  }
});

// --- AI Hashtag Recommender ---
app.post('/api/ai-hashtags', async (req, res) => {
  try {
    const { script, caption, product, audience } = req.body;
    if (!script && !caption) {
      return res.status(400).json({ error: 'Script or caption is required' });
    }

    const ai = getDeepSeekClient();
    const textSample = (script || caption || '').slice(0, 300);

    const prompt = `Beri 10 hashtag TikTok untuk konten berikut.
Produk: ${product || '-'}
Audiens: ${audience || '-'}
Konten: ${textSample}

BALAS HANYA JSON:
{"hashtags":["#hashtag1","#hashtag2","#hashtag3","#hashtag4","#hashtag5","#hashtag6","#hashtag7","#hashtag8","#hashtag9","#hashtag10"],"categories":["Mega","Medium","Niche"]}`;

    const response = await ai.chat.completions.create({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.5,
    });

    const responseText = response.choices[0]?.message?.content || '';
    const resultObj = safeParseAIResponse(responseText);
    res.json(resultObj);
  } catch (error: any) {
    console.error('Error in /api/ai-hashtags:', error);
    res.status(500).json({ error: error.message || 'Fatal error during AI hashtag generation.' });
  }
});

// --- Personalized Insights ---
app.post('/api/personalized-insights', insightsLimiter, async (req, res) => {
  try {
    const parseResult = PersonalizedInsightsSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Validasi input gagal',
        details: parseResult.error.issues.map(i => ({ field: i.path.join('.'), message: i.message }))
      });
    }

    const { savedScripts, profileInfo } = parseResult.data;
    const ai = getDeepSeekClient();

    let scriptsContext = 'Belum ada riwayat.';
    if (savedScripts && savedScripts.length > 0) {
      scriptsContext = savedScripts.map((s: any, idx: number) =>
        `#${idx+1}: ${s.title} (${s.framework?.name}) Score: ${s.scores?.overall || 0}`
      ).join('\n');
    }

    const clientPrompt = `Analisis portofolio konten pengguna:
${scriptsContext}
Produk: ${profileInfo?.product || '-'}
Audiens: ${profileInfo?.audience || '-'}

BALAS HANYA JSON:
{"generalScoreText":"...","contentFunnelBalance":{"tofPct":50,"mofPct":30,"bofPct":20,"diagnosisText":"..."},"strengths":["..."],"gaps":["..."],"recommendations":[{"title":"...","action":"...","priority":"Tinggi"}],"aiRecommendedAvenue":{"recommendedFramework":"...","themeConcept":"..."}}`;

    const response = await ai.chat.completions.create({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: clientPrompt }],
      temperature: 0.7,
    });

    const responseText = response.choices[0]?.message?.content || '';
    const resultObj = safeParseAIResponse(responseText);
    res.json(resultObj);
  } catch (error: any) {
    console.error('Error in /api/personalized-insights:', error);
    res.status(500).json({ error: error.message || 'Fatal error generating diagnostics insights.' });
  }
});

export default app;