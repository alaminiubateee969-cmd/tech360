export const metadata = { title: 'Delivery Policy | Tech360', description: 'Tech360 delivery policy — how we deliver projects, source code protection, and the 5-gate authorization process.' };

export default function DeliveryPolicyPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-4 py-16">
        <h1 className="text-4xl font-bold text-slate-900 mb-4">Delivery Policy</h1>
        <p className="text-slate-600 mb-8"><strong>Effective Date: May 19, 2026</strong></p>

        <h2 className="text-2xl font-bold text-slate-900 mt-8 mb-3">1. HTML Preview Before Payment</h2>
        <p className="text-slate-700 mb-4">Where applicable, Tech360 provides an HTML or staging preview of the proposed work before any payment is collected. This allows the client to see what they are paying for and request changes before committing financially.</p>

        <h2 className="text-2xl font-bold text-slate-900 mt-8 mb-3">2. Source Code After Full Payment</h2>
        <p className="text-slate-700 mb-4">Final source code and applicable final project files are released to the client only after required/full payment has been verified according to the approved agreement. This is enforced through a 5-gate authorization system:</p>
        <ul className="list-disc list-inside space-y-2 mb-4 text-slate-700">
          <li><strong>Gate 1 — Scope Approved:</strong> Project has at least one Scope of Work with status "approved".</li>
          <li><strong>Gate 2 — Payment Verified:</strong> Project has a payment record with status "paid" (verified server-side via HMAC-signed webhook or admin verification).</li>
          <li><strong>Gate 3 — QA Passed:</strong> Quality assurance checks (code review, security scan, performance test) have passed.</li>
          <li><strong>Gate 4 — Admin Approval:</strong> Delivery record has admin_approval = "approved".</li>
          <li><strong>Gate 5 — Password Rotation:</strong> Password rotation is complete and credentials are ready for handover.</li>
        </ul>
        <p className="text-slate-700 mb-4">If ANY gate fails, source code download returns HTTP 403 Forbidden with the explicit reason. Source files are stored outside the public web root and are never accessible via direct URL.</p>

        <h2 className="text-2xl font-bold text-slate-900 mt-8 mb-3">3. Delivery Timeline</h2>
        <p className="text-slate-700 mb-4">Delivery timeline is defined in the approved Scope of Work. Delays caused by client-side feedback, content provision, or approval cycles extend the timeline accordingly. Tech360 is not liable for delays caused by client-side dependencies.</p>

        <h2 className="text-2xl font-bold text-slate-900 mt-8 mb-3">4. Acceptance Criteria</h2>
        <p className="text-slate-700 mb-4">Upon delivery, the client reviews the staging build against the acceptance criteria defined in the Scope of Work. The client signs an acceptance form to confirm the deliverable meets the agreed requirements. Bug-fix support (30 days) begins from acceptance.</p>

        <h2 className="text-2xl font-bold text-slate-900 mt-8 mb-3">5. Handover Components</h2>
        <ul className="list-disc list-inside space-y-2 mb-4 text-slate-700">
          <li>Source code package (ZIP, with SHA-256 hash for integrity verification)</li>
          <li>Deployment documentation</li>
          <li>Credentials handover (encrypted, with audit log)</li>
          <li>Acceptance form (signed by client, stored in evidence vault)</li>
          <li>30-day bug-fix support window activation</li>
        </ul>

        <h2 className="text-2xl font-bold text-slate-900 mt-8 mb-3">6. No Code Without Payment</h2>
        <p className="text-slate-700 mb-4">Tech360 will not release source code, database schemas, or deployment scripts before payment verification. This is a firm policy with no exceptions. Partial payments do not trigger partial code release — full payment is required.</p>

        <h2 className="text-2xl font-bold text-slate-900 mt-8 mb-3">7. Contact</h2>
        <p className="text-slate-700">Questions about delivery? Email <a href="mailto:info@bdtech360.com" className="text-blue-600 underline">info@bdtech360.com</a> or WhatsApp <a href="https://wa.me/8801327100297" className="text-blue-600 underline">+880 1327-100297</a>.</p>
      </div>
    </div>
  );
}
