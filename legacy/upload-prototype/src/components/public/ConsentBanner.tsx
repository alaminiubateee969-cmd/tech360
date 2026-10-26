'use client';

import { useState, useEffect } from 'react';

export function ConsentBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const consent = document.cookie
      .split('; ')
      .find((row) => row.startsWith('tech360_consent='))
      ?.split('=')[1];

    if (!consent) {
      // Show banner after 2s delay
      const timer = setTimeout(() => setShow(true), 2000);
      return () => clearTimeout(timer);
    }
  }, []);

  const recordConsent = async (status: 'granted' | 'denied') => {
    try {
      await fetch('/api/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          categories: ['necessary', 'analytics', 'marketing'],
        }),
      });
    } catch (e) {
      console.error('Consent recording failed:', e);
    }

    // Set cookie to prevent re-showing
    document.cookie = `tech360_consent=${status}; max-age=${525600 * 60}; path=/; SameSite=Lax${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;
    setShow(false);

    // Reload to activate/deactivate GTM + Pixel
    if (status === 'granted') {
      setTimeout(() => window.location.reload(), 500);
    }
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-[#152238] text-white p-4 z-[9998] shadow-lg flex items-center gap-6 flex-wrap text-sm">
      <div className="flex-1 min-w-[280px]">
        <strong>Cookie & Analytics Notice:</strong> We use only essential cookies for login/security.
        We'd like your consent to enable Google Analytics and Meta Pixel for marketing attribution.{' '}
        <a href="/cookie-policy" className="text-[#009FE3] underline">Cookie Policy</a>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => recordConsent('granted')}
          className="bg-[#18B83A] text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-[#15a333] transition-colors"
        >
          Accept All
        </button>
        <button
          onClick={() => recordConsent('denied')}
          className="bg-transparent text-white border border-white/40 px-5 py-2.5 rounded-lg hover:bg-white/10 transition-colors"
        >
          Necessary Only
        </button>
      </div>
    </div>
  );
}
