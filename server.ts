import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;

// ============================================================
// Environment Validation
// ============================================================
function validateEnvironment(): void {
  const requiredVars = ['DEEPSEEK_API_KEY'];
  const missing: string[] = [];

  for (const varName of requiredVars) {
    const val = process.env[varName];
    if (!val || val === '') {
      missing.push(varName);
    }
  }

  if (missing.length > 0) {
    console.warn(
      `[Buzz Pilot] Warning: Missing or placeholder environment variables: ${missing.join(', ')}. ` +
      'AI features will be unavailable until these are set.'
    );
  }
}

validateEnvironment();

// ============================================================
// Zod Schemas for Input Validation
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
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute
  message: { error: 'Terlalu banyak permintaan. Silakan tunggu 1 menit.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const insightsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5, // 5 requests per minute
  message: { error: 'Terlalu banyak permintaan insight. Silakan tunggu 1 menit.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ============================================================
// DeepSeek Client (OpenAI-compatible)
// ============================================================
let aiInstance: OpenAI | null = null;

function getDeepSeekClient(): OpenAI {
  if (!aiInstance) {
    const key = process.env.DEEPSEEK_API_KEY;
    if (!key || key === '') {
      throw new Error('DEEPSEEK_API_KEY is required. Please set it in Settings > Secrets or the env file.');
    }
    aiInstance = new OpenAI({
      apiKey: key,
      baseURL: 'https://api.deepseek.com',
    });
  }
  return aiInstance;
}

/**
 * Safely parse JSON from AI response, handling markdown code block wrappers
 * and other common LLM output quirks.
 */
function safeParseAIResponse(responseText: string): any {
  if (!responseText || responseText.trim() === '') {
    throw new Error('AI mengembalikan respons kosong.');
  }

  let cleaned = responseText.trim();

  // Remove markdown code block fences: ```json ... ``` or ``` ... ```
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/g, '').trim();

  // Try direct JSON parse first
  try {
    return JSON.parse(cleaned);
  } catch {
    // If that fails, try to extract a JSON object from the text
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch {
        // fall through to error
      }
    }

    // Also try array extraction as fallback
    const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      try {
        return JSON.parse(arrayMatch[0]);
      } catch {
        // fall through to error
      }
    }

    throw new Error(
      `AI mengembalikan respons yang tidak valid. Respons mentah: ${responseText.slice(0, 200)}...`
    );
  }
}

