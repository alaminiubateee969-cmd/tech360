'use client';

import { useEffect } from 'react';

declare global {
  interface Window {
    dataLayer?: unknown[];
    fbq?: (...args: unknown[]) => void;
    tech360Track?: (event: string, properties?: Record<string, unknown>) => void;
  }
}

export function AnalyticsTracker() {
  useEffect(() => {
    // Check consent
    const consent = document.cookie
      .split('; ')
      .find((row) => row.startsWith('tech360_consent='))
      ?.split('=')[1];

    if (consent === 'granted') {
      // Load Google Tag Manager
      const GTM_ID = 'GTM-TM87LDXK';
      if (!document.getElementById('gtm-script')) {
        const script = document.createElement('script');
        script.id = 'gtm-script';
        script.innerHTML = `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${GTM_ID}');`;
        document.head.appendChild(script);
      }

      // Load Meta Pixel
      const META_PIXEL_ID = '957513230517009';
      if (!document.getElementById('meta-pixel-script')) {
        const script = document.createElement('script');
        script.id = 'meta-pixel-script';
        script.innerHTML = `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init', '${META_PIXEL_ID}');fbq('track', 'PageView');`;
        document.head.appendChild(script);
      }
    }

    // First-party tracking (always fires)
    window.tech360Track = (event: string, properties?: Record<string, unknown>) => {
      fetch('/api/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event, properties }),
      }).catch(() => {});

      // Also push to GTM if consented
      if (consent === 'granted') {
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({ event, ...properties });

        if (typeof window.fbq !== 'undefined') {
          if (event === 'project_brief_submit' || event === 'meeting_request') {
            window.fbq('track', 'Lead', properties);
          } else if (event === 'whatsapp_click') {
            window.fbq('trackCustom', 'WhatsAppClick', properties);
          }
        }
      }
    };

    // Track page view on load
    window.tech360Track('page_view', { page: window.location.pathname });

    // Track WhatsApp clicks
    const handleWhatsAppClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const link = target.closest('a[href*="wa.me"]') || target.closest('a[href*="whatsapp"]');
      if (link) {
        window.tech360Track?.('whatsapp_click', { page: window.location.pathname });
      }
    };

    // Track email clicks
    const handleEmailClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const link = target.closest('a[href^="mailto:"]');
      if (link) {
        window.tech360Track?.('email_click', { page: window.location.pathname });
      }
    };

    document.addEventListener('click', handleWhatsAppClick);
    document.addEventListener('click', handleEmailClick);

    return () => {
      document.removeEventListener('click', handleWhatsAppClick);
      document.removeEventListener('click', handleEmailClick);
    };
  }, []);

  return null;
}
