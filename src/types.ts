// ============================================================
// Buzz Pilot — TypeScript Type Definitions
// ============================================================

// --- AI Generation Types ---
export interface AIGenerationResult {
  script: string;
  sections: { label: string; text: string }[];
  hook_type: string;
  caption: string;
  hashtags: string[];
  why_it_works: string;
  estimated_duration: number;
}

export interface PersonalizedInsightResult {
  generalScoreText: string;
  contentFunnelBalance: {
    tofPct: number;
    mofPct: number;
    bofPct: number;
    diagnosisText: string;
  };
  strengths: string[];
  gaps: string[];
  recommendations: { title: string; action: string; priority: string }[];
  aiRecommendedAvenue: {
    recommendedFramework: string;
    themeConcept: string;
  };
}

// --- AI Score Validation Types ---
export interface AIScoreResult {
  aiHookScore: number;
  aiReadScore: number;
  aiSeoScore: number;
  aiEmotionScore: number;
  aiCtaScore: number;
  aiOverall: number;
  feedback: string;
  suggestions: string[];
  hookAnalysis: string;
  readabilityAnalysis: string;
  emotionAnalysis: string;
  ctaAnalysis: string;
}

// --- AI Calendar Plan Types ---
export interface AICalendarDayPlan {
  day: number;
  date: string;
  frameworkName: string;
  funnel: 'tof' | 'mof' | 'bof';
  suggestedHook: string;
  contentIdea: string;
  reason: string;
}

export interface AICalendarPlanResult {
  month: string;
  year: number;
  days: AICalendarDayPlan[];
}

export interface AICalendarIdeaResult {
  frameworkName: string;
  funnel: string;
  hookType: string;
  contentIdea: string;
  estimatedScore: number;
  tip: string;
}

// --- AI Retention Types ---
export interface AIRetentionPoint {
  second: number;
  retention: number;
}

export interface AIRetentionResult {
  points: AIRetentionPoint[];
  analysis: string;
}

// --- Scoring Types ---
export interface ScriptScores {
  overall: number;
  hookScore: number;
  readScore: number;
  seoScore: number;
  emotionScore: number;
  ctaScore: number;
  stepCov: number;
  fS: { tof: number; mof: number; bof: number };
  wc: number;
  sc: number;
  awps: number;
  hasCTA: boolean;
  capScore: number;
  htScore: number;
}

// --- Saved Script Types ---
export interface SavedScript {
  id: number;
  title: string;
  script: string;
  framework: {
    id: number;
    name: string;
    funnel: 'tof' | 'mof' | 'bof';
  };
  scores: ScriptScores;
  caption: string;
  hashtags: string[];
  savedAt: string;
}

// --- Calendar Types ---
export interface CalendarEntry {
  savedId?: number | null;
  title?: string | null;
  fwName?: string | null;
  fwId?: number | null;
  funnel?: 'tof' | 'mof' | 'bof';
  score?: number | null;
  note?: string | null;
}

export type CalendarData = Record<string, CalendarEntry>;

// --- Backend Health Types ---
export interface BackendHealth {
  status: string;
  hasDeepSeekKey?: boolean;
  hasGeminiKey?: boolean;
  hasSupabaseUrl: boolean;
  dbMode: 'supabase' | 'local_sandbox';
}

// --- Navigation Types ---
export type TabId = 'frameworks' | 'builder' | 'analyzer' | 'saved' | 'ai' | 'calendar' | 'progress';

// --- Auth Types ---
export interface AuthFormData {
  email: string;
  password: string;
}