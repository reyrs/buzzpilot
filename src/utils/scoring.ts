// ============================================================
// Buzz Pilot — Deterministic Script Scoring Engine
// No randomness — all scores are based on actual text analysis
// ============================================================

import { ContentFramework } from '../frameworksData';
import { ScriptScores } from '../types';

// --- Constants for Analysis ---
const HOOK_TRIGGERS = [
  'jangan', 'akhirnya', 'rahasia', 'bocoran', 'terbukti',
  'pernah', 'gagal', 'berhasil', 'kaget', 'stop', 'mitos',
  'fakta', 'cara', 'tips', 'kenapa'
];

const SEO_KEYWORDS = [
  'cara', 'tips', 'terbaik', 'gratis', 'mudah', 'cepat',
  'rahasia', 'strategi', 'jitu', 'terbukti', 'viral'
];

const EMOTION_WORDS = [
  'takut', 'senang', 'marah', 'sedih', 'bangga', 'malu',
  'cemas', 'bahagia', 'kecewa', 'terkejut', 'insecure',
  'stress', 'excited'
];

const CTA_WORDS = [
  'klik', 'beli', 'daftar', 'hubungi', 'dapatkan', 'coba',
  'download', 'order', 'pesan', 'follow', 'subscribe',
  'share', 'comment', 'save', 'simpan', 'dm'
];

/**
 * Calculate deterministic scores for a script based on actual text analysis.
 * No random factors — every score is reproducible.
 */
export function calculateScores(
  script: string,
  framework: ContentFramework,
  options?: {
    selectedHookId?: string | null;
    captionText?: string;
    selectedHashtags?: string[];
    partsTexts?: string[];
  }
): ScriptScores {
  const words = script.split(/\s+/).filter(Boolean);
  const sentences = script.split(/[.!?]+/).filter(s => s.trim().length > 4);
  const wc = words.length;
  const sc = Math.max(sentences.length, 1);
  const awps = Math.round((wc / sc) * 10) / 10;
  const first10 = words.slice(0, 10).join(' ').toLowerCase();
  const scriptLower = script.toLowerCase();

  // --- Hook Score (0-100) ---
  // Based on: presence of trigger words in first 10 words, hook type selected
  const hasTrigger = HOOK_TRIGGERS.some(t => first10.includes(t));
  const hookBase = hasTrigger ? 75 : 45;
  const hookBonus = options?.selectedHookId ? 15 : 0;
  // Bonus for question marks or exclamation marks in first 50 chars
  const first50 = script.slice(0, 50);
  const punctBonus = (first50.includes('?') ? 5 : 0) + (first50.includes('!') ? 3 : 0);
  const hookScore = Math.min(97, hookBase + hookBonus + punctBonus);

  // --- Readability Score (0-100) ---
  // Based on: average words per sentence, total word count
  let readScore = 95;
  if (awps > 20) readScore -= 15;
  if (awps > 30) readScore -= 15;
  if (wc < 20) readScore -= 25;
  // Bonus for varied sentence length
  const sentenceLengths = sentences.map(s => s.split(/\s+/).filter(Boolean).length);
  const uniqueLengths = new Set(sentenceLengths).size;
  if (uniqueLengths >= 3) readScore += 5;
  readScore = Math.max(30, Math.min(100, readScore));

  // --- SEO Score (0-100) ---
  // Based on: keyword density, caption length, hashtag count
  const hits = SEO_KEYWORDS.filter(k => scriptLower.includes(k)).length;
  const capText = options?.captionText || '';
  const capBonus = capText.length > 80 ? 15 : capText.length > 30 ? 8 : 0;
  const htCount = options?.selectedHashtags?.length || 0;
  const htBonus = Math.min(15, htCount * 1.5);
  const seoScore = Math.min(97, 40 + hits * 8 + capBonus + htBonus);

  // --- Emotional Engagement Score (0-100) ---
  // Based on: presence of emotion words, exclamation marks
  const emoHits = EMOTION_WORDS.filter(e => scriptLower.includes(e)).length;
  const exclamationCount = (script.match(/!/g) || []).length;
  const emoBonus = Math.min(10, exclamationCount * 2);
  const emotionScore = Math.min(96, 35 + emoHits * 12 + emoBonus);

  // --- CTA Persuasiveness Score (0-100) ---
  // Based on: presence of CTA words, position of CTA (better near end)
  const hasCTA = CTA_WORDS.some(c => scriptLower.includes(c));
  // Check if CTA words appear in the last 30% of the script
  const lastThird = script.slice(Math.floor(script.length * 0.7));
  const ctaInEnding = CTA_WORDS.some(c => lastThird.toLowerCase().includes(c));
  const ctaScore = hasCTA
    ? (ctaInEnding ? 92 : 78) + Math.min(5, htCount)
    : 30 + Math.min(15, emoHits * 3);

  // --- Framework Completion ---
  const filledParts = (options?.partsTexts || [])
    .filter(t => t && t.trim().length > 2).length;
  const stepCov = Math.round((filledParts / framework.steps.length) * 100);

  // --- Caption & Hashtag Scores ---
  const capScore = capText.length > 20
    ? Math.min(90, 20 + hits * 10 + Math.min(30, capText.length * 0.1))
    : 0;
  const htScore = Math.min(90, htCount * 7);

  // --- Funnel Matching ---
  const fS = framework.funnel === 'tof'
    ? { tof: Math.min(96, 60 + hookScore * 0.3), mof: 35, bof: 15 }
    : framework.funnel === 'mof'
    ? { tof: 30, mof: Math.min(95, 55 + readScore * 0.3), bof: 40 }
    : { tof: 15, mof: 35, bof: Math.min(95, 55 + ctaScore * 0.3) };

  // --- Overall Score (weighted average) ---
  const overall = Math.round(
    hookScore * 0.22 +
    readScore * 0.14 +
    seoScore * 0.16 +
    emotionScore * 0.18 +
    ctaScore * 0.16 +
    stepCov * 0.08 +
    Math.min(90, capScore + htScore) * 0.06
  );

  return {
    overall,
    hookScore,
    readScore,
    seoScore,
    emotionScore,
    ctaScore,
    stepCov,
    fS,
    wc,
    sc,
    awps,
    hasCTA,
    capScore,
    htScore
  };
}