// ============================================================
// Server Startup
// ============================================================
async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' })); // Limit payload size

  // === API ENDPOINTS ===

  // 1. Check server environment & security secrets presence
  app.get('/api/health', (_req, res) => {
    const hasDeepSeekKey = !!process.env.DEEPSEEK_API_KEY && process.env.DEEPSEEK_API_KEY !== '';
    const hasSupabaseUrl = !!process.env.VITE_SUPABASE_URL;
    res.json({
      status: 'ok',
      hasDeepSeekKey,
      hasSupabaseUrl,
      dbMode: hasSupabaseUrl ? 'supabase' : 'local_sandbox'
    });
  });

  // 2. Fully Secure Server-Side AI Script Generation (DeepSeek)
  app.post('/api/ai-generate', aiGenerateLimiter, async (req, res) => {
    try {
      // Validate input with Zod
      const parseResult = AIGenerateSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          error: 'Validasi input gagal',
          details: parseResult.error.issues.map(i => ({
            field: i.path.join('.'),
            message: i.message
          }))
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
          {
            role: 'system',
            content: 'Kamu adalah asisten penulis skenario konten TikTok/Reels profesional. Pastikan output selalu berupa objek JSON valid dan tidak ada teks pembuka atau penutup lain di luar JSON.'
          },
          {
            role: 'user',
            content: systemPrompt
          }
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

  // 3. AI-Powered Script Score Validator (Real-time Analysis)
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

      const prompt = `Kamu adalah AI Script Analyzer untuk konten TikTok/Reels. Analisis script berikut secara kritis dan beri skor.

Framework: "${framework.name}" (${framework.funnel.toUpperCase()})
Steps Framework:
${stepsContext || 'N/A'}

Isian Per-Step:
${partsContext}

Caption Terkait: ${caption || 'Tidak ada'}
Hashtags: ${hashtags ? hashtags.join(', ') : 'Tidak ada'}
Hook Type: ${hookType || 'Tidak dipilih'}

SCRIPT YANG DIANALISIS:
"""
${script}
"""

Beri skor 0-100 untuk setiap kategori berikut berdasarkan analisis teks nyata (bukan tebakan):
1. Hook Strength (0-100): Apakah 3 detik pertama cukup kuat menarik perhatian? Analisis trigger words, pertanyaan, kejutan.
2. Readability (0-100): Apakah struktur kalimat mudah dicerna? Panjang kalimat, variasi, alur baca.
3. SEO & Keyword Optimization (0-100): Apakah ada kata kunci yang relevan? Cocok dengan caption dan hashtag?
4. Emotional Engagement (0-100): Apakah ada kata-kata emosi yang kuat? Apakah audiens akan merasa tersentuh?
5. CTA Persuasiveness (0-100): Apakah ajakan bertindak jelas dan meyakinkan? Apakah posisinya strategis?

Kritik dengan jujur. Beri skor rendah jika memang kurang.

Balas HANYA dengan JSON:
{
  "aiHookScore": number 0-100,
  "aiReadScore": number 0-100,
  "aiSeoScore": number 0-100,
  "aiEmotionScore": number 0-100,
  "aiCtaScore": number 0-100,
  "aiOverall": number 0-100,
  "feedback": "Ringkasan 1-2 kalimat tentang kualitas script ini",
  "suggestions": ["Saran konkret 1", "Saran konkret 2", "Saran konkret 3"],
  "hookAnalysis": "Analisis hook: apa yang kurang/baik",
  "readabilityAnalysis": "Analisis readability: apakah mudah dibaca?",
  "emotionAnalysis": "Analisis emosi: apa yang bisa ditingkatkan?",
  "ctaAnalysis": "Analisis CTA: apakah cukup persuasif?"
}`;

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

  // 4. AI-Powered Calendar Plan Generator (30-Day Strategy)
  app.post('/api/ai-calendar-plan', async (req, res) => {
    try {
      const { month, year, savedScripts, product, audience } = req.body;
      const ai = getDeepSeekClient();

      const scriptsContext = savedScripts && savedScripts.length > 0
        ? savedScripts.map((s: any) => `${s.title}: ${s.framework?.name} (Score: ${s.scores?.overall || 'N/A'})`).join('\n')
        : 'Belum ada script tersimpan.';

      const prompt = `Kamu adalah AI Content Strategist. Buat rencana konten 30 hari untuk bulan ${month} ${year}.

Profil Pengguna:
- Produk: ${product || 'Belum ditentukan'}
- Audiens: ${audience || 'Belum ditentukan'}

Riwayat konten sebelumnya (referensi untuk menghindari repetisi):
${scriptsContext}

Buat 30 hari rencana dengan struktur:
- Hari 1-30
- 45% TOF (Top of Funnel) untuk awareness
- 30% MOF (Middle of Funnel) untuk kredibilitas
- 25% BOF (Bottom of Funnel) untuk konversi

Setiap hari harus punya framework berbeda. Gunakan variasi dari 50 framework pemasaran yang ada (seperti Problem-Agitate-Solution, Before-After-Bridge, AIDA, PAS, dll).

Balas HANYA dengan JSON:
{
  "month": "${month}",
  "year": ${year},
  "days": [
    {
      "day": 1,
      "date": "YYYY-MM-DD",
      "frameworkName": "Nama Framework",
      "funnel": "tof/mof/bof",
      "suggestedHook": "Contoh hook untuk hari ini",
      "contentIdea": "Ide konten spesifik untuk hari ini",
      "reason": "Kenapa konten ini cocok"
    }
  ]
}`;

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

  // 5. AI Content Idea Generator for a Specific Day
  app.post('/api/ai-calendar-idea', async (req, res) => {
    try {
      const { product, audience, existingCalendar, date } = req.body;
      const ai = getDeepSeekClient();

      const calendarContext = existingCalendar && Object.keys(existingCalendar).length > 0
        ? Object.entries(existingCalendar)
            .map(([d, entry]: any) => `${d}: ${entry.title} (${entry.funnel})`)
            .slice(-7).join('\n')
        : 'Belum ada jadwal terisi.';

      const prompt = `Kamu adalah AI Content Strategist. Beri ide konten untuk tanggal ${date}.

Profil:
- Produk: ${product || 'Umum'}
- Audiens: ${audience || 'Umum'}

Jadwal 7 hari terakhir yang sudah terisi (hindari repetisi):
${calendarContext}

Beri 1 ide konten spesifik yang fresh dan sesuai dengan funnel yang cocok.
Balas HANYA dengan JSON:
{
  "frameworkName": "Nama framework terbaik",
  "funnel": "tof/mof/bof",
  "hookType": "Tipe hook yang cocok",
  "contentIdea": "Ide konten 1-2 kalimat",
  "estimatedScore": 0-100,
  "tip": "Saran eksekusi"
}`;

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

  // 6. AI-Powered Retention Prediction Graph (Real Analysis)
  app.post('/api/ai-retention', async (req, res) => {
    try {
      const { script, framework, caption, hashtags, hookType } = req.body;
      if (!script) {
        return res.status(400).json({ error: 'Script is required' });
      }

      const ai = getDeepSeekClient();

      const prompt = `Kamu adalah AI Content Retention Analyst. Analisis script TikTok/Reels berikut dan prediksi retention rate (persentase penonton yang bertahan) di setiap detik.

Framework: "${framework?.name || 'N/A'}" (${framework?.funnel?.toUpperCase() || 'N/A'})
Caption: ${caption || 'Tidak ada'}
Hashtags: ${hashtags ? hashtags.join(', ') : 'Tidak ada'}
Hook Type: ${hookType || 'Tidak dipilih'}

SCRIPT:
"""
${script}
"""

Analisis secara kritis:
1. **Detik 0-3 (Hook)**: Apakah hook cukup kuat? Prediksi berapa % penonton bertahan setelah hook.
2. **Detik 3-15**: Apakah konten engaging? Apakah ada value yang bikin orang tetap nonton?
3. **Detik 15-30**: Apakah ada emotional hooks, storytelling, atau informasi baru?
4. **Detik 30-45**: Apakah audiens masih terlibat? Atau mulai boring?
5. **Detik 45-60**: Apakah CTA cukup kuat untuk bikin orang bertahan sampai akhir?

Beri 7 data point prediksi retention di detik: 0, 3, 10, 20, 30, 45, 60
Retention di detik 0 harus 100. Semakin rendah skor hook/readability/emotion/CTA, semakin tajam drop-nya.

Balas HANYA dengan JSON:
{
  "points": [
    { "second": 0, "retention": 100 },
    { "second": 3, "retention": 70-90 },
    { "second": 10, "retention": 50-80 },
    { "second": 20, "retention": 40-70 },
    { "second": 30, "retention": 30-60 },
    { "second": 45, "retention": 20-50 },
    { "second": 60, "retention": 10-40 }
  ],
  "analysis": "Penjelasan singkat 1-2 kalimat tentang pola retention script ini, misal: 'Hook cukup kuat, tapi retention turun drastis di detik 15-20 karena kurang emotional trigger. CTA di akhir cukup membantu.'"
}`;

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

  // 7. AI-Generated Personalized Insights & Strategic Diagnostic Engine
  app.post('/api/personalized-insights', insightsLimiter, async (req, res) => {
    try {
      // Validate input with Zod
      const parseResult = PersonalizedInsightsSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          error: 'Validasi input gagal',
          details: parseResult.error.issues.map(i => ({
            field: i.path.join('.'),
            message: i.message
          }))
        });
      }

      const { savedScripts, profileInfo } = parseResult.data;
      const ai = getDeepSeekClient();

      let scriptsContext = 'Belum ada riwayat script tersimpan.';
      if (savedScripts && savedScripts.length > 0) {
        scriptsContext = savedScripts.map((s: any, idx: number) => {
          return `Script #${idx + 1}:
Judul: ${s.title}
Framework: ${s.framework?.name} (${s.framework?.funnel})
Analytics Score: Overall ${s.scores?.overall || 0}/100 [Hook: ${s.scores?.hookScore || 0}, Readability: ${s.scores?.readScore || 0}, SEO: ${s.scores?.seoScore || 0}, Emotion: ${s.scores?.emotionScore || 0}, CTA: ${s.scores?.ctaScore || 0}]
Script Text: "${s.script?.slice(0, 150) || ''}..."`;
        }).join('\n\n');
      }

      const clientPrompt = `Kamu adalah Konsultan Strategi Konten Senior AI. Tugasmu adalah menganalisis portofolio draf konten pengguna untuk memberikan DIAGNOSTIK KEPRIBADIAN KONTEN (Personalized Analytics Insight) yang bertenaga AI.

Berikut data rincian portofolio script pengguna saat ini:
${scriptsContext}

Detail Tambahan Pengguna:
Target Segmen / Niche Produk: ${profileInfo?.product || 'Umum'}
Deskripsi Target Audience: ${profileInfo?.audience || 'Umum'}

Susun rekomendasi taktis personalisasi ini dalam struktur JSON berikut (balas HANYA objek JSON ini):
{
  "generalScoreText": "Deskripsi singkat tingkat kemahiran konten pengguna berdasarkan data di atas (misal: 'Sangat Berfokus Pada Hook tapi Kurang CTA')",
  "contentFunnelBalance": {
    "tofPct": 50,
    "mofPct": 30,
    "bofPct": 20,
    "diagnosisText": "Ulasan seputar keseimbangan distribusi funnel konten pendek pengguna"
  },
  "strengths": [
    "Kelebihan utama draf naskah mereka (misal: 'Pemilihan kata emosi kuat', 'Opening memikat')"
  ],
  "gaps": [
    "Celah pertumbuhan / kekurangan krusial (misal: 'Rata-rata kalimat di readability terlalu panjang', 'CTA kurang persuasif')"
  ],
  "recommendations": [
    {
      "title": "Judul Taktis Rekomendasi",
      "action": "Tindakan konkret nyata untuk dipraktekkan hari ini juga",
      "priority": "Tinggi / Sedang"
    }
  ],
  "aiRecommendedAvenue": {
    "recommendedFramework": "Rekomendasi nama salah satu dari 50 framework pemasaran (e.g., Before-After-Bridge, Problem-Agitate-Solve) yang paling tepat pengguna lakukan selanjutnya",
    "themeConcept": "Konsep ide konten spesifik berdasarkan target audiens dan produk pengguna untuk dieksekusi selanjutnya"
  }
}`;

      const response = await ai.chat.completions.create({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'user',
            content: clientPrompt
          }
        ],
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

  // === DEVELOPMENT vs PRODUCTION HANDLERS ===

  if (process.env.NODE_ENV === 'production' || process.env.DISABLE_HMR === 'true') {
    // Serve static files from Vite dist in production
    const distPath = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (_req, res) => {
        res.sendFile(path.resolve(distPath, 'index.html'));
      });
    } else {
      // In case dist doesn't exist yet, serve a friendly helper
      app.get('/', (_req, res) => {
        res.status(200).send('<h1>Application is compiling, please refresh in a moment...</h1>');
      });
    }
  } else {
    // Dev Mode - Integration with Vite
    const { createServer: createViteServer } = await import('vite');
    const viteInstance = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom'
    });

    app.use(viteInstance.middlewares);

    app.get('*', async (req, res, next) => {
      try {
        const templateFile = path.resolve(__dirname, 'index.html');
        let htmlContent = fs.readFileSync(templateFile, 'utf-8');
        htmlContent = await viteInstance.transformIndexHtml(req.url, htmlContent);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(htmlContent);
      } catch (e: any) {
        viteInstance.ssrFixStacktrace(e);
        next(e);
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Buzz Pilot Server] live on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[Buzz Pilot Server Error] Failed to start:', err);
});