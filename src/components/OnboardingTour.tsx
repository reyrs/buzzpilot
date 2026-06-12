import React, { useState, useEffect, useCallback } from 'react';

const STEPS = [
  {
    title: 'Pilih Framework Pemasaran',
    description: 'Pilih dari 50+ framework viral blueprint (TOF/MOF/BOF) yang sesuai dengan strategi konten Anda.',
    targetTab: 'frameworks',
    icon: '🧭',
  },
  {
    title: 'Tulis Script di Builder',
    description: 'Gunakan panduan langkah demi langkah: pilih hook, isi slot tiap step framework, tambah caption & hashtag.',
    targetTab: 'builder',
    icon: '✍️',
  },
  {
    title: 'Analisis Skor Real-time',
    description: 'Lihat skor hook, readability, SEO, emotion, CTA + grafik retention + validasi AI DeepSeek.',
    targetTab: 'analyzer',
    icon: '📊',
  },
  {
    title: 'Generate Script dengan AI',
    description: 'Masukkan produk & target audiens, pilih tone, AI akan buatkan script lengkap siap pakai.',
    targetTab: 'ai',
    icon: '🤖',
  },
  {
    title: 'Rencana Konten 30 Hari',
    description: 'Atur jadwal konten di Campaign Calendar. AI bisa bantu generate rencana 30 hari otomatis!',
    targetTab: 'calendar',
    icon: '📅',
  },
];

interface OnboardingTourProps {
  onComplete: () => void;
  onNavigate: (tab: string) => void;
}

export default function OnboardingTour({ onComplete, onNavigate }: OnboardingTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0, width: 0, height: 0 });

  useEffect(() => {
    // Cek localStorage
    const done = localStorage.getItem('buzzpilot_onboarding_done');
    if (!done) {
      setIsVisible(true);
    }
  }, []);

  const updateTooltipPosition = useCallback(() => {
    const step = STEPS[currentStep];
    // Find the tab button by its text content
    const buttons = document.querySelectorAll('nav button');
    let targetBtn: Element | null = null;
    buttons.forEach((btn) => {
      if (btn.textContent?.includes(step.targetTab === 'ai' ? 'AI Script' : 
          step.targetTab === 'frameworks' ? 'Framework' :
          step.targetTab === 'builder' ? 'Builder' :
          step.targetTab === 'analyzer' ? 'Scorer' :
          step.targetTab === 'calendar' ? 'Calendar' : '')) {
        targetBtn = btn;
      }
    });

    if (targetBtn) {
      const rect = targetBtn.getBoundingClientRect();
      setTooltipPos({
        top: rect.bottom + 8,
        left: rect.left + rect.width / 2,
        width: rect.width,
        height: rect.height,
      });
    } else {
      // Fallback: center of screen
      setTooltipPos({
        top: window.innerHeight / 2,
        left: window.innerWidth / 2,
        width: 0,
        height: 0,
      });
    }
  }, [currentStep]);

  useEffect(() => {
    if (isVisible) {
      updateTooltipPosition();
      window.addEventListener('resize', updateTooltipPosition);
      return () => window.removeEventListener('resize', updateTooltipPosition);
    }
  }, [isVisible, currentStep, updateTooltipPosition]);

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
      onNavigate(STEPS[nextStep].targetTab);
    } else {
      completeOnboarding();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      const prevStep = currentStep - 1;
      setCurrentStep(prevStep);
      onNavigate(STEPS[prevStep].targetTab);
    }
  };

  const completeOnboarding = () => {
    localStorage.setItem('buzzpilot_onboarding_done', 'true');
    setIsVisible(false);
    onComplete();
  };

  if (!isVisible) return null;

  const step = STEPS[currentStep];
  const isLast = currentStep === STEPS.length - 1;
  const isFirst = currentStep === 0;
  const progress = ((currentStep + 1) / STEPS.length) * 100;

  return (
    <>
      {/* Overlay semi-transparan */}
      <div className="fixed inset-0 bg-black/50 z-[100] pointer-events-auto" />

      {/* Tooltip Card */}
      <div
        className="fixed z-[101] bg-white rounded-2xl shadow-2xl border border-[#e8e5df] p-6 w-[380px] max-w-[90vw] pointer-events-auto animate-fade-in-up"
        style={{
          top: tooltipPos.top,
          left: '50%',
          transform: 'translateX(-50%)',
          maxHeight: '80vh',
        }}
      >
        {/* Progress bar */}
        <div className="w-full h-1.5 bg-[#f2f0ec] rounded-full mb-4 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#7b68ee] to-[#6855dd] rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Step indicator */}
        <div className="text-[11px] font-bold text-[#9b9690] uppercase tracking-wider mb-2">
          Langkah {currentStep + 1} dari {STEPS.length}
        </div>

        {/* Icon + Title */}
        <div className="flex items-start gap-3 mb-3">
          <span className="text-3xl">{step.icon}</span>
          <div>
            <h3 className="text-lg font-extrabold text-[#1a1814] font-['Syne']">{step.title}</h3>
          </div>
        </div>

        {/* Description */}
        <p className="text-sm text-[#5a5650] leading-relaxed mb-6">
          {step.description}
        </p>

        {/* Navigation buttons */}
        <div className="flex items-center justify-between gap-3">
          {!isFirst ? (
            <button
              onClick={handlePrev}
              className="px-4 py-2 border border-[#e8e5df] rounded-full text-xs font-bold text-[#5a5650] hover:bg-[#fbfbf9] transition-all"
            >
              ← Sebelumnya
            </button>
          ) : (
            <div />
          )}

          <div className="flex gap-2">
            <button
              onClick={completeOnboarding}
              className="px-4 py-2 text-xs font-bold text-[#9b9690] hover:text-[#5a5650] transition-all"
            >
              Lewati
            </button>
            <button
              onClick={handleNext}
              className={`px-5 py-2 rounded-full text-xs font-bold text-white transition-all shadow-sm ${
                isLast
                  ? 'bg-gradient-to-r from-[#22c897] to-[#1bb386] hover:shadow-md'
                  : 'bg-gradient-to-r from-[#7b68ee] to-[#6855dd] hover:shadow-md'
              }`}
            >
              {isLast ? '✅ Mulai Sekarang' : 'Selanjutnya →'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}