'use client';

import { useState } from 'react';

const BUSINESS_TYPES = ['Education', 'eCommerce', 'Healthcare', 'Real Estate', 'Restaurant', 'Professional Services', 'Retail', 'Manufacturing', 'Logistics', 'Travel', 'Hospitality', 'Technology', 'SaaS', 'Finance', 'Construction', 'Other'];
const PROJECT_TYPES = ['Website', 'eCommerce', 'CRM', 'Automation', 'WhatsApp', 'AI Application', 'Custom Software', 'Dashboard', 'Other'];

export default function MeetingRequestPage() {
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());
    try {
      const res = await fetch('/api/meeting-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (result.success) {
        setSuccess(result.message);
        (e.target as HTMLFormElement).reset();
      } else {
        setError(result.error || 'Submission failed');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="max-w-2xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-slate-900 mb-4">
            Request a <span className="bg-gradient-to-r from-blue-600 to-green-500 bg-clip-text text-transparent">Meeting</span>
          </h1>
          <p className="text-lg text-slate-600">Prefer to talk? Book a meeting. We'll confirm your preferred time via email within 24 business hours.</p>
        </div>
        {success && <div className="bg-green-50 border border-green-200 text-green-800 p-4 rounded-xl mb-6">✅ {success}</div>}
        {error && <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-xl mb-6">❌ {error}</div>}
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-xl p-8 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Name *</label>
              <input name="name" type="text" required className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:border-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Company</label>
              <input name="company" type="text" className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:border-blue-500 outline-none" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email *</label>
              <input name="email" type="email" required className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:border-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">WhatsApp</label>
              <input name="whatsapp" type="text" placeholder="+880 1XXX-XXXXXX" className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:border-blue-500 outline-none" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Business Type</label>
              <select name="businessType" className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:border-blue-500 outline-none">
                <option value="">Select...</option>
                {BUSINESS_TYPES.map((bt) => <option key={bt} value={bt}>{bt}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Project Type</label>
              <select name="projectType" className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:border-blue-500 outline-none">
                <option value="">Select...</option>
                {PROJECT_TYPES.map((pt) => <option key={pt} value={pt}>{pt}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Preferred Date</label>
              <input name="preferredDate" type="date" min={new Date(Date.now() + 86400000).toISOString().split('T')[0]} className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:border-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Preferred Time</label>
              <input name="preferredTime" type="time" className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:border-blue-500 outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Timezone</label>
            <select name="timezone" className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:border-blue-500 outline-none">
              <option value="UTC">UTC</option>
              <option value="Asia/Dhaka" selected>Asia/Dhaka (GMT+6)</option>
              <option value="America/New_York">America/New_York (EST)</option>
              <option value="America/Chicago">America/Chicago (CST)</option>
              <option value="Europe/London">Europe/London (GMT)</option>
              <option value="Asia/Dubai">Asia/Dubai (GST)</option>
              <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Message (optional)</label>
            <textarea name="message" rows={4} placeholder="Anything specific you'd like to discuss?" className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:border-blue-500 outline-none resize-y" />
          </div>
          <button type="submit" disabled={submitting} className="w-full bg-gradient-to-r from-blue-600 via-cyan-500 to-green-500 text-white py-4 rounded-xl font-semibold text-lg hover:shadow-xl transition-shadow disabled:opacity-50">
            {submitting ? '⏳ Submitting...' : '📅 Request Meeting'}
          </button>
        </form>
      </div>
    </div>
  );
}
