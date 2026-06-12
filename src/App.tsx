import React, { useState, useEffect, useRef } from 'react';
import { 
  Compass, Layout, BarChart3, Save, Sparkles, Calendar as CalendarIcon, 
  TrendingUp, Download, Eye, RotateCcw, AlertCircle, CheckCircle2, 
  HelpCircle, Copy, Check, LogIn, Database, Menu, X, ArrowRight, Sun, Moon
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { createClient } from '@supabase/supabase-js';
import { FW, HOOK_TYPES, HT_DATA, ContentFramework } from './frameworksData';
import { calculateScores as calcScores } from './utils/scoring';
import type { AIScoreResult } from './types';

// Initialize Supabase Client if env variables exist
const sbUrl = (import.meta as any).env.VITE_SUPABASE_URL || '';
const sbKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY || '';

const isValidSupabaseUrl = (url: string): boolean => {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch (_) {
    return false;
  }
};

const supabase = sbUrl && sbKey && isValidSupabaseUrl(sbUrl) ? createClient(sbUrl, sbKey) : null;

export default function App() {
  // Navigation & View
  const [activeTab, setActiveTab] = useState<'frameworks' | 'builder' | 'analyzer' | 'saved' | 'ai' | 'calendar' | 'progress'>('frameworks');
  
  // Theme state
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('buzzpilot_theme');
      if (saved) return saved === 'dark';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('buzzpilot_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('buzzpilot_theme', 'light');
    }
  }, [isDarkMode]);
  
  // Framework state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFunnel, setSelectedFunnel] = useState<'all' | 'tof' | 'mof' | 'bof'>('all');
  const [selectedFW, setSelectedFW] = useState<ContentFramework | null>(null);

  // Script Builder states
  const [selectedHookId, setSelectedHookId] = useState<string | null>(null);
  const [customHookText, setCustomHookText] = useState('');
  const [partsTexts, setPartsTexts] = useState<string[]>([]);
  const [scriptText, setScriptText] = useState('');
  const [isManualScriptEdit, setIsManualScriptEdit] = useState(false);
  const [captionText, setCaptionText] = useState('');
  const [selectedHashtags, setSelectedHashtags] = useState<string[]>([]);
  const [hashtagSearch, setHashtagSearch] = useState('');

  // Dashboard & Personalized Insights states
  const [profileProduct, setProfileProduct] = useState('');
  const [profileAudience, setProfileAudience] = useState('');
  const [profilePain, setProfilePain] = useState('');
  const [insightsResult, setInsightsResult] = useState<any>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);

  // AI Script Generator states
  const [aiProduct, setAiProduct] = useState('');
  const [aiAudience, setAiAudience] = useState('');
  const [aiPain, setAiPain] = useState('');
  const [aiTone, setAiTone] = useState('edukatif');
  const [aiSelectedFW, setAiSelectedFW] = useState<ContentFramework | null>(null);
  const [aiGenerationResult, setAiGenerationResult] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState(false);

  // Calendar states
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [calendarData, setCalendarData] = useState<{ [key: string]: any }>({});
  const [calDateSelection, setCalDateSelection] = useState<string | null>(null);
  const [calNoteInput, setCalNoteInput] = useState('');
  const [calSelSavedId, setCalSelSavedId] = useState<number | null>(null);
  const [calSelFWId, setCalSelFWId] = useState<number | null>(null);
  const [calTabMode, setCalTabMode] = useState<'saved' | 'fw'>('saved');

  // Database Connection & Auth states
  const [backendHealth, setBackendHealth] = useState<any>(null);
  const [savedScripts, setSavedScripts] = useState<any[]>([]);
  const [session, setSession] = useState<any>(null);
  const [userEmail, setUserEmail] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showSupabaseModal, setShowSupabaseModal] = useState(false);

  // General UI states
  const [toastMsg, setToastMsg] = useState('');
  const [toastOpen, setToastOpen] = useState(false);
  const [showRenameModalId, setShowRenameModalId] = useState<number | null>(null);
  const [renameInput, setRenameInput] = useState('');
  const [showSaveConfirmModal, setShowSaveConfirmModal] = useState(false);
  const [saveConfirmTitle, setSaveConfirmTitle] = useState('');

  // Refs for Charts
  const retentionCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const progressCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // --- TOAST TRIGGER ---
  const launchToast = (msg: string) => {
    setToastMsg(msg);
    setToastOpen(true);
    setTimeout(() => setToastOpen(false), 3000);
  };

  // --- INITIALIZE & FETCH ENVIRONMENT ---
  useEffect(() => {
    const fetchEnvStatus = async () => {
      try {
        const r = await fetch('/api/health');
        const data = await r.json();
        setBackendHealth(data);
      } catch (err) {
        console.warn('Backend server unreached. Defaulting to local client fallback.');
      }
    };
    fetchEnvStatus();

    // Fetch user scripts & load calendar from LocalStorage fallback
    const localScripts = JSON.parse(localStorage.getItem('buzzpilot_saved') || '[]');
    setSavedScripts(localScripts);

    const localCal = JSON.parse(localStorage.getItem('buzzpilot_calendar') || '{}');
    setCalendarData(localCal);

    // Grab Supabase session if configured
    if (supabase) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        setSession(session);
        if (session) syncWithSupabase(session.user.id);
      });
      supabase.auth.onAuthStateChange((_event, session) => {
        setSession(session);
        if (session) syncWithSupabase(session.user.id);
      });
    }
  }, []);

  // Sync state between Supabase and LocalStorage
  const syncWithSupabase = async (userId: string) => {
    if (!supabase) return;
    try {
      const { data: scripts, error: scriptsError } = await supabase
        .from('buzzpilot_scripts')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (scripts && !scriptsError) {
        setSavedScripts(scripts);
        localStorage.setItem('buzzpilot_saved', JSON.stringify(scripts));
      }

      const { data: cal, error: calError } = await supabase
        .from('buzzpilot_calendar')
        .select('*')
        .eq('user_id', userId);

      if (cal && !calError) {
        const calMap: { [key: string]: any } = {};
        cal.forEach((item: any) => {
          calMap[item.date_key] = {
            savedId: item.saved_id,
            title: item.title,
            fwName: item.fw_name,
            fwId: item.fw_id,
            funnel: item.funnel,
            score: item.score,
            note: item.note
          };
        });
        setCalendarData(calMap);
        localStorage.setItem('buzzpilot_calendar', JSON.stringify(calMap));
      }
    } catch (err) {
      console.error('Supabase query sync failed:', err);
    }
  };

  // --- AI Scoring State ---
  const [aiScoreResult, setAiScoreResult] = useState<AIScoreResult | null>(null);
  const [aiScoreLoading, setAiScoreLoading] = useState(false);
  const aiScoreTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- AI Retention State ---
  const [aiRetention, setAiRetention] = useState<{ points: { second: number; retention: number }[]; analysis: string } | null>(null);
  const [aiRetentionLoading, setAiRetentionLoading] = useState(false);

  // --- Animation State for Scorer ---
  const [scoreAnimPhase, setScoreAnimPhase] = useState(0);
  const prevScoresRef = useRef<{ overall: number; hookScore: number; readScore: number; seoScore: number; emotionScore: number; ctaScore: number } | null>(null);

  // --- MULTI-TAB SCORING CORE: Deterministic (no random) ---
  const calculateScores = (script: string, fw: ContentFramework) => {
    return calcScores(script, fw, {
      selectedHookId,
      captionText,
      selectedHashtags,
      partsTexts,
    });
  };

  // Fetch AI Score with debounce (1.5s after user stops typing)
  const fetchAIScore = async () => {
    if (!selectedFW || !scriptText.trim()) return;
    setAiScoreLoading(true);
    try {
      const r = await fetch('/api/ai-score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          script: scriptText,
          framework: {
            name: selectedFW.name,
            funnel: selectedFW.funnel,
            steps: selectedFW.steps,
          },
          caption: captionText,
          hashtags: selectedHashtags,
          hookType: selectedHookId === 'custom' ? customHookText : HOOK_TYPES.find(h => h.id === selectedHookId)?.name || '',
          partsTexts,
        }),
      });
      const data = await r.json();
      if (data.error) throw new Error(data.error);
      setAiScoreResult(data);
    } catch (err: any) {
      console.warn('AI Score fetch failed:', err.message);
      setAiScoreResult(null);
    } finally {
      setAiScoreLoading(false);
    }
  };

  // Fetch AI Retention Data
  const fetchAIRetention = async () => {
    if (!selectedFW || !scriptText.trim()) return;
    setAiRetentionLoading(true);
    try {
      const r = await fetch('/api/ai-retention', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          script: scriptText,
          framework: {
            name: selectedFW.name,
            funnel: selectedFW.funnel,
          },
          caption: captionText,
          hashtags: selectedHashtags,
          hookType: selectedHookId === 'custom' ? customHookText : HOOK_TYPES.find(h => h.id === selectedHookId)?.name || '',
        }),
      });
      const data = await r.json();
      if (data.error) throw new Error(data.error);
      if (data.points && data.points.length > 0) {
        setAiRetention(data);
      }
    } catch (err: any) {
      console.warn('AI Retention fetch failed:', err.message);
      setAiRetention(null);
    } finally {
      setAiRetentionLoading(false);
    }
  };

  // Debounced AI score + retention trigger when script/caption/hashtags change
  useEffect(() => {
    if (aiScoreTimerRef.current) clearTimeout(aiScoreTimerRef.current);
    if (!scriptText.trim() || !selectedFW) return;
    aiScoreTimerRef.current = setTimeout(() => {
      fetchAIScore();
      fetchAIRetention();
    }, 1500);
    return () => {
      if (aiScoreTimerRef.current) clearTimeout(aiScoreTimerRef.current);
    };
  }, [scriptText, captionText, selectedHashtags, selectedFW]);

  const currentScores = selectedFW && scriptText ? calculateScores(scriptText, selectedFW) : null;

  // Trigger staggered animation when entering analyzer or scores change
  useEffect(() => {
    if (activeTab === 'analyzer' && currentScores) {
      setScoreAnimPhase(0);
      const timers: ReturnType<typeof setTimeout>[] = [];
      // Reset phase to 0, then tick through phases with delays
      timers.push(setTimeout(() => setScoreAnimPhase(1), 100));  // header
      timers.push(setTimeout(() => setScoreAnimPhase(2), 300));  // score circle
      timers.push(setTimeout(() => setScoreAnimPhase(3), 500));  // bars
      timers.push(setTimeout(() => setScoreAnimPhase(4), 700));  // retention chart
      timers.push(setTimeout(() => setScoreAnimPhase(5), 900));  // 3 cards
      timers.push(setTimeout(() => setScoreAnimPhase(6), 1200)); // AI panel
      return () => timers.forEach(clearTimeout);
    }
  }, [activeTab, currentScores?.overall]);

  // Synchronize slot inputs (Hooks & Step text) into the main script text automatically as the user types,
  // unless they manually type in the Main Script Editor directly. This makes real-time scoring smooth!
  useEffect(() => {
    if (selectedFW && !isManualScriptEdit) {
      const hookVal = selectedHookId === 'custom' 
        ? customHookText 
        : HOOK_TYPES.find(h => h.id === selectedHookId)?.ex || '';
      const full = [hookVal, ...partsTexts].filter(Boolean).join('\n\n');
      setScriptText(full);
    }
  }, [selectedHookId, customHookText, partsTexts, selectedFW, isManualScriptEdit]);

  // --- RENDER DYNAMIC ANALYTICS CANVAS ON MOUNT/UPDATE ---
  useEffect(() => {
    if (activeTab === 'analyzer' && currentScores && selectedFW) {
      drawRetentionChart();
    }
  }, [activeTab, scriptText, selectedFW, isDarkMode]);

  useEffect(() => {
    if (activeTab === 'progress' && savedScripts.length >= 2) {
      drawProgressChart();
    }
  }, [activeTab, savedScripts, isDarkMode]);

  // SVG-Line / Canvas Drawing for Retention (AI-powered)
  const drawRetentionChart = () => {
    const canvas = retentionCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const W = canvas.parentElement?.offsetWidth || 650;
    const H = 220;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    // Background
    ctx.fillStyle = isDarkMode ? '#1e1b18' : '#fbfbf9'; ctx.fillRect(0, 0, W, H);

    const pad = { t: 25, r: 25, b: 35, l: 45 };
    const cw = W - pad.l - pad.r;
    const ch = H - pad.t - pad.b;

    // Grid lines & labels
    ctx.strokeStyle = isDarkMode ? '#2e2a24' : '#e2e2dd'; ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = pad.t + ch - (ch * i) / 4;
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(pad.l + cw, y); ctx.stroke();
      ctx.fillStyle = isDarkMode ? '#9b9690' : '#7a7a72'; ctx.font = '10px sans-serif'; ctx.textAlign = 'right';
      ctx.fillText((i * 25) + '%', pad.l - 8, y + 4);
    }

    // Use AI retention data if available, otherwise fallback to simulated
    let retentionPoints: { second: number; retention: number }[];
    if (aiRetention && aiRetention.points && aiRetention.points.length > 0) {
      retentionPoints = aiRetention.points;
    } else {
      // Fallback: use currentScores to create basic curve
      const hookRet = currentScores ? currentScores.hookScore / 100 : 0.7;
      const readRet = currentScores ? currentScores.readScore / 100 : 0.6;
      const ctaRet = currentScores ? currentScores.ctaScore / 100 : 0.5;
      retentionPoints = [
        { second: 0, retention: 100 },
        { second: 3, retention: Math.round(hookRet * 85 + 10) },
        { second: 10, retention: Math.round(hookRet * readRet * 75) },
        { second: 20, retention: Math.round(hookRet * readRet * 60) },
        { second: 30, retention: Math.round(hookRet * readRet * 45) },
        { second: 45, retention: Math.round(hookRet * readRet * ctaRet * 38) },
        { second: 60, retention: Math.round(hookRet * readRet * ctaRet * 25) },
      ];
    }

    // X-axis: map seconds to pixels (max 60 seconds)
    const maxSeconds = 60;
    const points: { x: number; y: number }[] = retentionPoints.map(p => ({
      x: pad.l + (p.second / maxSeconds) * cw,
      y: pad.t + ch - (p.retention / 100) * ch,
    }));

    // Interpolate intermediate points for smooth curve
    const smoothPoints: { x: number; y: number }[] = [];
    const interpolationSteps = 20;
    for (let i = 0; i <= interpolationSteps; i++) {
      const t = i / interpolationSteps;
      // Find the two surrounding data points and lerp
      const totalSegments = retentionPoints.length - 1;
      const segFloat = t * totalSegments;
      const segIndex = Math.min(Math.floor(segFloat), totalSegments - 1);
      const segT = segFloat - segIndex;
      const p1 = points[segIndex];
      const p2 = points[segIndex + 1];
      if (!p1 || !p2) continue;
      // Smooth cubic bezier-like interpolation
      const smoothT = segT * segT * (3 - 2 * segT); // smoothstep
      smoothPoints.push({
        x: p1.x + (p2.x - p1.x) * segT,
        y: p1.y + (p2.y - p1.y) * smoothT,
      });
    }

    if (smoothPoints.length < 2) return;

    // Gradient fill under curve
    const areaGrad = ctx.createLinearGradient(0, pad.t, 0, pad.t + ch);
    areaGrad.addColorStop(0, isDarkMode ? 'rgba(151, 133, 255, 0.18)' : 'rgba(123, 104, 238, 0.18)');
    areaGrad.addColorStop(1, 'rgba(123, 104, 238, 0.0)');
    ctx.beginPath(); ctx.moveTo(pad.l, pad.t + ch);
    smoothPoints.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.lineTo(smoothPoints[smoothPoints.length - 1].x, pad.t + ch); ctx.closePath();
    ctx.fillStyle = areaGrad; ctx.fill();

    // Curve stroke
    ctx.strokeStyle = isDarkMode ? '#9785ff' : '#7b68ee'; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
    ctx.beginPath();
    smoothPoints.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
    ctx.stroke();

    // Draw data point dots with labels
    points.forEach((p, idx) => {
      // Circle
      ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = idx === 0 ? '#22c897' : (retentionPoints[idx]?.retention < 30 ? '#e8476a' : '#7b68ee');
      ctx.fill(); ctx.strokeStyle = isDarkMode ? '#1e1b18' : 'white'; ctx.lineWidth = 1.5; ctx.stroke();
      // Label
      if (idx % 2 === 0 || idx === points.length - 1) {
        ctx.fillStyle = isDarkMode ? '#c4bfb8' : '#5a5650';
        ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(`${retentionPoints[idx]?.second || 0}s`, p.x, pad.t + ch + 14);
      }
    });

    // "AI Analyzed" badge
    if (aiRetention && aiRetention.points) {
      ctx.fillStyle = isDarkMode ? '#9785ff' : '#7b68ee';
      ctx.font = 'bold 8px sans-serif'; ctx.textAlign = 'right';
      ctx.fillText('⚡ AI Analysis', pad.l + cw, pad.t - 8);
    }
  };

  const drawProgressChart = () => {
    const canvas = progressCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const W = canvas.parentElement?.offsetWidth || 650;
    const H = 200;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    ctx.fillStyle = isDarkMode ? '#1e1b18' : '#fbfbf9'; ctx.fillRect(0, 0, W, H);

    const pad = { t: 25, r: 25, b: 35, l: 45 };
    const cw = W - pad.l - pad.r;
    const ch = H - pad.t - pad.b;

    // Grid lines & labels
    ctx.strokeStyle = isDarkMode ? '#2e2a24' : '#e2e2dd'; ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = pad.t + ch - (ch * i) / 4;
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(pad.l + cw, y); ctx.stroke();
      ctx.fillStyle = isDarkMode ? '#9b9690' : '#7a7a72'; ctx.font = '10px sans-serif'; ctx.textAlign = 'right';
      ctx.fillText((i * 25).toString(), pad.l - 8, y + 4);
    }

    const activeList = [...savedScripts].reverse();
    const len = activeList.length;
    if (len < 2) return;

    const stepX = cw / (len - 1);
    const points = activeList.map((s, idx) => {
      const sc = s.scores?.overall || 60;
      const x = pad.l + idx * stepX;
      const y = pad.t + ch - (ch * sc) / 100;
      return { x, y, score: sc };
    });

    // Area
    ctx.beginPath(); ctx.moveTo(pad.l, pad.t + ch);
    points.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.lineTo(points[points.length - 1].x, pad.t + ch); ctx.closePath();
    ctx.fillStyle = isDarkMode ? 'rgba(151, 133, 255, 0.1)' : 'rgba(123, 104, 238, 0.1)'; ctx.fill();

    // Stroke
    ctx.strokeStyle = isDarkMode ? '#9785ff' : '#7b68ee'; ctx.lineWidth = 2.5;
    ctx.beginPath();
    points.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
    ctx.stroke();

    // Node circles with text
    points.forEach((p, idx) => {
      ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = p.score >= 80 ? '#16a34a' : p.score >= 60 ? '#f0921a' : '#e8476a';
      ctx.fill(); ctx.strokeStyle = isDarkMode ? '#1e1b18' : 'white'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = isDarkMode ? '#f5f3ef' : '#1a1814'; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(p.score.toString(), p.x, p.y - 10);
    });
  };

  // --- ACTIONS & DIALOG HANDLERS ---
  const saveFinalContent = () => {
    if (!selectedFW || !scriptText.trim()) {
      launchToast('Script kosong. Harap tulis script terlebih dahulu!');
      return;
    }
    setSaveConfirmTitle(`${selectedFW.name} — ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`);
    setShowSaveConfirmModal(true);
  };

  const confirmSaveAction = async () => {
    const scoresObj = calculateScores(scriptText, selectedFW!);
    const newEntry = {
      id: Date.now(),
      title: saveConfirmTitle.trim() || 'Review Script ' + Date.now(),
      script: scriptText,
      framework: { id: selectedFW!.id, name: selectedFW!.name, funnel: selectedFW!.funnel },
      scores: scoresObj,
      caption: captionText,
      hashtags: [...selectedHashtags],
      savedAt: new Date().toISOString()
    };

    const targetList = [newEntry, ...savedScripts];

    if (session && supabase) {
      const { error } = await supabase
        .from('buzzpilot_scripts')
        .insert({
          user_id: session.user.id,
          title: newEntry.title,
          script: newEntry.script,
          framework_id: newEntry.framework.id,
          framework_name: newEntry.framework.name,
          framework_funnel: newEntry.framework.funnel,
          scores: scoresObj,
          caption: newEntry.caption,
          hashtags: newEntry.hashtags
        });
      if (error) {
        console.warn('Supabase insert failed. Kept locally.', error);
        launchToast('Gagal upload ke Supabase table. Tersimpan lokal.');
      } else {
        launchToast('Content viral tersimpan online ke database Supabase!');
      }
      syncWithSupabase(session.user.id);
    } else {
      localStorage.setItem('buzzpilot_saved', JSON.stringify(targetList));
      setSavedScripts(targetList);
      launchToast('Content viral berhasil disimpan lokal ke Sandbox!');
    }
    setShowSaveConfirmModal(false);
  };

  const deleteScript = async (id: number) => {
    if (session && supabase) {
      const { error } = await supabase
        .from('buzzpilot_scripts')
        .delete()
        .eq('id', id);
      if (error) launchToast('Gagal menghapus online.');
      syncWithSupabase(session.user.id);
    } else {
      const filtered = savedScripts.filter(s => s.id !== id);
      localStorage.setItem('buzzpilot_saved', JSON.stringify(filtered));
      setSavedScripts(filtered);
      launchToast('Script terhapus di Sandbox.');
    }
  };

  const renameScript = async (id: number) => {
    if (!renameInput.trim()) return;
    if (session && supabase) {
      const { error } = await supabase
        .from('buzzpilot_scripts')
        .update({ title: renameInput.trim() })
        .eq('id', id);
      if (error) launchToast('Gagal rename online');
      syncWithSupabase(session.user.id);
    } else {
      const updated = savedScripts.map(s => s.id === id ? { ...s, title: renameInput.trim() } : s);
      localStorage.setItem('buzzpilot_saved', JSON.stringify(updated));
      setSavedScripts(updated);
      launchToast('Judul script diperbarui.');
    }
    setShowRenameModalId(null);
  };

  const loadSavedScriptToBuilder = (item: any) => {
    const fw = FW.find(f => f.id === item.framework.id);
    if (!fw) return;
    setSelectedFW(fw);
    setScriptText(item.script);
    setCaptionText(item.caption || '');
    setSelectedHashtags(item.hashtags || []);
    setPartsTexts([]);
    setIsManualScriptEdit(true);
    setActiveTab('builder');
    launchToast(`"${item.title}" di-load kesetelan Builder.`);
  };

  // --- AI Calendar Plan State ---
  const [aiCalendarLoading, setAiCalendarLoading] = useState(false);

  const fillCalendarWithAIPlan = async () => {
    setAiCalendarLoading(true);
    try {
      const monthNames = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
      const totalDays = getDaysInMonth(calYear, calMonth);
      const batchSize = 7;
      const updated = { ...calendarData };
      let successCount = 0;

      for (let startDay = 1; startDay <= totalDays; startDay += batchSize) {
        const daysCount = Math.min(batchSize, totalDays - startDay + 1);
        
        const r = await fetch('/api/ai-calendar-plan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            month: monthNames[calMonth],
            year: calYear,
            startDay,
            daysCount,
            savedScripts,
            product: profileProduct || 'Belum ditentukan',
            audience: profileAudience || 'Belum ditentukan',
          }),
        });
        const data = await r.json();
        if (data.error) throw new Error(data.error);
        
        if (data.days && Array.isArray(data.days)) {
          data.days.forEach((day: any) => {
            if (day.date) {
              updated[day.date] = {
                fwId: 0,
                fwName: day.frameworkName,
                title: day.contentIdea,
                funnel: day.funnel,
                note: `🎯 ${day.suggestedHook}\n💡 ${day.reason}`,
              };
            }
          });
          successCount += data.days.length;
        }
      }

      if (successCount > 0) {
        localStorage.setItem('buzzpilot_calendar', JSON.stringify(updated));
        setCalendarData(updated);
        launchToast(`✅ Rencana ${successCount} hari oleh AI untuk ${monthNames[calMonth]} ${calYear} berhasil diisi!`);
      } else {
        launchToast('AI gagal menghasilkan rencana. Coba lagi.');
      }
    } catch (err: any) {
      launchToast('Gagal membuat rencana AI: ' + (err.message || 'Unknown error'));
    } finally {
      setAiCalendarLoading(false);
    }
  };

  const fillDayWithAIIdea = async (dateKey: string) => {
    try {
      const monthNames = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
      const r = await fetch('/api/ai-calendar-idea', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product: profileProduct || 'Belum ditentukan',
          audience: profileAudience || 'Belum ditentukan',
          existingCalendar: calendarData,
          date: dateKey,
        }),
      });
      const data = await r.json();
      if (data.error) throw new Error(data.error);
      
      if (data.frameworkName) {
        const updated = { ...calendarData };
        updated[dateKey] = {
          fwName: data.frameworkName,
          title: data.contentIdea,
          funnel: data.funnel || 'tof',
          note: `🔍 Hook: ${data.hookType || 'N/A'}\n⭐ Est. Score: ${data.estimatedScore || 'N/A'}/100\n💡 ${data.tip || ''}`,
        };
        localStorage.setItem('buzzpilot_calendar', JSON.stringify(updated));
        setCalendarData(updated);
        launchToast(`💡 Ide konten oleh AI untuk ${dateKey} siap!`);
      }
    } catch (err: any) {
      launchToast('Gagal generate ide AI: ' + (err.message || 'Unknown error'));
    }
  };

  // --- CALENDAR ENGINE ---
  const getDaysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
  const getFirstDayOfMonth = (y: number, m: number) => new Date(y, m, 1).getDay();

  const handleDayClick = (day: number) => {
    const key = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    setCalDateSelection(key);
    const existing = calendarData[key];
    setCalNoteInput(existing?.note || '');
    setCalSelSavedId(existing?.savedId || null);
    setCalSelFWId(existing?.fwId || null);
    setCalTabMode(existing?.savedId ? 'saved' : 'fw');
  };

  const saveCalDayEntry = async () => {
    if (!calDateSelection) return;
    let entry: any = null;

    if (calTabMode === 'saved' && calSelSavedId) {
      const scr = savedScripts.find(s => s.id === calSelSavedId);
      if (scr) {
        entry = {
          savedId: scr.id,
          title: scr.title,
          fwName: scr.framework.name,
          fwId: scr.framework.id,
          funnel: scr.framework.funnel,
          score: scr.scores?.overall || null,
          note: calNoteInput
        };
      }
    } else if (calTabMode === 'fw' && calSelFWId) {
      const fw = FW.find(f => f.id === calSelFWId);
      if (fw) {
        entry = {
          fwId: fw.id,
          fwName: fw.name,
          title: fw.name,
          funnel: fw.funnel,
          note: calNoteInput
        };
      }
    }

    const updated = { ...calendarData };
    if (entry) {
      updated[calDateSelection] = entry;
    } else {
      delete updated[calDateSelection];
    }

    if (session && supabase) {
      const { error } = await supabase
        .from('buzzpilot_calendar')
        .upsert({
          user_id: session.user.id,
          date_key: calDateSelection,
          saved_id: entry?.savedId || null,
          title: entry?.title || null,
          fw_name: entry?.fwName || null,
          fw_id: entry?.fwId || null,
          funnel: entry?.funnel || 'tof',
          score: entry?.score || null,
          note: entry?.note || null
        }, { onConflict: 'date_key,user_id' });

      if (error) {
        console.warn('Supabase calendar upsert failed. Saved locally.', error);
      }
      syncWithSupabase(session.user.id);
    } else {
      localStorage.setItem('buzzpilot_calendar', JSON.stringify(updated));
      setCalendarData(updated);
      launchToast('Acara kalender tersimpan.');
    }
    setCalDateSelection(null);
  };

  const autoFillOptimalCalendar = () => {
    const daysCount = getDaysInMonth(calYear, calMonth);
    const tofs = FW.filter(f => f.funnel === 'tof');
    const mofs = FW.filter(f => f.funnel === 'mof');
    const bofs = FW.filter(f => f.funnel === 'bof');

    const updated = { ...calendarData };
    for (let d = 1; d <= daysCount; d++) {
      const key = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      if (updated[key]) continue;

      const r = Math.random();
      let fwSelected;
      if (r < 0.45) fwSelected = tofs[Math.floor(Math.random() * tofs.length)];
      else if (r < 0.75) fwSelected = mofs[Math.floor(Math.random() * mofs.length)];
      else fwSelected = bofs[Math.floor(Math.random() * bofs.length)];

      updated[key] = {
        fwId: fwSelected.id,
        fwName: fwSelected.name,
        title: fwSelected.name,
        funnel: fwSelected.funnel,
        note: 'Auto-Optimized Campaign Day'
      };
    }

    localStorage.setItem('buzzpilot_calendar', JSON.stringify(updated));
    setCalendarData(updated);
    launchToast('Kalender otomatis terisi dengan rasio seimbang (45:30:25)!');
  };

  // --- REPORT EXPORTERS (PDF & CSV) ---
  const triggerPDFExport = () => {
    if (!selectedFW || !scriptText) return;
    const doc = new jsPDF();
    const scores = calculateScores(scriptText, selectedFW);

    doc.setFont('times', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(123, 104, 238);
    doc.text('BUZZ PILOT — CONTENT MARKETING LAB', 14, 25);

    doc.setFontSize(10);
    doc.setTextColor(90, 86, 80);
    doc.setFont('times', 'normal');
    doc.text(`Generated: ${new Date().toLocaleDateString('id-ID')} · Powered by Google Gemini`, 14, 32);

    doc.setDrawColor(216, 212, 204);
    doc.line(14, 35, 196, 35);

    doc.setFontSize(14);
    doc.setTextColor(26, 24, 20);
    doc.setFont('times', 'bold');
    doc.text(`Naskah Analisis: ${selectedFW.name}`, 14, 45);

    doc.setFontSize(11);
    doc.text(`Diagnosis Score: ${scores.overall}/100 [Level: ${scores.overall >= 80 ? 'Excellent' : 'Good'}]`, 14, 52);

    doc.setFont('times', 'normal');
    doc.setTextColor(90, 86, 80);
    doc.text(`Kategori Funnel: ${selectedFW.funnel.toUpperCase()}`, 14, 58);
    doc.text(`Rasio Pengisian: ${scores.stepCov}% | Total Kata: ${scores.wc}`, 14, 64);

    doc.setFont('times', 'bold');
    doc.setTextColor(26, 24, 20);
    doc.text('Skenario Proyeksi Penjualan & View:', 14, 74);
    doc.setFont('times', 'normal');
    const factor = selectedFW.funnel === 'tof' ? 20 : selectedFW.funnel === 'mof' ? 8 : 4;
    doc.text(`- Low-Bound: ~${scores.overall * factor * 1} views`, 14, 80);
    doc.text(`- Mid-Bound: ~${scores.overall * factor * 4} views`, 14, 86);
    doc.text(`- High-Bound: ~${scores.overall * factor * 12} views (Faktor Viral)`, 14, 92);

    doc.setFont('times', 'bold');
    doc.text('Naskah Lengkap:', 14, 102);
    doc.setFont('times', 'normal');
    doc.setTextColor(26, 24, 20);
    const splitScript = doc.splitTextToSize(scriptText, 180);
    doc.text(splitScript, 14, 108);

    const checkY = 108 + splitScript.length * 6;
    if (captionText) {
      doc.setFont('times', 'bold');
      doc.text('Caption Pendukung (SEO):', 14, checkY + 8);
      doc.setFont('times', 'normal');
      doc.text(doc.splitTextToSize(captionText, 180), 14, checkY + 14);
    }

    doc.save(`BuzzPilot_Report_${selectedFW.id}.pdf`);
    launchToast('Laporan PDF profesional berhasil diunduh!');
  };

  const triggerCSVExport = () => {
    let csvContent = 'data:text/csv;charset=utf-8,Tanggal,Naskah,Framework,Overall Score,Fokus Funnel\n';
    savedScripts.forEach(s => {
      const sanitizedScript = s.script.replace(/"/g, '""').slice(0, 100);
      csvContent += `"${new Date(s.savedAt).toLocaleDateString('id-ID')}","${s.title}","${s.framework.name}","${s.scores?.overall || '--'}","${s.framework.funnel.toUpperCase()}"\n`;
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `BuzzPilot_Portofolio_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- SECURE SUPABASE SYSTEM AUTHORIZATION ---
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    if (!supabase) {
      setAuthError('Supabase client error. Is credential key present?');
      setAuthLoading(false);
      return;
    }
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: userEmail,
        password: userPassword,
      });
      if (error) {
        // Fallback to auto sign-up if login fails
        const { error: signUpErr, data: signUpData } = await supabase.auth.signUp({
          email: userEmail,
          password: userPassword
        });
        if (signUpErr) throw signUpErr;
        setSession(signUpData.session);
        launchToast('Pendaftaran & login berhasil!');
      } else {
        setSession(data.session);
        launchToast('Berhasil masuk ke server Supabase.');
      }
      setShowAuthModal(false);
    } catch (err: any) {
      setAuthError(err.message || 'Login error occurred.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    if (supabase) {
      await supabase.auth.signOut();
      setSession(null);
      localStorage.removeItem('buzzpilot_saved');
      localStorage.removeItem('buzzpilot_calendar');
      setSavedScripts([]);
      setCalendarData({});
      launchToast('Berhasil logout dari Supabase.');
    }
  };

  // --- API BACKEND COMMUNICATOR VIA CLAUDE/GEMINI ---
  const requestAIGenerateScript = async () => {
    if (!aiProduct.trim() || !aiAudience.trim() || !aiSelectedFW) {
      launchToast('Sila isi produk, audiens, dan pilih framework teratur!');
      return;
    }
    setAiLoading(true);
    try {
      const r = await fetch('/api/ai-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product: aiProduct,
          audience: aiAudience,
          pain: aiPain,
          tone: { label: aiTone, vibe: 'Conversational' },
          framework: aiSelectedFW
        })
      });
      const data = await r.json();
      if (data.error) throw new Error(data.error);
      setAiGenerationResult(data);
    } catch (err: any) {
      launchToast(err.message || 'Error ketika memanggil Gemini API server-side.');
    } finally {
      setAiLoading(false);
    }
  };

  const requestPersonalizedInsights = async () => {
    setInsightsLoading(true);
    try {
      const r = await fetch('/api/personalized-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          savedScripts,
          profileInfo: { product: profileProduct, audience: profileAudience }
        })
      });
      const data = await r.json();
      setInsightsResult(data);
    } catch (err: any) {
      launchToast('Gagal memproses insight taktis personalisasi.');
    } finally {
      setInsightsLoading(false);
    }
  };

  // --- FRONTEND LAYOUT PARTS ---
  return (
    <div className="min-h-screen pb-14 bg-[#f8f7f4]">
      {/* HEADER NAVBAR */}
      <header className="sticky top-0 z-40 h-[64px] bg-white border-b border-[#e8e5df] shadow-sm flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <div className="w-[36px] h-[36px] rounded-lg bg-[#7b68ee] flex items-center justify-center text-white font-extrabold shadow-md icon-active-glow">
            BP
          </div>
          <div>
            <h1 className="text-lg font-extrabold tracking-tight text-[#1a1814] font-['Syne']">
              Buzz Pilot <span className="italic text-[#7b68ee]">Marketing Lab</span>
            </h1>
            <p className="text-[11px] text-[#9b9690] uppercase tracking-widest font-semibold">by JAGOngeBRAND</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Dark Mode Toggle Button */}
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="p-2 rounded-full border border-[#e8e5df] bg-[#fbfbf9] text-[#5a5650] hover:bg-[#f2f0ec] transition duration-150 ease-in-out cursor-pointer"
            title={isDarkMode ? 'Aktifkan Mode Terang' : 'Aktifkan Mode Gelap'}
            aria-label="Toggle Dark Mode"
            id="theme-toggle-btn"
          >
            {isDarkMode ? <Sun className="w-4 h-4 text-[#f0921a]" /> : <Moon className="w-4 h-4 text-[#7b68ee]" />}
          </button>

          {/* Supabase Status Indicator */}
          <button 
            onClick={() => setShowSupabaseModal(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#e8e5df] bg-[#fbfbf9] text-[12px] font-semibold text-[#5a5650] hover:bg-[#f2f0ec]"
          >
            <Database className={`w-3.5 h-3.5 ${supabase ? 'text-[#16a34a]' : 'text-[#e8476a]'}`} />
            <span className="hidden sm:inline">Database:</span>
            <span className={supabase ? 'text-[#16a34a] font-bold' : 'text-[#9b9690]'}>
              {supabase ? 'Supabase' : 'Sandbox (Lokal)'}
            </span>
          </button>

          {session ? (
            <div className="flex items-center gap-2">
              <span className="text-[12px] font-semibold hidden md:inline text-[#5a5650]">{session.user.email}</span>
              <button 
                onClick={handleSignOut}
                className="text-[12px] text-white px-3 py-1.5 rounded-full font-bold bg-[#e8476a] hover:bg-[#db3559] btn"
              >
                Logout
              </button>
            </div>
          ) : (
            <button 
              onClick={() => setShowAuthModal(true)}
              className="flex items-center gap-2 bg-[#7b68ee] hover:bg-[#6855dd] text-white px-4 py-1.5 rounded-full font-bold text-[12px] shadow-sm btn"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Login Supabase</span>
            </button>
          )}
        </div>
      </header>

      {/* HORIZONTAL PAGE SUB-HEADER NAVIGATION */}
      <nav className="sticky top-[64px] z-30 bg-white border-b border-[#e8e5df] flex items-center justify-start gap-1 overflow-x-auto px-6 whitespace-nowrap py-1">
        {[
          { id: 'frameworks', label: '1. Framework List', count: FW.length, icon: Compass },
          { id: 'builder', label: '2. Script Builder', icon: Layout },
          { id: 'analyzer', label: '3. Real-time Scorer', icon: BarChart3 },
          { id: 'saved', label: '4. Saved Portofolio', count: savedScripts.length, icon: Save },
          { id: 'ai', label: 'AI Script Generator', icon: Sparkles, highlight: true },
          { id: 'calendar', label: 'Campaign Calendar', icon: CalendarIcon },
          { id: 'progress', label: 'Progress Overtime', icon: TrendingUp },
        ].map((tab: any) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => gotoPage(tab.id)}
              className={`ntab px-4 py-3.5 text-[13px] font-bold transition flex items-center gap-2 ${
                activeTab === tab.id 
                  ? 'text-[#7b68ee] active' 
                  : tab.highlight 
                  ? 'text-[#f0921a] hover:text-[#fbbf24]' 
                  : 'text-[#9b9690] hover:text-[#5a5650]'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${activeTab === tab.id ? 'bg-[#eeebff]' : 'bg-[#f2f0ec] text-[#7a7a72]'}`}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <main className="max-w-[1200px] mx-auto px-6 py-8 relative">
        
        {/* PAGE 1: FRAMEWORKS DIRECTORY */}
        {activeTab === 'frameworks' && (
          <div className="animate-fade-in">
            <div className="mb-8">
              <span className="px-3 py-1 bg-[#eeebff] border border-[#cdc6f9] rounded-full text-[11px] font-bold text-[#7b68ee] uppercase tracking-widest">
                Katalog Naskah Digital — 50 Frameworks
              </span>
              <h2 className="text-3xl font-extrabold tracking-tight mt-3 text-[#1a1814] font-['Syne']">
                Pilih <em>framework</em> pemasaran terbaik untuk konten Anda
              </h2>
              <p className="text-sm text-[#5a5650] max-w-[650px] mt-2">
                Sesuaikan dengan struktur target corong konversi media sosial Anda supaya pesan penawaran berkolerasi pas dengan kondisi psikologi pembaca.
              </p>
            </div>

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4 mb-6 md:items-center justify-between">
              <div className="flex gap-2 items-center flex-wrap">
                <span className="text-[12px] font-medium text-[#c4bfb8]">Filter:</span>
                {[
                  { id: 'all', key: 'Semua (50)', cls: 'bg-[#1a1814] text-white border-transparent' },
                  { id: 'tof', key: 'Top of Funnel (TOF)', cls: 'bg-[#e6f9f4] text-[#22c897] border-[#b3edde]' },
                  { id: 'mof', key: 'Middle of Funnel (MOF)', cls: 'bg-[#fef3e2] text-[#f0921a] border-[#fbd49a]' },
                  { id: 'bof', key: 'Bottom of Funnel (BOF)', cls: 'bg-[#fdeef2] text-[#e8476a] border-[#f4b0bf]' }
                ].map(item => (
                  <button
                    key={item.id}
                    onClick={() => setSelectedFunnel(item.id as any)}
                    className={`px-4 py-1.5 rounded-full border text-[12px] font-bold transition-all ${
                      selectedFunnel === item.id ? item.cls : 'bg-white text-[#5a5650] border-[#cdc6f9]'
                    }`}
                  >
                    {item.key}
                  </button>
                ))}
              </div>

              <input
                type="text"
                placeholder="Cari nama, tag, atau isi langkah framework..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full md:max-w-[325px] px-4 py-2 border border-[#border2] hover:border-[#accent-border] bg-white rounded-full text-[13px] ai-focus"
              />
            </div>

            {/* Frameworks Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {FW.filter(item => {
                const funnelMatch = selectedFunnel === 'all' || item.funnel === selectedFunnel;
                const searchMatch = 
                  item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  item.desc.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  item.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
                return funnelMatch && searchMatch;
              }).map(item => {
                const isSelected = selectedFW?.id === item.id;
                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      setSelectedFW(item);
                      // Clear stale editor texts
                      setPartsTexts([]);
                      setSelectedHookId(null);
                      setIsManualScriptEdit(false);
                      launchToast(`Sila menuju langkah 2 "Script Builder"`);
                    }}
                    className={`fw-card p-5 bg-white cursor-pointer rounded-2xl border-2 flex flex-col justify-between ${
                      isSelected 
                        ? 'border-[#7b68ee] bg-[#f5f3ff]' 
                        : 'border-[#e8e5df] hover:border-[#cdc6f9]'
                    }`}
                  >
                    <div>
                      <div className="flex justify-between items-start mb-3">
                        <span className="text-[11px] font-bold text-[#c4bfb8] tracking-widest">#{String(item.id).padStart(2,'0')}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                          item.funnel === 'tof' ? 'bg-[#e6f9f4] text-[#22c897]' : item.funnel === 'mof' ? 'bg-[#fef3e2] text-[#f0921a]' : 'bg-[#fdeef2] text-[#e8476a]'
                        }`}>
                          {item.funnel.toUpperCase()} of Funnel
                        </span>
                      </div>
                      <h4 className="text-[15px] font-extrabold text-[#1a1814] tracking-tight">{item.name}</h4>
                      <p className="text-[12px] text-[#5a5650] mt-1.5 leading-relaxed">{item.desc}</p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-[#f2f0ec] flex flex-wrap gap-1.5">
                      {item.tags.map((t, idx) => (
                        <span key={idx} className="bg-[#f2f0ec] text-[#7a7a72] px-2 py-0.5 rounded text-[10px] font-medium">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* PAGE 2: SCRIPT BUILDER WITH CHIPS AND SLOTS */}
        {activeTab === 'builder' && (
          <div className="animate-fade-in">
            {!selectedFW ? (
              <div className="text-center py-20 bg-white rounded-3xl border border-[#e8e5df]">
                <AlertCircle className="w-12 h-12 mx-auto text-[#9b9690] mb-4 stroke-1" />
                <h3 className="text-xl font-bold font-['Syne']">Framework Belum Dipilih</h3>
                <p className="text-sm text-[#9b9690] mt-1 max-w-[380px] mx-auto">
                  Silakan masuk ke menu Katalog Framework di kiri terlebih dahulu untuk memilih tipe formula pemasaran yang Anda inginkan.
                </p>
                <button onClick={() => setActiveTab('frameworks')} className="mt-5 bg-[#1a1814] text-white font-bold text-xs px-5 py-2.5 rounded-full hover:bg-neutral-800 btn">
                  Pilih Framework
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Step Guidelines Sidebar */}
                <div className="lg:col-span-4 flex flex-col gap-6">
                  <div className="bg-white border border-[#e8e5df] p-6 rounded-2xl shadow-sm">
                    <span className="text-[10px] font-bold text-[#c4bfb8] uppercase tracking-widest">Selected Blueprint</span>
                    <h3 className="text-lg font-extrabold text-[#1a1814] mt-1.5 font-['Syne']">{selectedFW.name}</h3>
                    <p className="text-[12px] text-[#5a5650] mt-1 leading-relaxed">{selectedFW.desc}</p>
                    
                    <div className="mt-6 flex flex-col gap-3">
                      <div className="text-[11px] font-bold uppercase tracking-widest text-[#9b9690] border-b border-[#f2f0ec] pb-1.5">Langkah Struktur:</div>
                      {selectedFW.steps.map((st, i) => (
                        <div key={i} className="flex gap-3 text-[12px] border-b border-[#fbfbf9] pb-2 last:border-b-0">
                          <div className="w-[18px] h-[18px] rounded-full bg-[#7b68ee] text-white flex items-center justify-center font-bold text-[10px] shrink-0">
                            {i + 1}
                          </div>
                          <div>
                            <span className="font-bold text-[#1a1814] block">[{st.n}]</span>
                            <span className="text-[#5a5650] block mt-0.5 text-[11px] leading-relaxed">{st.d}</span>
                            <span className="text-[#7b68ee] italic block text-[11px] mt-1">Con: {st.ex}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Main Scripting Space */}
                <div className="lg:col-span-8 flex flex-col gap-6">
                  
                  {/* Step 1: Hook Picker */}
                  <div className="bg-white border border-[#e8e5df] p-6 rounded-2xl shadow-sm">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="bg-[#1a1814] text-white text-[10px] font-extrabold w-4 h-4 rounded-full flex items-center justify-center">1</span>
                      <h4 className="text-[14px] font-extrabold text-[#1a1814] uppercase tracking-wider font-['Syne']">Hook Opening (0-3 Detik)</h4>
                    </div>
                    <p className="text-[12px] text-[#9b9690] mb-4">Pilih jenis anchor psikologis viral untuk diposisikan di baris naskah paling awal.</p>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {HOOK_TYPES.map(hk => (
                        <button
                          key={hk.id}
                          onClick={() => {
                            setSelectedHookId(hk.id);
                            setCustomHookText('');
                          }}
                          className={`p-3 text-left rounded-xl border text-[11px] transition-all flex flex-col ${
                            selectedHookId === hk.id 
                              ? 'border-[#7b68ee] bg-[#f5f3ff] text-[#7b68ee]' 
                              : 'border-[#e8e5df] hover:border-[#7b68ee] bg-[#fbfbf9]'
                          }`}
                        >
                          <span className="font-extrabold text-[12px]">{hk.name}</span>
                          <span className="text-[10px] text-[#9b9690] mt-1 leading-snug">{hk.formula}</span>
                        </button>
                      ))}
                    </div>

                    <div className="mt-4 flex gap-2">
                      <input
                        type="text"
                        placeholder="Atau ketik sendiri hook kustom unik Anda..."
                        value={customHookText}
                        onChange={e => {
                          setCustomHookText(e.target.value);
                          setSelectedHookId('custom');
                        }}
                        className="flex-1 px-4 py-2 border border-[#border2] rounded-full text-[12px] ai-focus"
                      />
                      <button 
                        onClick={() => {
                          if (customHookText) setScriptText(prev => customHookText + '\n\n' + prev);
                          launchToast('Kustom Hook disisipkan!');
                        }}
                        className="bg-[#1a1814] text-white font-bold text-xs px-4 py-2 rounded-full hover:bg-neutral-800 btn"
                      >
                        Sisipkan ke Naskah
                      </button>
                    </div>

                    {/* Quick Preview Hook Box */}
                    {selectedHookId && (
                      <div className="mt-4 bg-[#f5f3ff] border border-[#cdc6f9] p-3 rounded-xl text-[12px] text-[#7b68ee] italic">
                        <strong>Preview Opening: </strong> 
                        {selectedHookId === 'custom' ? customHookText : HOOK_TYPES.find(h => h.id === selectedHookId)?.ex}
                      </div>
                    )}
                  </div>

                  {/* Step 2: Main Content Drafting Slots */}
                  <div className="bg-white border border-[#e8e5df] p-6 rounded-2xl shadow-sm">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="bg-[#1a1814] text-white text-[10px] font-extrabold w-4 h-4 rounded-full flex items-center justify-center">2</span>
                      <h4 className="text-[14px] font-extrabold text-[#1a1814] uppercase tracking-wider font-['Syne']">Isi Slot Tiap Langkah Framework</h4>
                    </div>
                    
                    <div className="flex flex-col gap-4 mt-4">
                      {selectedFW.steps.map((st, idx) => (
                        <div key={idx} className="flex flex-col gap-1.5">
                          <label className="text-[11px] font-bold text-[#5a5650] uppercase tracking-wider">
                            [{st.n}] — {st.d}
                          </label>
                          <textarea
                            rows={2}
                            placeholder={`Tulis ide kalimat Anda untuk bagian ini... Contoh: "${st.ex}"`}
                            value={partsTexts[idx] || ''}
                            onChange={e => {
                              const updated = [...partsTexts];
                              updated[idx] = e.target.value;
                              setPartsTexts(updated);
                            }}
                            className="w-full px-4 py-2 border border-[#border2] rounded-xl text-[12px] ai-focus resize-none"
                          />
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 flex gap-2">
                      <button
                        onClick={() => {
                          const hookVal = selectedHookId === 'custom' 
                            ? customHookText 
                            : HOOK_TYPES.find(h => h.id === selectedHookId)?.ex || '';
                          const full = [hookVal, ...partsTexts].filter(Boolean).join('\n\n');
                          setScriptText(full);
                          launchToast('Komposisi slots gabung ke editor!');
                        }}
                        className="bg-[#7b68ee] hover:bg-[#6855dd] text-white transition-all font-bold text-xs px-5 py-2 rounded-full shadow-sm btn"
                      >
                        Gabung ke Editor Naskah
                      </button>
                      <button 
                        onClick={() => {
                          setPartsTexts([]);
                          setScriptText('');
                          setSelectedHookId(null);
                          setCustomHookText('');
                          setIsManualScriptEdit(false);
                          launchToast('Editor berhasil di-reset!');
                        }}
                        className="border border-[#border2] text-[#5a5650] font-bold text-xs px-5 py-2 rounded-full hover:bg-neutral-50 btn"
                      >
                        Reset Editor
                      </button>
                    </div>
                  </div>

                  {/* Fully Editable Combined Script Editor Area */}
                  <div className="bg-white border border-[#e8e5df] p-6 rounded-2xl shadow-sm">
                    <div className="flex justify-between items-center mb-1.5">
                      <h4 className="text-[14px] font-extrabold text-[#1a1814] uppercase tracking-wider font-['Syne']">Editor Naskah Utama</h4>
                      <div className="flex items-center gap-1.5 text-[10px] font-bold">
                        {isManualScriptEdit ? (
                          <span className="text-[#e8476a] bg-[#fdeef2] px-2 py-0.5 rounded-full flex items-center gap-1">
                            ● Kustom (Manual)
                          </span>
                        ) : (
                          <span className="text-[#16a34a] bg-[#e6f9f4] px-2 py-0.5 rounded-full flex items-center gap-1">
                            ● Auto-Sync Aktif
                          </span>
                        )}
                        {isManualScriptEdit && (
                          <button
                            onClick={() => {
                              setIsManualScriptEdit(false);
                              launchToast('Auto-Sync diaktifkan kembali!');
                            }}
                            className="text-[#7b68ee] hover:underline cursor-pointer"
                          >
                            Hubungkan Ulang
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="text-[11px] text-[#9b9690] mb-3">Gabungan draf atas naskah lengkap Anda yang akan direkam.</p>
                    
                    <textarea
                      rows={8}
                      value={scriptText}
                      onChange={e => {
                        setScriptText(e.target.value);
                        setIsManualScriptEdit(true);
                      }}
                      placeholder="Naskah Anda tersusun otomatis di sini... Anda bisa bebas mengetik atau langsung menyunting bagian apa pun secara leluasa."
                      className="w-full px-4 py-3 border border-[#border2] rounded-xl text-[13px] ai-focus leading-relaxed"
                    />
                    <div className="text-[11px] text-[#9b9690] mt-2 flex justify-between">
                      <span>Total: {scriptText.length} karakter</span>
                      <span>~ {Math.round(scriptText.split(/\s+/).filter(Boolean).length / 2.8)} detik durasi membaca</span>
                    </div>
                  </div>

                  {/* Step 3: Caption & Hashtag SEO Block */}
                  <div className="bg-white border border-[#e8e5df] p-6 rounded-2xl shadow-sm">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="bg-[#1a1814] text-white text-[10px] font-extrabold w-4 h-4 rounded-full flex items-center justify-center">3</span>
                      <h4 className="text-[14px] font-extrabold text-[#1a1814] uppercase tracking-wider font-['Syne']">Caption & Hashtags Target FYP</h4>
                    </div>
                    <p className="text-[12px] text-[#9b9690] mb-4">Tambahkan pancingan kata kunci (TikTok SEO metadata) agar algoritma membaca topik secara presisi.</p>

                    <div className="flex flex-col gap-4">
                      {/* Caption Textbox */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-bold text-[#5a5650] uppercase">Tulis Caption</label>
                        <textarea
                          rows={2}
                          placeholder="Contoh: Cara bikin konten naskah viral tanpa followers banyak! Save dan buktikan sendiri. #branding tips"
                          value={captionText}
                          onChange={e => setCaptionText(e.target.value)}
                          className="w-full px-4 py-2 border border-[#border2] rounded-xl text-[12px] ai-focus"
                        />
                      </div>

                      {/* Hashtags strategy wrapper */}
                      <div className="flex flex-col gap-2">
                        <label className="text-[11px] font-bold text-[#5a5650] uppercase">Pilih Hashtag Formula Taktis</label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="Cari hashtag..."
                            value={hashtagSearch}
                            onChange={e => setHashtagSearch(e.target.value)}
                            className="flex-1 px-4 py-1.5 border border-[#border2] rounded-full text-[12px]"
                          />
                          <button 
                            onClick={() => {
                              if (hashtagSearch) {
                                const formatted = hashtagSearch.startsWith('#') ? hashtagSearch : '#' + hashtagSearch;
                                if (!selectedHashtags.includes(formatted)) {
                                  setSelectedHashtags([...selectedHashtags, formatted]);
                                }
                                setHashtagSearch('');
                              }
                            }}
                            className="bg-[#1a1814] text-white px-4 py-1.5 rounded-full text-xs font-bold"
                          >
                            + Tambah
                          </button>
                        </div>

                        {/* AI Hashtag Recommender Button */}
                        <button
                          onClick={async () => {
                            if (!scriptText.trim()) {
                              launchToast('Tulis script dulu sebelum generate hashtag AI!');
                              return;
                            }
                            try {
                              const r = await fetch('/api/ai-hashtags', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  script: scriptText,
                                  caption: captionText,
                                  product: profileProduct || aiProduct || '',
                                  audience: profileAudience || aiAudience || '',
                                }),
                              });
                              const data = await r.json();
                              if (data.error) throw new Error(data.error);
                              if (data.hashtags && Array.isArray(data.hashtags)) {
                                setSelectedHashtags(prev => {
                                  const combined = [...prev, ...data.hashtags];
                                  return [...new Set(combined)];
                                });
                                launchToast(`✨ AI menambahkan ${data.hashtags.length} hashtag!`);
                              }
                            } catch (err: any) {
                              launchToast('Gagal generate hashtag AI: ' + (err.message || ''));
                            }
                          }}
                          className="bg-gradient-to-r from-[#22c897] to-[#1bb386] text-white px-4 py-1.5 rounded-full text-xs font-bold hover:shadow-md"
                        >
                          ✨ AI Rekomendasi Hashtag
                        </button>

                        {/* AI Caption Generator Button */}
                        <button
                          onClick={async () => {
                            if (!scriptText.trim()) {
                              launchToast('Tulis script dulu sebelum generate caption AI!');
                              return;
                            }
                            try {
                              const r = await fetch('/api/ai-caption', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  script: scriptText,
                                  product: profileProduct || aiProduct || '',
                                  audience: profileAudience || aiAudience || '',
                                  tone: aiTone,
                                }),
                              });
                              const data = await r.json();
                              if (data.error) throw new Error(data.error);
                              if (data.captions && Array.isArray(data.captions) && data.captions.length > 0) {
                                setCaptionText(data.captions[0]);
                                launchToast(`📝 AI Caption siap! ${data.captions.length} varian tersedia.`);
                              }
                            } catch (err: any) {
                              launchToast('Gagal generate caption AI: ' + (err.message || ''));
                            }
                          }}
                          className="bg-gradient-to-r from-[#7b68ee] to-[#6855dd] text-white px-4 py-1.5 rounded-full text-xs font-bold hover:shadow-md"
                        >
                          📝 AI Generate Caption
                        </button>

                        {/* Selected hashtags container */}
                        {selectedHashtags.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 bg-[#fbfbf9] p-3 rounded-xl border border-[#e8e5df]">
                            {selectedHashtags.map(t => (
                              <span key={t} className="bg-[#e6f9f4] text-[#22c897] px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1">
                                {t}
                                <span 
                                  onClick={() => setSelectedHashtags(selectedHashtags.filter(h => h !== t))}
                                  className="text-neutral-400 hover:text-black cursor-pointer font-bold ml-1"
                                >
                                  ×
                                </span>
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Grid directory categories */}
                        <div className="flex flex-col gap-2">
                          <div className="text-[10px] font-bold text-[#7a7a72] uppercase">Rekomendasi Niche JAGONGEBRAND:</div>
                          <div className="flex flex-wrap gap-1.5">
                            {Object.keys(HT_DATA).flatMap(c => HT_DATA[c]).filter(h => h.tag.includes(hashtagSearch)).slice(0, 14).map(item => (
                              <button
                                key={item.tag}
                                onClick={() => {
                                  if (!selectedHashtags.includes(item.tag)) {
                                    setSelectedHashtags([...selectedHashtags, item.tag]);
                                  }
                                }}
                                className="bg-white border border-[#e8e5df] hover:border-[#22c897] hover:text-[#22c897] px-2.5 py-1 rounded-full text-[10px] transition-all text-[#5a5650]"
                              >
                                {item.tag} <span className="text-[#9b9690] text-[8px]">({item.vol})</span>
                              </button>
                            ))}
                          </div>
                        </div>

                      </div>
                    </div>
                  </div>

                  {/* Big trigger button diagnostics analyzer */}
                  <div className="mt-4 flex gap-4">
                    <button
                      onClick={() => {
                        gotoPage('analyzer');
                        launchToast('Memproses metrik skor naskah realtime...');
                      }}
                      className="flex-1 py-4 rounded-full bg-[#1a1814] text-white font-extrabold text-[15px] font-['Syne'] tracking-wider shadow-md hover:bg-neutral-800 transition-all text-center"
                    >
                      Buka Fitur Diagnostik & Analisis Real-time →
                    </button>
                  </div>

                </div>
              </div>
            )}
          </div>
        )}

        {/* PAGE 3: REAL-TIME SCORER / DIAGNOSTIK */}
        {activeTab === 'analyzer' && (
          <div className="animate-fade-in">
            {!currentScores || !selectedFW ? (
              <div className="text-center py-20 bg-white rounded-3xl border border-[#e8e5df]">
                <AlertCircle className="w-12 h-12 mx-auto text-[#9b9690] mb-4 stroke-1" />
                <h3 className="text-xl font-bold font-['Syne']">Analisis Belum Tersedia</h3>
                <p className="text-sm text-[#9b9690] mt-1 max-w-[380px] mx-auto">
                  Silakan tulis set draf naskah Anda di menu "Script Builder" sebelum melihat metrik peninjauan.
                </p>
                <button onClick={() => setActiveTab('builder')} className="mt-5 bg-[#1a1814] text-white font-bold text-xs px-5 py-2.5 rounded-full hover:bg-neutral-800 btn">
                  Ke Script Builder
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-8">
                {/* Header Action Row - Phase 1 */}
                <div className={`flex justify-between items-center flex-wrap gap-4 border-b border-[#e8e5df] pb-4 ${scoreAnimPhase >= 1 ? 'animate-fade-in-up anim-phase-1' : 'opacity-0'}`}>
                  <div>
                    <span className="px-2 py-0.5 rounded-full bg-[#cdc6f9] text-[#7b68ee] text-[9px] font-bold">REPORT STATUS</span>
                    <h2 className="text-2xl font-extrabold text-[#1a1814] mt-2 font-['Syne']">Diagnostik Nilai Naskah Konten Anda</h2>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={saveFinalContent}
                      className="bg-[#22c897] hover:bg-[#1bb386] text-white font-bold text-xs px-5 py-2.5 rounded-full shadow-sm btn"
                    >
                      Simpan Content Final
                    </button>
                    <button 
                      onClick={triggerPDFExport}
                      className="bg-white border border-[#border2] hover:bg-neutral-50 text-[#1a1814] font-bold text-xs px-5 py-2.5 rounded-full flex items-center gap-1.5 btn"
                    >
                      <Download className="w-4 h-4" /> Export PDF
                    </button>
                  </div>
                </div>

                {/* Score Summary Card - Phase 2 & 3 */}
                <div className={`grid grid-cols-1 md:grid-cols-12 gap-8 bg-white border border-[#e8e5df] p-8 rounded-3xl shadow-sm items-center ${scoreAnimPhase >= 2 ? 'animate-slide-up anim-phase-2' : 'opacity-0'}`}>
                  <div className="md:col-span-4 flex flex-col items-center justify-center border-r border-[#f2f0ec] pr-4">
                    <div className="relative w-[150px] h-[150px] flex items-center justify-center">
                      {/* Interactive SVG Circular BarChart */}
                      <svg className="absolute transform -rotate-90" width="140" height="140">
                        <circle cx="70" cy="70" r="58" fill="transparent" stroke="#f2f0ec" strokeWidth="8"/>
                        <circle cx="70" cy="70" r="58" fill="transparent" stroke={currentScores.overall >= 80 ? '#16a34a' : currentScores.overall >= 60 ? '#f0921a' : '#e8476a'} strokeWidth="8" strokeDasharray={`${2 * Math.PI * 58}`} strokeDashoffset={`${2 * Math.PI * 58 * (1 - currentScores.overall / 100)}`} className={scoreAnimPhase >= 2 ? 'animate-circle-stroke' : ''}/>
                      </svg>
                      <div className="text-center z-10">
                        <span className="text-5xl font-black font-['Syne'] block text-neutral-800">{currentScores.overall}</span>
                        <span className="text-[10px] uppercase tracking-wider text-[#9b9690] font-bold">Overall Score</span>
                      </div>
                    </div>
                    <div className={`mt-4 px-4 py-1 rounded-full text-xs font-bold ${
                      currentScores.overall >= 80 ? 'bg-emerald-50 text-emerald-600' : currentScores.overall >= 60 ? 'bg-amber-50 text-amber-500' : 'bg-rose-50 text-[#e8476a]'
                    }`}>
                      {currentScores.overall >= 80 ? 'Perfectly Viral' : currentScores.overall >= 60 ? 'Decent Content' : 'Weak Retention'}
                    </div>
                  </div>

                  {/* Stat bars breakdown - Phase 3 (staggered individual bars) */}
                  <div className="md:col-span-8 flex flex-col gap-4">
                    {[
                      { l: 'Hook Retention (0-3 Detik)', v: currentScores.hookScore, col: 'bg-[#e8476a]' },
                      { l: 'Readability Ritme Membaca', v: currentScores.readScore, col: 'bg-[#7b68ee]' },
                      { l: 'TikTok SEO & Metadata Match', v: currentScores.seoScore, col: 'bg-[#22c897]' },
                      { l: 'Emotional Engagement Value', v: currentScores.emotionScore, col: 'bg-[#f0921a]' },
                      { l: 'CTA Persuasiveness Score', v: currentScores.ctaScore, col: 'bg-indigo-500' }
                    ].map((item, idx) => (
                      <div key={idx} className={`flex flex-col gap-1.5 ${scoreAnimPhase >= 3 ? 'animate-fade-in-up' : 'opacity-0'}`} style={{ animationDelay: `${idx * 120}ms` }}>
                        <div className="flex justify-between text-xs font-bold text-[#5a5650]">
                          <span>{item.l}</span>
                          <span>{item.v}/100</span>
                        </div>
                        <div className="w-full bg-[#f2f0ec] h-2 rounded-full overflow-hidden">
                          <div className={`h-full ${item.col} animate-score-bar-inner`} style={{ width: `${scoreAnimPhase >= 3 ? item.v : 0}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Simulated Viewer Retention Flow Chart Line - Phase 4 */}
                <div className={`bg-white border border-[#e8e5df] p-6 rounded-2xl shadow-sm ${scoreAnimPhase >= 4 ? 'animate-slide-up anim-phase-4' : 'opacity-0'}`}>
                  <h4 className="text-md font-extrabold text-[#1a1814] font-['Syne'] uppercase">Evaluasi Graf Retention & Droprate Audiens</h4>
                  <p className="text-xs text-[#9b9690] mt-1">Grafik prediksi penonton yang melompat skip berdasarkan ritme pengucapan keyword dalam naskah Anda.</p>
                  <div className="mt-6">
                    <canvas ref={retentionCanvasRef} className="w-full h-[220px] rounded-xl border border-[#e8e5df]" />
                  </div>
                </div>

                {/* Additional diagnostic checklist - Phase 5 */}
                <div className={`grid grid-cols-1 md:grid-cols-3 gap-6 ${scoreAnimPhase >= 5 ? 'animate-fade-in-up anim-phase-5' : 'opacity-0'}`}>
                  {/* Realtime Action Improvements Card */}
                  <div className={`bg-white border border-[#e8e5df] p-6 rounded-2xl shadow-sm ${scoreAnimPhase >= 5 ? 'animate-fade-in-scale' : 'opacity-0'}`} style={{ animationDelay: '0ms' }}>
                    <h4 className="text-sm font-black text-neutral-800 font-['Syne'] uppercase">Peluang Perbaikan</h4>
                    <div className="mt-4 flex flex-col gap-3">
                      {currentScores.hookScore < 70 && (
                        <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-[11px]">
                          <strong>Saran Opening:</strong> Tambahkan angka atau target spesifik di 2 baris awal draf Anda.
                        </div>
                      )}
                      {!currentScores.hasCTA && (
                        <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-[11px]">
                          <strong>CTA Hilang:</strong> Jangan biarkan naskah berakhir polos tak berarah. Tambahkan kata perintah pancingan "simpan video ini".
                        </div>
                      )}
                      {currentScores.overall >= 80 ? (
                        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px]">
                          Naskah Anda sudah dinilai seimbang dan siap sedia diproduksi secara ideal di studio!
                        </div>
                      ) : (
                        <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 text-[11px]">
                          Tingkatkan keterbacaan atau masukkan keyword target lain di dalam caption.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Funnel Level Diagnostics */}
                  <div className="bg-white border border-[#e8e5df] p-6 rounded-2xl shadow-sm">
                    <h4 className="text-sm font-black text-neutral-800 font-['Syne'] uppercase">Rasio Distribusi Funnel</h4>
                    <div className="mt-4 flex flex-col gap-3">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-[#22c897] font-bold">Top of Funnel (Aura Viral)</span>
                        <span className="font-extrabold">{Math.floor(currentScores.fS.tof)}%</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-[#f0921a] font-bold">Middle of Funnel (Kredibilitas)</span>
                        <span className="font-extrabold">{Math.floor(currentScores.fS.mof)}%</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-[#e8476a] font-bold">Bottom of Funnel (Konversi Promo)</span>
                        <span className="font-extrabold">{Math.floor(currentScores.fS.bof)}%</span>
                      </div>
                    </div>
                  </div>

                  {/* Predictions views scale */}
                  <div className="bg-white border border-[#e8e5df] p-6 rounded-2xl shadow-sm">
                    <h4 className="text-sm font-black text-neutral-800 font-['Syne'] uppercase">Estimasi views organic</h4>
                    <div className="mt-4 flex flex-col gap-1.5 text-xs text-neutral-600">
                      <div>Low-Bound: <span className="font-bold text-[#e8476a]">~{currentScores.overall * 20} views</span></div>
                      <div>Optimal: <span className="font-bold text-[#f0921a]">~{currentScores.overall * 80} views</span></div>
                      <div>Viral peak: <span className="font-bold text-[#22c897]">~{currentScores.overall * 240} views</span></div>
                    </div>
                  </div>
                </div>

                {/* AI Score Validation Panel */}
                {aiScoreResult && (
                  <div className="bg-white border border-[#e8e5df] p-6 rounded-2xl shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                      <Sparkles className="w-4 h-4 text-[#7b68ee]" />
                      <h4 className="text-md font-extrabold text-[#1a1814] font-['Syne'] uppercase">AI DeepSeek Validation</h4>
                      {aiScoreLoading && <span className="text-[10px] text-[#9b9690] ml-auto">Menganalisis...</span>}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
                      {[
                        { l: 'AI Hook', v: aiScoreResult.aiHookScore, col: 'bg-[#e8476a]' },
                        { l: 'AI Readability', v: aiScoreResult.aiReadScore, col: 'bg-[#7b68ee]' },
                        { l: 'AI SEO', v: aiScoreResult.aiSeoScore, col: 'bg-[#22c897]' },
                        { l: 'AI Emotion', v: aiScoreResult.aiEmotionScore, col: 'bg-[#f0921a]' },
                        { l: 'AI CTA', v: aiScoreResult.aiCtaScore, col: 'bg-indigo-500' },
                      ].map((item, idx) => (
                        <div key={idx} className="flex flex-col items-center bg-[#fbfbf9] p-3 rounded-xl border border-[#e8e5df]">
                          <span className="text-[10px] font-bold text-[#9b9690] uppercase">{item.l}</span>
                          <span className="text-2xl font-black text-[#1a1814] mt-1">{item.v}</span>
                          <div className="w-full bg-[#f2f0ec] h-1.5 rounded-full mt-1 overflow-hidden">
                            <div className={`h-full ${item.col}`} style={{ width: `${item.v}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="bg-[#f5f3ff] border border-[#cdc6f9] p-4 rounded-xl">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-bold text-[#7b68ee] uppercase tracking-wider">AI Overall: {aiScoreResult.aiOverall}/100</span>
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-white text-[#5a5650] border border-[#e8e5df]">
                          {aiScoreResult.aiOverall >= 80 ? 'Sangat Kuat' : aiScoreResult.aiOverall >= 60 ? 'Cukup Baik' : 'Perlu Peningkatan'}
                        </span>
                      </div>
                      <p className="text-[12px] text-[#5a5650] leading-relaxed italic">"{aiScoreResult.feedback}"</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                      <div className="flex flex-col gap-2">
                        <span className="text-[10px] font-bold text-[#e8476a] uppercase tracking-wider">🎣 Hook Analysis</span>
                        <p className="text-[11px] text-[#5a5650] leading-relaxed">{aiScoreResult.hookAnalysis}</p>
                      </div>
                      <div className="flex flex-col gap-2">
                        <span className="text-[10px] font-bold text-[#7b68ee] uppercase tracking-wider">📖 Readability</span>
                        <p className="text-[11px] text-[#5a5650] leading-relaxed">{aiScoreResult.readabilityAnalysis}</p>
                      </div>
                      <div className="flex flex-col gap-2">
                        <span className="text-[10px] font-bold text-[#f0921a] uppercase tracking-wider">💭 Emotional</span>
                        <p className="text-[11px] text-[#5a5650] leading-relaxed">{aiScoreResult.emotionAnalysis}</p>
                      </div>
                      <div className="flex flex-col gap-2">
                        <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider">🎯 CTA Analysis</span>
                        <p className="text-[11px] text-[#5a5650] leading-relaxed">{aiScoreResult.ctaAnalysis}</p>
                      </div>
                    </div>

                    {aiScoreResult.suggestions && aiScoreResult.suggestions.length > 0 && (
                      <div className="mt-4 border-t border-[#e8e5df] pt-4">
                        <span className="text-[10px] font-bold text-[#22c897] uppercase tracking-wider">💡 Saran Perbaikan</span>
                        <div className="flex flex-col gap-1.5 mt-2">
                          {aiScoreResult.suggestions.map((s: string, i: number) => (
                            <div key={i} className="flex items-start gap-2 text-[12px] text-[#5a5650]">
                              <span className="w-5 h-5 rounded-full bg-[#e6f9f4] text-[#22c897] flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5">{i + 1}</span>
                              <span>{s}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

              </div>
            )}
          </div>
        )}

        {/* PAGE 4: SAVED PORTOFOLIO */}
        {activeTab === 'saved' && (
          <div className="animate-fade-in">
            <div className="flex justify-between items-center flex-wrap gap-4 mb-8">
              <div>
                <span className="px-3 py-1 bg-emerald-50 border border-emerald-200 rounded-full text-[11px] font-bold text-emerald-600 uppercase tracking-widest">
                  Content Final Tersusun
                </span>
                <h2 className="text-3xl font-extrabold tracking-tight mt-3 text-[#1a1814] font-['Syne']">
                  Portofolio naskah yang berhasil tersimpan
                </h2>
                <p className="text-sm text-[#5a5650] mt-2">
                  Daftar content yang berhasil dianalisis dan siap dipasarkan. Unduh dalam format CSV untuk dilaporkan ke tim editorial.
                </p>
              </div>
              <button 
                onClick={triggerCSVExport}
                className="bg-white border border-[#border2] hover:bg-neutral-50 px-5 py-2.5 rounded-full font-bold text-xs flex items-center gap-1.5 btn"
              >
                <Download className="w-4 h-4" /> Download Portofolio CSV
              </button>
            </div>

            {savedScripts.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-3xl border border-[#e8e5df]">
                <AlertCircle className="w-12 h-12 mx-auto text-[#9b9690] mb-4 stroke-1" />
                <h3 className="text-xl font-bold font-['Syne']">Portofolio Anda Kosong</h3>
                <p className="text-sm text-[#9b9690] mt-1 max-w-[380px] mx-auto">
                  Belum ada script konten yang berhasil disimpan. Jom, buat siri naskah Anda di menu Script Builder lalu pilih "Simpan Content".
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {savedScripts.map(item => (
                  <div key={item.id} className="p-6 bg-white border border-[#e8e5df] rounded-2xl flex flex-col md:flex-row justify-between gap-6 hover:shadow-sm transition-all">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded-lg bg-violet-50 border border-violet-100 text-violet-600 text-[10px] font-bold">
                          Scores: {item.scores?.overall || '--'}/100
                        </span>
                        <span className="text-[11px] text-[#9b9690]">
                          {new Date(item.savedAt || item.id).toLocaleDateString('id-ID')}
                        </span>
                      </div>
                      
                      <h4 className="text-lg font-extrabold text-[#1a1814] mt-2 tracking-tight">{item.title}</h4>
                      <p className="text-[12px] text-[#9b9690] mt-1">Framework: {item.framework?.name || 'Kustom'}</p>
                      
                      <div className="mt-4 bg-[#fbfbf9] p-3 rounded-lg border border-[#e8e5df] text-xs text-[#5a5650] max-h-[85px] overflow-hidden truncate whitespace-pre-line leading-relaxed">
                        {item.script}
                      </div>

                      {item.caption && (
                        <div className="mt-2 text-[11px] text-[#7a7a72] italic bg-[#eeebff] px-3 py-1 rounded">
                          <strong>Caption: </strong>{item.caption}
                        </div>
                      )}
                    </div>

                    <div className="flex md:flex-col justify-end items-end gap-2 shrink-0">
                      <button 
                        onClick={() => loadSavedScriptToBuilder(item)}
                        className="bg-[#1a1814] text-white px-4 py-1.5 rounded-full font-bold text-xs hover:bg-neutral-800 btn"
                      >
                        Load to Builder
                      </button>
                      <button 
                        onClick={() => {
                          setRenameInput(item.title);
                          setShowRenameModalId(item.id);
                        }}
                        className="bg-white border border-[#border2] hover:bg-neutral-50 px-4 py-1.5 rounded-full font-bold text-xs text-[#5a5650] btn"
                      >
                        Rename
                      </button>
                      <button 
                        onClick={() => deleteScript(item.id)}
                        className="bg-[#fdeef2] border border-[#f4b0bf] text-[#e8476a] font-bold text-xs px-4 py-1.5 rounded-full hover:bg-rose-50 btn"
                      >
                        Hapus
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* PAGE 5: AI SCRIPT GENERATOR */}
        {activeTab === 'ai' && (
          <div className="animate-fade-in">
            <div className="mb-8">
              <span className="px-3 py-1 bg-[#eeebff] border border-[#cdc6f9] rounded-full text-[11px] font-bold text-[#7b68ee] uppercase tracking-widest flex items-center gap-1.5 w-fit">
                <Sparkles className="w-3.5 h-3.5" /> AI Content Generator
              </span>
              <h2 className="text-3xl font-extrabold tracking-tight mt-3 text-[#1a1814] font-['Syne']">
                Ubah Ide Jualan Anda Menjadi <em>Script Konten Viral</em>
              </h2>
              <p className="text-sm text-[#5a5650] mt-2">
                Tulis detail produk atau jasa yang ingin Anda jual, pilih tone suara dan target audiens, biar kecerdasan buatan Google Gemini menyusun naskah pemasarannya dalam sekejap!
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-6 flex flex-col gap-4">
                <div className="bg-white border border-[#e8e5df] p-6 rounded-2xl shadow-sm flex flex-col gap-4">
                  
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-[#5a5650] uppercase tracking-wider">Nama Produk atau Jasa</label>
                    <input
                      type="text"
                      placeholder="e.g. Kelas Online Strategy Konten TikTok FYP, harga 299rb"
                      value={aiProduct}
                      onChange={e => setAiProduct(e.target.value)}
                      className="w-full px-4 py-2 border border-[#border2] rounded-xl text-[12px] ai-focus"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-[#5a5650] uppercase tracking-wider">Target Audiens Utama</label>
                    <input
                      type="text"
                      placeholder="e.g. Pebisnis UMKM lokal usia 20-35 tahun"
                      value={aiAudience}
                      onChange={e => setAiAudience(e.target.value)}
                      className="w-full px-4 py-2 border border-[#border2] rounded-xl text-[12px] ai-focus"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-[#5a5650] uppercase tracking-wider">Pain Point yang Ingin Diselesaikan</label>
                    <input
                      type="text"
                      placeholder="e.g. Sudah konsisten posting tapi views mentok di 200 views saja"
                      value={aiPain}
                      onChange={e => setAiPain(e.target.value)}
                      className="w-full px-4 py-2 border border-[#border2] rounded-xl text-[12px] ai-focus"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-[#5a5650] uppercase tracking-wider">Pilih Tone of Voice</label>
                    <div className="grid grid-cols-3 gap-2">
                      {['edukatif', 'entertainer', 'hard-selling', 'storyteller'].map(item => (
                        <button
                          key={item}
                          onClick={() => setAiTone(item)}
                          className={`px-3 py-1.5 rounded-full border text-[11px] font-bold transition-all ${
                            aiTone === item 
                              ? 'bg-[#7b68ee] text-white border-transparent' 
                              : 'bg-[#fbfbf9] text-[#5a5650] border-[#cdc6f9]'
                          }`}
                        >
                          {item.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Pick framework */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-[#5a5650] uppercase tracking-wider">Pilih Framework Target</label>
                    <div className="max-h-[140px] overflow-y-auto border border-[#border2] rounded-xl p-3 flex flex-col gap-1 bg-[#fbfbf9]">
                      {FW.map(f => (
                        <button
                          key={f.id}
                          onClick={() => setAiSelectedFW(f)}
                          className={`p-2 rounded text-left text-[11px] transition-all flex justify-between items-center ${
                            aiSelectedFW?.id === f.id ? 'bg-[#eeebff] text-[#7b68ee] font-bold' : 'hover:bg-white text-[#5a5650]'
                          }`}
                        >
                          <span>{f.name}</span>
                          <span className="text-[9px] uppercase font-bold text-[#9b9690]">{f.funnel.toUpperCase()}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={requestAIGenerateScript}
                    disabled={aiLoading}
                    className="w-full py-3.5 rounded-full bg-[#7b68ee] hover:bg-[#6855dd] text-white font-bold text-sm tracking-wider shadow-md transition-all flex items-center justify-center gap-2 btn disabled:opacity-50"
                  >
                    {aiLoading ? 'Sedang Memproses AI...' : 'Generate Script via Google Gemini Sparkles'}
                  </button>

                </div>
              </div>

              {/* Generation output preview */}
              <div className="lg:col-span-6">
                {aiGenerationResult ? (
                  <div className="bg-white border border-[#e8e5df] p-6 rounded-2xl shadow-sm flex flex-col gap-4">
                    <div className="flex justify-between items-center border-b border-[#f2f0ec] pb-3">
                      <div>
                        <h4 className="text-sm font-bold text-emerald-600 uppercase flex items-center gap-1">
                          <CheckCircle2 className="w-4 h-4" /> Script Siap Pakai
                        </h4>
                        <span className="text-[10px] text-[#9b9690]">Estimasi Durasi: {aiGenerationResult.estimated_duration} Detik</span>
                      </div>
                      <button 
                        onClick={() => {
                          setSelectedFW(aiSelectedFW);
                          setScriptText(aiGenerationResult.script);
                          setCaptionText(aiGenerationResult.caption || '');
                          setSelectedHashtags(aiGenerationResult.hashtags || []);
                          setPartsTexts([]);
                          setActiveTab('builder');
                          launchToast('Script AI dikirim ke Builder!');
                        }}
                        className="bg-[#22c897] hover:bg-[#1bb386] text-white px-4 py-1.5 rounded-full text-xs font-bold btn"
                      >
                        Kirim ke Builder →
                      </button>
                    </div>

                    <div className="flex flex-col gap-3">
                      <div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-[#9b9690]">Naskah Rekaman:</span>
                        <div className="bg-[#fbfbf9] p-4 rounded-xl border border-[#border2] text-xs text-[#1a1814] leading-relaxed whitespace-pre-line mt-1.5">
                          {aiGenerationResult.script}
                        </div>
                      </div>

                      {aiGenerationResult.caption && (
                        <div>
                          <span className="text-[11px] font-bold uppercase tracking-wider text-[#9b9690]">Saran Caption SEO:</span>
                          <div className="bg-blue-50/50 p-3 rounded-lg border border-blue-100 text-[11px] text-[#5a5650] mt-1 leading-relaxed">
                            {aiGenerationResult.caption}
                          </div>
                        </div>
                      )}

                      {aiGenerationResult.hashtags && (
                        <div>
                          <span className="text-[11px] font-bold uppercase tracking-wider text-[#9b9690]">Hashtag:</span>
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {aiGenerationResult.hashtags.map((h: string) => (
                              <span key={h} className="bg-[#f2f0ec] text-[#5a5650] px-2 py-0.5 rounded text-[10px] font-bold">
                                {h}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="h-full border border-dashed border-[#border2] rounded-2xl flex flex-col justify-center items-center p-12 text-center bg-white min-h-[350px]">
                    <Sparkles className="w-12 h-12 text-[#cdc6f9] mb-4 stroke-1" />
                    <h4 className="text-md font-bold text-neutral-800 font-['Syne']">Hasil Skenario AI Belum Diminta</h4>
                    <p className="text-xs text-[#9b9690] mt-1 max-w-[280px]">
                      Isi biodata brief kampanye produk Anda di sebalah kiri kemudian klik tombol proses generator.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* PAGE 6: CAMPAIGN CONTENT CALENDAR */}
        {activeTab === 'calendar' && (
          <div className="animate-fade-in">
            <div className="mb-8 flex justify-between items-center flex-wrap gap-4">
              <div>
                <span className="px-3 py-1 bg-[#eeebff] border border-[#cdc6f9] rounded-full text-[11px] font-bold text-[#7b68ee] uppercase tracking-widest flex items-center gap-1.5 w-fit">
                  <CalendarIcon className="w-3.5 h-3.5" /> 30-Day Campaign Calendar
                </span>
                <h2 className="text-3xl font-extrabold tracking-tight mt-3 text-[#1a1814] font-['Syne']">
                  Rencanakan jadwal rilis konten Anda secara matang
                </h2>
                <p className="text-sm text-[#5a5650] mt-2">
                  Atur keseimbangan funnel konten per minggu langsung di dalam matrix grid bulanan.
                </p>
              </div>
              <div className="flex gap-2 flex-wrap">
                <button 
                  onClick={fillCalendarWithAIPlan}
                  disabled={aiCalendarLoading}
                  className="bg-gradient-to-r from-[#7b68ee] to-[#6855dd] text-white px-5 py-2.5 rounded-full font-bold text-xs hover:shadow-md transition-all flex items-center gap-1.5 btn disabled:opacity-50"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {aiCalendarLoading ? 'AI Menyusun...' : '🧠 AI Rencana Bulanan (Bertahap)'}
                </button>
                <button 
                  onClick={autoFillOptimalCalendar}
                  className="bg-[#1a1814] text-white px-5 py-2.5 rounded-full font-bold text-xs hover:bg-neutral-800 btn"
                >
                  Otomatis isi Rencana Kampanye
                </button>
                <button 
                  onClick={() => {
                    const txt = JSON.stringify(calendarData, null, 2);
                    navigator.clipboard.writeText(txt);
                    launchToast('Data export kalender di-copy ke clipboard!');
                  }}
                  className="bg-white border border-[#border2] hover:bg-neutral-50 text-[#1a1814] px-5 py-2.5 rounded-full font-bold text-xs btn"
                >
                  Ekspor Plain Text
                </button>
              </div>
            </div>

            {/* Calendar Controls */}
            <div className="flex items-center gap-4 mb-6 justify-center">
              <button 
                onClick={() => {
                  let prevM = calMonth - 1;
                  let prevY = calYear;
                  if (prevM < 0) { prevM = 11; prevY--; }
                  setCalMonth(prevM); setCalYear(prevY);
                }}
                className="bg-white border border-[#e8e5df] p-2 rounded-full hover:bg-neutral-50"
              >
                ←
              </button>
              <div className="text-lg font-bold font-['Syne'] text-[#1a1814] min-w-[180px] text-center">
                {['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'][calMonth]} {calYear}
              </div>
              <button 
                onClick={() => {
                  let nextM = calMonth + 1;
                  let nextY = calYear;
                  if (nextM > 11) { nextM = 0; nextY++; }
                  setCalMonth(nextM); setCalYear(nextY);
                }}
                className="bg-white border border-[#e8e5df] p-2 rounded-full hover:bg-neutral-50"
              >
                →
              </button>
            </div>

            {/* Calendar Grid Matrix */}
            <div className="bg-white border border-[#e8e5df] rounded-3xl p-6 shadow-sm">
              <div className="grid grid-cols-7 gap-2 mb-2 text-center text-xs font-bold text-[#9b9690] uppercase tracking-wider">
                {['Ming', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'].map(day => (
                  <div key={day} className="py-2">{day}</div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-2">
                {/* Empty cells for leading formatting */}
                {Array.from({ length: getFirstDayOfMonth(calYear, calMonth) }).map((_, i) => (
                  <div key={`empty-${i}`} className="min-h-[90px] rounded-2xl bg-neutral-50/50 border border-neutral-100/50" />
                ))}

                {/* Day grid items */}
                {Array.from({ length: getDaysInMonth(calYear, calMonth) }).map((_, i) => {
                  const day = i + 1;
                  const key = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  const entry = calendarData[key];
                  return (
                    <div
                      key={`day-${day}`}
                      onClick={() => handleDayClick(day)}
                      className={`min-h-[90px] rounded-2xl border p-2 flex flex-col justify-between cursor-pointer transition-all hover:border-[#7b68ee] hover:shadow-sm ${
                        entry
                          ? entry.funnel === 'tof' ? 'bg-[#e6f9f4]/60 border-[#b3edde]' : entry.funnel === 'mof' ? 'bg-[#fef3e2]/60 border-[#fbd49a]' : 'bg-[#fdeef2]/60 border-[#f4b0bf]'  
                          : 'bg-white border-[#e8e5df]'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-[#7a7a72]">{day}</span>
                        {entry && (
                          <span className="text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-white border border-[#e8e5df]">
                            {entry.funnel.toUpperCase()}
                          </span>
                        )}
                      </div>
                      
                      {entry ? (
                        <div className="flex flex-col gap-1 mt-1">
                          <p className="text-[10px] font-bold text-[#1a1814] truncate leading-tight">{entry.title}</p>
                          {entry.score && <span className="text-[9px] text-[#16a34a] font-bold">Sc: {entry.score}/100</span>}
                        </div>
                      ) : (
                        <span className="text-neutral-300 text-sm font-semibold self-center">+</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* PAGE 7: PROGRESS OVERTIME INDEX & DEEP AI INSIGHTS */}
        {activeTab === 'progress' && (
          <div className="animate-fade-in flex flex-col gap-8">
            <div className="mb-0">
              <span className="px-3 py-1 bg-[#eeebff] border border-[#cdc6f9] rounded-full text-[11px] font-bold text-[#7b68ee] uppercase tracking-widest flex items-center gap-1.5 w-fit">
                <TrendingUp className="w-3.5 h-3.5" /> Portofolio Progress & AI Diagnostics
              </span>
              <h2 className="text-3xl font-extrabold tracking-tight mt-3 text-[#1a1814] font-['Syne']">
                Kinerja Kualitas Konten Anda Dari Waktu Ke Waktu
              </h2>
              <p className="text-sm text-[#5a5650] mt-2">
                Lihat kestabilan nilai script Anda dan kumpulkan ulasan rekomendasi personalisasi bertenaga AI untuk menutupi gap pemasaran.
              </p>
            </div>

            {savedScripts.length < 2 ? (
              <div className="text-center py-20 bg-white rounded-3xl border border-[#e8e5df]">
                <AlertCircle className="w-12 h-12 mx-auto text-[#9b9690] mb-4 stroke-1" />
                <h3 className="text-xl font-bold font-['Syne']">Portofolio Data Belum Memadai</h3>
                <p className="text-sm text-[#9b9690] mt-1 max-w-[380px] mx-auto">
                  Sila simpan minimal 2 naskah konten final hasil analisis diagnostik terlebih dahulu untuk merender progres visual ini.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                
                {/* Overtime Graph Column */}
                <div className="lg:col-span-8 flex flex-col gap-6">
                  <div className="bg-white border border-[#e8e5df] p-6 rounded-2xl shadow-sm">
                    <h4 className="text-md font-extrabold text-[#1a1814] font-['Syne'] uppercase mb-1.5">Tren Nilai Script Tersimpan</h4>
                    <p className="text-xs text-[#9b9690] mb-6">Membantu melacak kebiasaan dan kemajuan tulisan Anda.</p>
                    <canvas ref={progressCanvasRef} className="w-full h-[200px] rounded-xl border border-[#e8e5df]" />
                  </div>

                  {/* Portfolio breakdown history logs snippet table */}
                  <div className="bg-white border border-[#e8e5df] p-6 rounded-2xl shadow-sm">
                    <h4 className="text-sm font-bold text-neutral-800 uppercase font-['Syne'] border-b border-[#f2f0ec] pb-3 mb-4">Riwayat Evaluasi Script</h4>
                    <div className="flex flex-col gap-3">
                      {savedScripts.map(s => (
                        <div key={s.id} className="flex justify-between items-center text-xs p-2 rounded hover:bg-[#fbfbf9]">
                          <div>
                            <span className="font-extrabold text-neutral-800 block">{s.title}</span>
                            <span className="text-[#9b9690] mt-0.5">{s.framework?.name || 'Kustom'}</span>
                          </div>
                          <span className={`px-2 py-0.5 rounded font-black ${
                            (s.scores?.overall || 0) >= 80 ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                          }`}>
                            {s.scores?.overall || 60}/100
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* AI Personalized Marketing Diagnostics Panel */}
                <div className="lg:col-span-4 block">
                  <div className="bg-gradient-to-br from-[#7b68ee] to-[#6855dd] text-white p-6 rounded-3xl shadow-md flex flex-col gap-4">
                    <h4 className="text-md font-extrabold font-['Syne'] uppercase flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4" /> AI Diagnostics Insight
                    </h4>
                    <p className="text-[12px] leading-relaxed opacity-90">
                      Rangkum semua naskah dan berikan tips pembenahan yang harus disempurnakan.
                    </p>

                    <div className="flex flex-col gap-3 bg-white/10 p-4 rounded-2xl border border-white/10 text-white">
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] uppercase font-bold tracking-wider opacity-85">Target Produk / Bisnis Niche Anda</label>
                        <input
                          type="text"
                          placeholder="e.g. Skin Care Jerawat Sensitif"
                          value={profileProduct}
                          onChange={e => setProfileProduct(e.target.value)}
                          className="w-full bg-white/20 border border-white/20 rounded-lg px-3 py-1.5 text-xs text-white placeholder-white/50 focus:outline-none"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] uppercase font-bold tracking-wider opacity-85">Target Audience Utama</label>
                        <input
                          type="text"
                          placeholder="e.g. Remaja umur 15-22 tahun"
                          value={profileAudience}
                          onChange={e => setProfileAudience(e.target.value)}
                          className="w-full bg-white/20 border border-white/20 rounded-lg px-3 py-1.5 text-xs text-white placeholder-white/50 focus:outline-none"
                        />
                      </div>

                      <button
                        onClick={requestPersonalizedInsights}
                        disabled={insightsLoading}
                        className="w-full mt-2 py-2 rounded-full bg-white text-[#7b68ee] font-bold text-xs hover:bg-neutral-50 transition-all shadow btn"
                      >
                        {insightsLoading ? 'Memproses Insight...' : 'Generate Rekomendasi Taktis AI'}
                      </button>
                    </div>

                    {/* Insights outcomes */}
                    {insightsResult && (
                      <div className="bg-white text-neutral-800 p-4 rounded-2xl border border-neutral-100 flex flex-col gap-3">
                        <div>
                          <span className="text-[9px] uppercase font-bold text-[#9b9690] tracking-wider block">Diagnostik Persona Penulis:</span>
                          <p className="text-[12px] font-extrabold text-[#7b68ee] leading-tight mt-1">{insightsResult.generalScoreText}</p>
                        </div>

                        <div>
                          <span className="text-[9px] uppercase font-bold text-[#9b9690] tracking-wider block">Diskon Funnel Seimbang:</span>
                          <span className="text-[11px] font-bold text-[#1a1814] leading-relaxed block mt-1">{insightsResult.contentFunnelBalance?.diagnosisText}</span>
                        </div>

                        <div>
                          <span className="text-[9px] uppercase font-bold text-[#9b9690] tracking-wider block">Rekomendasi Utama:</span>
                          {insightsResult.recommendations?.map((item: any, idx: number) => (
                            <div key={idx} className="mt-2 border-l-2 border-[#7b68ee] pl-2 py-0.5">
                              <span className="text-[11px] font-bold text-[#1a1814] block">{item.title}</span>
                              <span className="text-[10px] text-[#5a5650] block mt-0.5">{item.action}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

              </div>
            )}
          </div>
        )}

      </main>

      {/* FOOTER GENERAL DIAGNOSTIC */}
      <footer className="w-full border-t border-[#e8e5df] bg-white py-6 mt-16 text-center text-xs text-[#9b9690]">
        <p>© 2026 Buzz Pilot.</p>
      </footer>

      {/* --- ALL MODALS DIAGNOSTIC OVERLAYS --- */}

      {/* Toast Alert popup */}
      <div className={`toast fixed bottom-6 right-6 z-50 px-5 py-3 rounded-full bg-[#1a1814] text-white text-xs font-bold shadow-lg transition-all transform duration-300 ${
        toastOpen ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0 pointer-events-none'
      }`}>
        {toastMsg}
      </div>

      {/* Saved Script Save Confirm modal */}
      {showSaveConfirmModal && (
        <div className="fixed inset-0 bg-neutral-900/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-xl border border-neutral-100 animate-slide-up">
            <h3 className="text-lg font-extrabold text-[#1a1814] font-['Syne']">Simpan Content Final</h3>
            <p className="text-xs text-[#9b9690] mt-1.5 leading-relaxed">Berikan judul taktis agar mudah dinilai di riwayat portofolio Anda.</p>
            
            <input
              type="text"
              value={saveConfirmTitle}
              onChange={e => setSaveConfirmTitle(e.target.value)}
              placeholder="e.g. Script Launching Skincare Jerawat"
              className="w-full px-4 py-2 border border-[#border2] rounded-full text-xs mt-4 ai-focus"
            />

            <div className="flex gap-2 justify-end mt-6">
              <button 
                onClick={() => setShowSaveConfirmModal(false)}
                className="px-4 py-2 border border-[#border2] rounded-full text-xs font-bold text-[#5a5650] hover:bg-neutral-50"
              >
                Batal
              </button>
              <button 
                onClick={confirmSaveAction}
                className="bg-[#22c897] text-white font-bold text-xs px-5 py-2 rounded-full hover:bg-[#1bb386]"
              >
                Konfirmasi Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Saved Script Rename title modal */}
      {showRenameModalId !== null && (
        <div className="fixed inset-0 bg-neutral-900/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-xl border border-neutral-100 animate-slide-up">
            <h3 className="text-lg font-extrabold text-[#1a1814] font-['Syne']">Rename Script Title</h3>
            <p className="text-xs text-[#9b9690] mt-1">Ubah judul identifikasi untuk script terpilih di bawah.</p>
            
            <input
              type="text"
              value={renameInput}
              onChange={e => setRenameInput(e.target.value)}
              className="w-full px-4 py-2 border border-[#border2] rounded-full text-xs mt-4 ai-focus"
            />

            <div className="flex gap-2 justify-end mt-6">
              <button 
                onClick={() => setShowRenameModalId(null)}
                className="px-4 py-2 border border-[#border2] rounded-full text-xs font-bold text-[#5a5650]"
              >
                Cancel
              </button>
              <button 
                onClick={() => renameScript(showRenameModalId)}
                className="bg-neutral-800 text-white font-bold text-xs px-4 py-2 rounded-full hover:bg-neutral-950"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Supabase Authorization login/signup modal */}
      {showAuthModal && (
        <div className="fixed inset-0 bg-neutral-900/60 flex items-center justify-center z-50 p-4">
          <form onSubmit={handleAuthSubmit} className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-xl border border-neutral-100 flex flex-col gap-4 animate-slide-up">
            <div>
              <h3 className="text-lg font-extrabold text-[#1a1814] font-['Syne'] flex items-center gap-1.5">
                <Database className="w-5 h-5 text-[#7b68ee]" /> Supabase Authorization
              </h3>
              <p className="text-xs text-[#9b9690] mt-1 leading-relaxed">
                Gunakan email Anda untuk tersambung ke portofolio online kami. Akun baru otomatis terdaftar!
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] uppercase font-bold text-[#5a5650]">Email Address</label>
              <input 
                type="email"
                required
                value={userEmail}
                onChange={e => setUserEmail(e.target.value)}
                placeholder="e.g. reyhanresha87@gmail.com"
                className="w-full px-4 py-2 border border-[#border2] rounded-full text-xs ai-focus"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] uppercase font-bold text-[#5a5650]">Password</label>
              <input 
                type="password"
                required
                value={userPassword}
                onChange={e => setUserPassword(e.target.value)}
                placeholder="Min 6 karakter"
                className="w-full px-4 py-2 border border-[#border2] rounded-full text-xs ai-focus"
              />
            </div>

            {authError && <div className="text-[11px] text-[#e8476a] font-semibold">{authError}</div>}

            <div className="flex gap-2 justify-end mt-4">
              <button 
                type="button"
                onClick={() => setShowAuthModal(false)}
                className="px-4 py-2 border border-[#border2] rounded-full text-xs font-bold text-[#5a5650]"
              >
                Batal
              </button>
              <button 
                type="submit"
                disabled={authLoading}
                className="bg-[#7b68ee] text-white font-bold text-xs px-5 py-2 rounded-full hover:bg-[#6855dd] disabled:opacity-50"
              >
                {authLoading ? 'Signing In...' : 'Masuk / Daftar'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Supabase Technical configuration drawer */}
      {showSupabaseModal && (
        <div className="fixed inset-0 bg-neutral-900/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg p-6 shadow-xl border border-neutral-100 flex flex-col gap-4 animate-slide-up max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-extrabold text-[#1a1814] font-['Syne'] flex items-center gap-1.5">
                  <Database className="w-5 h-5 text-[#7b68ee]" /> Status Koneksi Database Supabase
                </h3>
                <p className="text-xs text-[#9b9690] mt-1">Metode peyimpanan portofolio dan jadwal kampanye pemasaran.</p>
              </div>
              <button onClick={() => setShowSupabaseModal(false)} className="text-[#9b9690] hover:text-black">✕</button>
            </div>

            <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-100 text-xs flex flex-col gap-2">
              <div className="flex justify-between">
                <span>Status Client Supabase:</span>
                <span className={supabase ? 'text-[#16a34a] font-bold' : 'text-[#e8476a] font-bold'}>
                  {supabase ? 'Linked & Terhubung' : 'Offline / Sandbox'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Mode Penyimpanan:</span>
                <span className="font-semibold text-[#5a5650]">{supabase ? 'PostgreSQL Database Cloud' : 'LocalStorage Sandbox'}</span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <h4 className="text-xs font-bold text-[#1a1814] uppercase">Cara Menghubungkan Supabase Cloud Anda:</h4>
              <p className="text-[11px] text-[#5a5650] leading-relaxed">
                Untuk menyimpan naskah secara online selamanya di seluruh perangkat, buat project baru di <strong className="text-neutral-800">supabase.com</strong> secara gratis, kemudian pasang variabel berikut ke panel <strong className="text-[#7b68ee]">Settings &gt; Secrets</strong> di AI Studio:
              </p>
              <div className="bg-neutral-800 text-neutral-300 p-3 rounded-lg text-[10px] font-mono select-all">
                VITE_SUPABASE_URL="https://your-project.supabase.co"<br/>
                VITE_SUPABASE_ANON_KEY="your-anon-public-key"
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <h4 className="text-xs font-bold text-[#1a1814] uppercase">SQL Query Konstruksi Skema Supabase:</h4>
              <p className="text-[11px] text-[#5a5650] leading-relaxed">
                Jalankan perintah SQL ini di menu SQL Editor pada dashboard Supabase untuk menyiapkan tabel secara instan:
              </p>
              <div className="bg-neutral-800 text-neutral-300 p-3 rounded-lg text-[9px] font-mono max-h-[150px] overflow-y-auto select-all leading-normal">
                {`CREATE TABLE IF NOT EXISTS buzzpilot_scripts (
  id bigint primary key generated always as identity,
  user_id uuid,
  title text not null,
  script text not null,
  framework_id int not null,
  framework_name text not null,
  framework_funnel text not null,
  scores jsonb not null,
  caption text,
  hashtags text[] default '{}',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

CREATE TABLE IF NOT EXISTS buzzpilot_calendar (
  id bigint primary key generated always as identity,
  user_id uuid,
  date_key text not null,
  saved_id bigint,
  title text,
  fw_name text,
  fw_id int,
  funnel text not null,
  score int,
  note text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);`}
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-[#e8e5df] flex justify-end">
              <button 
                onClick={() => setShowSupabaseModal(false)}
                className="bg-[#1a1814] text-white font-bold text-xs px-5 py-2 rounded-full hover:bg-neutral-800"
              >
                Selesai
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- ADD CONTENT TO CALENDAR DAY MODAL --- */}
      {calDateSelection !== null && (
        <div className="fixed inset-0 bg-neutral-900/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-xl border border-neutral-100 flex flex-col gap-4 animate-slide-up">
            <div>
              <h3 className="text-lg font-extrabold text-[#1a1814] font-['Syne']">Atur Jadwal Kampanye</h3>
              <p className="text-xs text-[#9b9690] mt-1">Pilih script portofolio Anda atau sebuah pola framework untuk hari: <strong className="text-neutral-800">{calDateSelection}</strong></p>
            </div>

            {/* Selector Tab Mode */}
            <div className="grid grid-cols-2 bg-[#f2f0ec] p-1 rounded-full text-center text-xs font-bold">
              <button 
                onClick={() => setCalTabMode('saved')}
                className={`py-1.5 rounded-full ${calTabMode === 'saved' ? 'bg-white text-neutral-800 shadow-sm' : 'text-[#7a7a72]'}`}
              >
                Saved Script
              </button>
              <button 
                onClick={() => setCalTabMode('fw')}
                className={`py-1.5 rounded-full ${calTabMode === 'fw' ? 'bg-white text-neutral-800 shadow-sm' : 'text-[#7a7a72]'}`}
              >
                Framework Item
              </button>
            </div>

            {/* List panel selectors */}
            {calTabMode === 'saved' ? (
              <div className="max-h-[140px] overflow-y-auto border border-[#border2] rounded-xl bg-[#fbfbf9] p-2 flex flex-col gap-1">
                {savedScripts.length === 0 ? (
                  <p className="text-[11px] text-center text-neutral-400 py-6">Portofolio Anda masih kosong.</p>
                ) : (
                  savedScripts.map(s => (
                    <button
                      key={s.id}
                      onClick={() => setCalSelSavedId(s.id)}
                      className={`p-2 rounded text-left text-[11px] transition-all flex justify-between ${
                        calSelSavedId === s.id ? 'bg-[#eeebff] text-[#7b68ee] font-bold' : 'hover:bg-white text-neutral-600'
                      }`}
                    >
                      <span className="truncate">{s.title}</span>
                      <span className="text-[9px] text-[#9b9690] uppercase ml-2">{s.framework?.funnel}</span>
                    </button>
                  ))
                )}
              </div>
            ) : (
              <div className="max-h-[140px] overflow-y-auto border border-[#border2] rounded-xl bg-[#fbfbf9] p-2 flex flex-col gap-1">
                {FW.map(f => (
                  <button
                    key={f.id}
                    onClick={() => setCalSelFWId(f.id)}
                    className={`p-2 rounded text-left text-[11px] transition-all flex justify-between ${
                      calSelFWId === f.id ? 'bg-[#eeebff] text-[#7b68ee] font-bold' : 'hover:bg-white text-neutral-600'
                    }`}
                  >
                    <span>{f.name}</span>
                    <span className="text-[9px] text-[#9b9690] uppercase ml-2">{f.funnel}</span>
                  </button>
                ))}
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] uppercase font-bold text-[#5a5650]">Catatan Internal Kampanye (opsional)</label>
              <input
                type="text"
                placeholder="e.g. Gimmick rilis video jam 7 malam"
                value={calNoteInput}
                onChange={e => setCalNoteInput(e.target.value)}
                className="w-full px-4 py-2 border border-[#border2] rounded-full text-xs ai-focus"
              />
            </div>

            <div className="flex gap-2 justify-end mt-4">
              <button 
                onClick={() => setCalDateSelection(null)}
                className="px-4 py-2 border border-[#border2] rounded-full text-xs font-bold text-[#5a5650] hover:bg-neutral-50"
              >
                Batal
              </button>
              <button 
                onClick={saveCalDayEntry}
                className="bg-[#1a1814] text-white font-bold text-xs px-5 py-2 rounded-full hover:bg-neutral-800"
              >
                Simpan Jadwal
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );

  // Helper page navigation
  function gotoPage(tabId: 'frameworks' | 'builder' | 'analyzer' | 'saved' | 'ai' | 'calendar' | 'progress') {
    setActiveTab(tabId);
  }
}
