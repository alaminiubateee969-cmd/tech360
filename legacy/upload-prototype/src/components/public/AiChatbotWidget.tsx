'use client';

import { useState, useRef, useEffect } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export function AiChatbotWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: "👋 Hi! I'm the Tech360 AI Assistant. I can answer questions about:\n• Services & pricing\n• Refund policy (when, why, how)\n• Terms, privacy, cookie policies\n• Project workflow & delivery\n\nAsk me anything — every answer is grounded in TECH360's real policies.",
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMsg }]);
    setIsLoading(true);

    try {
      const res = await fetch('/api/ai-chatbot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg }),
      });
      const data = await res.json();
      if (data.success) {
        setMessages((prev) => [...prev, { role: 'assistant', content: data.response }]);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: 'I apologize — I had trouble processing that. Please try again or contact info@bdtech360.com.' },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Connection error. Please check your internet and try again.' },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-[9999]">
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="w-16 h-16 rounded-full bg-gradient-to-br from-[#063B8F] via-[#009FE3] to-[#18B83A] text-white shadow-lg flex items-center justify-center text-2xl hover:scale-110 transition-transform"
          aria-label="Open AI chat"
        >
          🤖
        </button>
      )}

      {isOpen && (
        <div className="absolute bottom-20 right-0 w-[380px] max-w-[calc(100vw-48px)] bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200">
          {/* Header */}
          <div className="bg-gradient-to-br from-[#063B8F] to-[#009FE3] text-white p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-xl">🤖</div>
            <div className="flex-1">
              <div className="font-bold text-sm">Tech360 Assistant</div>
              <div className="text-xs opacity-85 flex items-center gap-1">
                <span className="w-2 h-2 bg-[#18B83A] rounded-full animate-pulse" />
                Online — Real AI Agent
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-white text-xl hover:opacity-70">×</button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="p-4 h-80 overflow-y-auto bg-[#F4FAFF] flex flex-col gap-2.5">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`max-w-[85%] p-3 rounded-2xl text-sm shadow-sm ${
                  msg.role === 'user'
                    ? 'bg-gradient-to-br from-[#009FE3] to-[#00A8A8] text-white rounded-br-sm self-end'
                    : 'bg-white text-slate-800 rounded-bl-sm border border-slate-200'
                }`}
                style={{ whiteSpace: 'pre-wrap' }}
              >
                {msg.content}
              </div>
            ))}
            {isLoading && (
              <div className="bg-white p-3 rounded-2xl rounded-bl-sm border border-slate-200 flex gap-1.5 w-fit">
                <span className="w-2 h-2 bg-[#009FE3] rounded-full animate-bounce" />
                <span className="w-2 h-2 bg-[#009FE3] rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                <span className="w-2 h-2 bg-[#009FE3] rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
              </div>
            )}
          </div>

          {/* Input */}
          <div className="p-3 border-t border-slate-200 bg-white">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendMessage();
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type your question..."
                className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-[#009FE3]"
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="bg-[#009FE3] text-white px-4 py-2 rounded-lg font-semibold text-sm disabled:opacity-50"
              >
                ➤
              </button>
            </form>
            <p className="text-[0.65rem] text-slate-500 text-center mt-1.5">
              Powered by Tech360 AI Agent Platform — Real responses, not demo
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
