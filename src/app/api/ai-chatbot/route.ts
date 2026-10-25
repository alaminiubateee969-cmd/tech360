import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

const AI_PROVIDER_ORDER = (process.env.AI_PROVIDER_ORDER || 'ollama,openai-compatible,zai').split(',');

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message required' }, { status: 400 });
    }

    // Build knowledge base context from existing knowledge articles
    const knowledgeDocs = await db.knowledgeArticle.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
    });

    const knowledgeText = knowledgeDocs
      .map((d) => `[${d.category || 'general'}] ${d.title}: ${d.content?.substring(0, 500) || ''}`)
      .join('\n');

    const systemPrompt = `You are the Tech360 website AI assistant. Be helpful, concise, and professional.

Tech360 tagline: "Strategy. Software. Automation. Growth."
Domain: https://bdtech360.com
Contact: info@bdtech360.com | WhatsApp: +880 1327-100297

Key policies:
- HTML Preview Before Payment. Source Code After Full Payment.
- After Scope of Work approval, payments are non-refundable (except where required by law).
- 30-day post-delivery bug-fix support included.
- 5-gate source code protection: scope_approved → payment_verified → qa_passed → admin_approval → password_rotation.

Knowledge base:
${knowledgeText}

Answer based on TECH360's real services and policies. If asked about refunds, explain WHEN (after scope approval = non-refundable), WHY (customized services are project-specific), and HOW (submit via client portal, admin reviews, not auto-approved).`;

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: message },
    ];

    // Try AI providers in order
    let aiResponse: string | null = null;
    let providerUsed = '';

    for (const provider of AI_PROVIDER_ORDER) {
      try {
        const result = await callAIProvider(provider.trim(), messages);
        if (result) {
          aiResponse = result;
          providerUsed = provider.trim();
          break;
        }
      } catch (e) {
        console.error(`Provider ${provider} failed:`, e);
        continue;
      }
    }

    // Fallback: knowledge-base-aware response
    if (!aiResponse) {
      aiResponse = buildFallback(message, knowledgeDocs);
      providerUsed = 'fallback';
    }

    // Log the chat (first-party, anonymous)
    try {
      const cookieStore = await (await import('next/headers')).cookies();
      const visitorId = cookieStore.get('tech360_vid')?.value || 'anonymous';
      await db.marketingEvent.create({
        data: {
          visitorId,
          eventName: 'ai_chat',
          page: '/ai-chatbot',
          utmSource: null,
          utmCampaign: null,
          consentStatus: 'pending',
        },
      });
    } catch {}

    return NextResponse.json({
      success: true,
      response: aiResponse,
      provider: providerUsed,
    });
  } catch (error) {
    console.error('AI chat error:', error);
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
}

async function callAIProvider(provider: string, messages: ChatMessage[]): Promise<string | null> {
  const providerConfig: Record<string, { url: string; key: string; model: string }> = {
    'openai-compatible': {
      url: process.env.UNOROUTER_API_ENDPOINT || 'https://api.unorouter.com/v1/chat/completions',
      key: process.env.UNOROUTER_API_KEY || process.env.OPENROUTER_API_KEY || '',
      model: process.env.AI_MODEL || 'gpt-4o-mini',
    },
    zai: {
      url: `${process.env.ZAI_BASE_URL || 'https://api.z.ai/api/paas/v4'}/chat/completions`,
      key: process.env.ZAI_API_KEY || '',
      model: process.env.AI_MODEL || 'glm-4-flash',
    },
    ollama: {
      url: `${process.env.LOCAL_MODEL_BASE_URL || 'http://127.0.0.1:11434'}/v1/chat/completions`,
      key: process.env.LOCAL_MODEL_API_KEY || 'ollama',
      model: process.env.LOCAL_MODEL_CHAT_MODEL || 'qwen2.5:32b',
    },
    deepseek: {
      url: 'https://api.deepseek.com/v1/chat/completions',
      key: process.env.DEEPSEEK_API_KEY || '',
      model: 'deepseek-chat',
    },
  };

  const config = providerConfig[provider];
  if (!config || !config.key) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), parseInt(process.env.AGENT_RUN_TIMEOUT_MS || '60000'));

  try {
    const response = await fetch(config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.key}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        temperature: 0.4,
        max_tokens: 2000,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      console.error(`${provider} returned ${response.status}`);
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    return content || null;
  } catch (error) {
    clearTimeout(timeout);
    console.error(`${provider} call failed:`, error);
    return null;
  }
}

