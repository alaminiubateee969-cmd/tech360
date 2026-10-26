export const metadata = { title: 'Payment Policy | Tech360', description: 'Tech360 payment policy — when payment is due, accepted methods, verification process, and invoicing.' };

export default function PaymentPolicyPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-4 py-16">
        <h1 className="text-4xl font-bold text-slate-900 mb-4">Payment Policy</h1>
        <p className="text-slate-600 mb-8"><strong>Effective Date: May 19, 2026</strong></p>

        <h2 className="text-2xl font-bold text-slate-900 mt-8 mb-3">1. When Payment Is Due</h2>
        <p className="text-slate-700 mb-4">Full payment is due after the client approves the Scope of Work and BEFORE development begins. Tech360 does not start development on credit — no exceptions. The payment flow is:</p>
        <ol className="list-decimal list-inside space-y-2 mb-4 text-slate-700">
          <li>Client reviews Scope of Work</li>
          <li>Client signs 5 acknowledgements (scope, preview, terms, refund, non-refundable)</li>
          <li>Invoice is generated with cryptographic hash seal</li>
          <li>Client initiates payment via Stripe or PayPal</li>
          <li>Payment is verified server-side (HMAC-signed webhook or admin verification)</li>
          <li>Project status transitions to PAYMENT_PAID</li>
          <li>Development begins</li>
        </ol>

        <h2 className="text-2xl font-bold text-slate-900 mt-8 mb-3">2. Accepted Payment Methods</h2>
        <ul className="list-disc list-inside space-y-2 mb-4 text-slate-700">
          <li><strong>Stripe:</strong> Credit/debit cards (Visa, Mastercard, American Express)</li>
          <li><strong>PayPal:</strong> PayPal balance, linked bank, or cards</li>
          <li><strong>Bank Transfer:</strong> For enterprise contracts only — contact info@bdtech360.com</li>
        </ul>

        <h2 className="text-2xl font-bold text-slate-900 mt-8 mb-3">3. Payment Verification</h2>
        <p className="text-slate-700 mb-4">Every payment is verified server-side. The client cannot mark their own payment as paid. Verification happens through:</p>
        <ul className="list-disc list-inside space-y-2 mb-4 text-slate-700">
          <li><strong>Webhook:</strong> Stripe/PayPal sends a HMAC-signed webhook. The signature is verified using constant-time comparison. Replay protection rejects webhooks older than 5 minutes.</li>
          <li><strong>Admin Verification:</strong> An admin can manually verify a payment. This is audit-logged with admin ID, IP, and timestamp.</li>
        </ul>

        <h2 className="text-2xl font-bold text-slate-900 mt-8 mb-3">4. Idempotency</h2>
        <p className="text-slate-700 mb-4">If a webhook is received for a transaction that has already been processed, the endpoint returns HTTP 200 with "already_processed" without making any database changes. This prevents duplicate processing.</p>

        <h2 className="text-2xl font-bold text-slate-900 mt-8 mb-3">5. Refund Policy</h2>
        <p className="text-slate-700 mb-4">After Scope of Work approval, payments are non-refundable except where required by applicable law or otherwise agreed in writing. See our full <a href="/refund-policy" className="text-blue-600 underline">Refund Policy</a> for details.</p>

        <h2 className="text-2xl font-bold text-slate-900 mt-8 mb-3">6. Contact</h2>
        <p className="text-slate-700">Payment questions? Email <a href="mailto:info@bdtech360.com" className="text-blue-600 underline">info@bdtech360.com</a> or WhatsApp <a href="https://wa.me/8801327100297" className="text-blue-600 underline">+880 1327-100297</a>.</p>
      </div>
    </div>
  );
}
