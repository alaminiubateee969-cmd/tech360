'use client';

import { useState } from 'react';

const BUSINESS_TYPES = ['Education', 'eCommerce', 'Healthcare', 'Real Estate', 'Restaurant', 'Professional Services', 'Retail', 'Manufacturing', 'Logistics', 'Travel', 'Hospitality', 'Technology', 'SaaS', 'Finance', 'Construction', 'Other'];
const PROJECT_TYPES = ['Website', 'eCommerce', 'CRM', 'Automation', 'WhatsApp', 'AI Application', 'Custom Software', 'Dashboard', 'Other'];

export default function ProjectBriefPage() {
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
      const res = await fetch('/api/project-brief', {
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
      <div className="max-w-3xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-slate-900 mb-4">
            Start a <span className="bg-gradient-to-r from-blue-600 to-green-500 bg-clip-text text-transparent">Project</span>
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Tell us about your project. We respond within 24 business hours with a formal Scope of Work.
          </p>
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
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Business Type</label>
              <select name="businessType" className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:border-blue-500 outline-none">
                <option value="">Select...</option>
                {BUSINESS_TYPES.map((bt) => <option key={bt} value={bt}>{bt}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Project Type *</label>
              <select name="projectType" required className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:border-blue-500 outline-none">
                <option value="">Select...</option>
                {PROJECT_TYPES.map((pt) => <option key={pt} value={pt}>{pt}</option>)}
              </select>
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
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Current Website (if any)</label>
            <input name="currentWebsite" type="url" placeholder="https://your-current-site.com" className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:border-blue-500 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Project Description *</label>
            <textarea name="projectDescription" rows={4} required placeholder="What problem are you trying to solve? What outcomes do you need?" className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:border-blue-500 outline-none resize-y" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Required Features</label>
            <textarea name="requiredFeatures" rows={3} placeholder="e.g., user login, payment processing, WhatsApp notifications..." className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:border-blue-500 outline-none resize-y" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Expected Timeline</label>
              <select name="expectedTimeline" className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:border-blue-500 outline-none">
                <option value="">Select...</option>
                <option value="asap">ASAP</option>
                <option value="1-month">Within 1 month</option>
                <option value="3-months">1-3 months</option>
                <option value="6-months">3-6 months</option>
                <option value="flexible">Flexible</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Reference Website (optional)</label>
              <input name="referenceWebsite" type="url" placeholder="https://site-you-like.com" className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:border-blue-500 outline-none" />
            </div>
          </div>
          <div className="bg-slate-50 rounded-lg p-4">
            <label className="flex items-start gap-2.5">
              <input name="consent" type="checkbox" value="granted" required className="mt-1" />
              <span className="text-sm text-slate-600">
                I consent to Tech360 processing my data per the <a href="/privacy-policy" target="_blank" className="text-blue-600 underline">Privacy Policy</a> to respond to this enquiry.
              </span>
            </label>
          </div>
          <button type="submit" disabled={submitting} className="w-full bg-gradient-to-r from-blue-600 via-cyan-500 to-green-500 text-white py-4 rounded-xl font-semibold text-lg hover:shadow-xl transition-shadow disabled:opacity-50">
            {submitting ? '⏳ Submitting...' : '🚀 Submit Project Brief'}
          </button>
        </form>
      </div>
    </div>
  );
}