function buildFallback(message: string, knowledge: { title: string; content?: string | null; category?: string | null }[]): string {
  const msg = message.toLowerCase();
  const prefix = "I apologize — our AI service is temporarily offline. Here's what I can tell you from our knowledge base:\n\n";

  if (msg.includes('refund') || msg.includes('money back') || msg.includes('cancel')) {
    return prefix +
      "REFUND POLICY: After Scope of Work approval, project payments are NON-REFUNDABLE. " +
      "WHEN refunds are NOT given: After scope approval (because customized services cannot be resold). " +
      "WHEN refunds MAY be considered: (1) Before scope approval, (2) If required by law, " +
      "(3) If TECH360 voluntarily agrees in writing. " +
      "HOW to request: Submit via client portal, admin reviews (not auto-approved). " +
      "Full policy: https://bdtech360.com/refund-policy";
  }

  if (msg.includes('price') || msg.includes('cost') || msg.includes('budget')) {
    return prefix +
      "PRICING: Starter from $750, Professional from $2,500, Business Systems from $5,000, " +
      "Custom Software from $10,000, Enterprise custom estimate. " +
      "Final price locked in approved Scope of Work before payment. " +
      "See: https://bdtech360.com/pricing";
  }

  if (msg.includes('payment') || msg.includes('pay')) {
    return prefix +
      "PAYMENT POLICY: Full payment due after scope approval, before development. " +
      "HTML Preview Before Payment. Source Code After Full Payment. " +
      "Accepted: Stripe (cards), PayPal, bank transfer. " +
      "Verification: HMAC-signed webhook (server-side). " +
      "Full policy: https://bdtech360.com/payment-policy";
  }

  if (msg.includes('delivery') || msg.includes('source code') || msg.includes('handover')) {
    return prefix +
      "DELIVERY POLICY: Source code released only after 5 gates pass: " +
      "(1) Scope approved, (2) Payment verified, (3) QA passed, " +
      "(4) Admin approval, (5) Password rotation. " +
      "Source files stored outside public root, served via signed URLs. " +
      "Full policy: https://bdtech360.com/delivery-policy";
  }

  if (msg.includes('service') || msg.includes('what do you do') || msg.includes('offer')) {
    return prefix +
      "TECH360 provides: Premium Websites, eCommerce Platforms, Custom CRM, " +
      "Business Management Software, Client Portals, Admin Dashboards, " +
      "WhatsApp Automation, Email Automation, n8n Workflow, API Integration, " +
      "AI-Powered Automation, Custom AI Applications, Business Analytics, " +
      "Cloud Deployment, Database Systems, and more. " +
      "See: https://bdtech360.com/services";
  }

  if (msg.includes('contact') || msg.includes('email') || msg.includes('whatsapp') || msg.includes('reach')) {
    return prefix +
      "CONTACT: Email info@bdtech360.com | WhatsApp +880 1327-100297 | " +
      "Web https://bdtech360.com | Start a project: https://bdtech360.com/project-brief";
  }

  // Default: list available topics
  const topics = knowledge.slice(0, 5).map((d) => `• ${d.title}`).join('\n');
  return prefix +
    "I can help with:\n" +
    "• Services & pricing\n• Refund policy (when, why, how)\n• Payment & delivery policies\n• Project workflow\n• Contact\n\n" +
    (topics ? `Knowledge base topics:\n${topics}\n\n` : '') +
    "For specific questions, email info@bdtech360.com or visit https://bdtech360.com/contact";
}
