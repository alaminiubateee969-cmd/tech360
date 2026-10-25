export const metadata = { title: 'Client Approval Policy | Tech360', description: 'Tech360 client approval policy — the 5 acknowledgements required for scope approval.' };

export default function ClientApprovalPolicyPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-4 py-16">
        <h1 className="text-4xl font-bold text-slate-900 mb-4">Client Approval Policy</h1>
        <p className="text-slate-600 mb-8"><strong>Effective Date: May 19, 2026</strong></p>

        <h2 className="text-2xl font-bold text-slate-900 mt-8 mb-3">1. The 5 Acknowledgements</h2>
        <p className="text-slate-700 mb-4">Before a project moves into development, the client must sign 5 acknowledgements. Each is a separate checkbox — the client cannot approve scope without checking all 5:</p>
        <ol className="list-decimal list-inside space-y-3 mb-4 text-slate-700">
          <li><strong>Scope Reviewed:</strong> I have reviewed the Scope of Work document and understand the deliverables, timeline, and pricing.</li>
          <li><strong>Preview Reviewed:</strong> I have reviewed the HTML or staging preview (where provided) and confirm it meets my expectations.</li>
          <li><strong>Terms Accepted:</strong> I accept the Terms & Conditions of Tech360.</li>
          <li><strong>Refund Policy Acknowledged:</strong> I have read and understood the Refund Policy.</li>
          <li><strong>Non-Refundable Acknowledged:</strong> I understand that after this approval, project payments are non-refundable except where required by applicable law or otherwise agreed in writing.</li>
        </ol>

        <h2 className="text-2xl font-bold text-slate-900 mt-8 mb-3">2. Immutable Snapshot</h2>
        <p className="text-slate-700 mb-4">When the client approves, an immutable snapshot of the scope is created. This snapshot includes scope ID, version, title, objective, features included/excluded, timeline, payment amount. The snapshot is hashed with SHA-256 and stored permanently. This prevents disputes about what was agreed.</p>

        <h2 className="text-2xl font-bold text-slate-900 mt-8 mb-3">3. Change Requests After Approval</h2>
        <p className="text-slate-700 mb-4">After approval, any change to the scope must be submitted through the Change Request system. Each change request is documented, priced separately, extends the timeline, requires admin review, and is audit-logged. Changes are NEVER informal — verbal agreements or WhatsApp messages do not modify the approved scope.</p>

        <h2 className="text-2xl font-bold text-slate-900 mt-8 mb-3">4. Withdrawal of Approval</h2>
        <p className="text-slate-700 mb-4">Approval cannot be withdrawn after payment is initiated. If the client wishes to cancel before payment, they must contact info@bdtech360.com immediately. Once payment is verified, the refund policy applies.</p>

        <h2 className="text-2xl font-bold text-slate-900 mt-8 mb-3">5. Contact</h2>
        <p className="text-slate-700">Questions about the approval process? Email <a href="mailto:info@bdtech360.com" className="text-blue-600 underline">info@bdtech360.com</a> or WhatsApp <a href="https://wa.me/8801327100297" className="text-blue-600 underline">+880 1327-100297</a>.</p>
      </div>
    </div>
  );
}
