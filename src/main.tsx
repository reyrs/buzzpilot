import {StrictMode, useState} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import ErrorBoundary from './components/ErrorBoundary.tsx';
import OnboardingTour from './components/OnboardingTour.tsx';
import './index.css';

function Root() {
  const [showOnboarding, setShowOnboarding] = useState<boolean>(() => {
    return !localStorage.getItem('buzzpilot_onboarding_done');
  });

  const handleNavigate = (tab: string) => {
    // Dispatch custom event so App.tsx can listen
    window.dispatchEvent(new CustomEvent('navigate-tab', { detail: tab }));
  };

  return (
    <StrictMode>
      <ErrorBoundary>
        {showOnboarding && (
          <OnboardingTour
            onComplete={() => setShowOnboarding(false)}
            onNavigate={handleNavigate}
          />
        )}
        <App />
      </ErrorBoundary>
    </StrictMode>
  );
}

createRoot(document.getElementById('root')!).render(<Root />);
