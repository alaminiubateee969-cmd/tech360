<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>@yield('title', 'TECH360 — Connect • Innovate • Grow')</title>
    <meta name="description" content="@yield('description', 'TECH360 — Smart Technology Solutions for a Digital Tomorrow. Web, Cloud, Data, Software Development.')">
    <link rel="canonical" href="{{ url()->current() }}">
    <meta property="og:title" content="@yield('og_title', 'TECH360')">
    <meta property="og:description" content="@yield('og_description', 'Connect • Innovate • Grow')">
    <meta property="og:type" content="website">
    <meta property="og:image" content="@yield('og_image', asset('images/tech360-logo.png'))">
    <meta name="twitter:card" content="summary_large_image">
    <link href="{{ asset('css/app.css') }}" rel="stylesheet">
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" rel="stylesheet">
    @yield('head')
    <style>
        :root {
            --navy: #063B8F;
            --blue: #009FE3;
            --cyan: #00A8A8;
            --green: #18B83A;
            --bright-green: #20C94F;
            --white: #FFFFFF;
            --light-blue: #F4FAFF;
            --light-green: #F3FFF7;
            --primary-text: #152238;
            --secondary-text: #526173;
            --border: #E2E8F0;
            --shadow: 0 4px 24px rgba(6,59,143,0.08);
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Inter', -apple-system, system-ui, sans-serif; background: var(--white); color: var(--primary-text); line-height: 1.6; }
        h1, h2, h3, h4, h5, h6 { font-family: 'Poppins', sans-serif; font-weight: 700; color: var(--primary-text); }
        a { text-decoration: none; color: var(--blue); }
        .container { max-width: 1280px; margin: 0 auto; padding: 0 24px; }
        .gradient-tech { background: linear-gradient(90deg, #063B8F 0%, #009FE3 45%, #00A8A8 70%, #18B83A 100%); }
        .gradient-tech-diag { background: linear-gradient(135deg, #063B8F 0%, #009FE3 50%, #18B83A 100%); }
        .text-gradient { background: linear-gradient(90deg, #063B8F, #009FE3, #00A8A8, #18B83A); -webkit-background-clip: text; background-clip: text; color: transparent; }

        /* Header */
        .header { position: sticky; top: 0; z-index: 1000; background: var(--white); border-bottom: 1px solid var(--border); box-shadow: 0 2px 12px rgba(0,0,0,0.04); }
        .header-inner { display: flex; justify-content: space-between; align-items: center; height: 72px; }
        .logo { display: flex; align-items: center; gap: 10px; }
        .logo img { height: 40px; width: auto; }
        .logo-text { font-family: 'Poppins', sans-serif; font-size: 1.5rem; font-weight: 800; color: var(--navy); }
        .logo-slogan { font-size: 0.6rem; color: var(--secondary-text); letter-spacing: 0.1em; text-transform: uppercase; }
        .nav-links { display: flex; align-items: center; gap: 28px; }
        .nav-links a { color: var(--primary-text); font-size: 0.9rem; font-weight: 500; transition: color 0.2s; }
        .nav-links a:hover, .nav-links a.active { color: var(--blue); }
        .mobile-menu-btn { display: none; background: none; border: none; font-size: 1.5rem; color: var(--navy); cursor: pointer; }

        /* Buttons */
        .btn { display: inline-flex; align-items: center; gap: 8px; padding: 12px 28px; border-radius: 8px; font-size: 0.95rem; font-weight: 600; border: none; cursor: pointer; transition: all 0.2s; text-decoration: none; }
        .btn-primary { background: linear-gradient(90deg, var(--blue), var(--cyan)); color: var(--white); }
        .btn-primary:hover { background: var(--navy); transform: translateY(-1px); box-shadow: 0 4px 16px rgba(0,159,227,0.3); }
        .btn-gradient { background: linear-gradient(90deg, var(--navy), var(--blue), var(--cyan), var(--green)); color: var(--white); }
        .btn-outline { background: transparent; color: var(--navy); border: 2px solid var(--blue); }
        .btn-outline:hover { background: var(--blue); color: var(--white); }
        .btn-success { background: var(--green); color: var(--white); }
        .btn-danger { background: #DC2626; color: var(--white); }
        .btn-sm { padding: 8px 16px; font-size: 0.85rem; }

        /* Hero */
        .hero { background: linear-gradient(135deg, var(--light-blue) 0%, var(--white) 100%); padding: 80px 0; position: relative; overflow: hidden; }
        .hero-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; align-items: center; }
        .hero h1 { font-size: 3.2rem; line-height: 1.2; margin-bottom: 20px; }
        .hero p { font-size: 1.2rem; color: var(--secondary-text); margin-bottom: 32px; max-width: 500px; }
        .hero-cta { display: flex; gap: 16px; flex-wrap: wrap; }
        .hero-visual { display: flex; justify-content: center; align-items: center; }
        .hero-visual img { max-width: 100%; height: auto; }

        /* Sections */
        .section { padding: 80px 0; }
        .section-header { text-align: center; margin-bottom: 48px; }
        .section-header h2 { font-size: 2.5rem; margin-bottom: 12px; }
        .section-header p { color: var(--secondary-text); font-size: 1.1rem; max-width: 600px; margin: 0 auto; }
        .section-light { background: var(--light-blue); }
        .section-green { background: var(--light-green); }

        /* Cards */
        .grid { display: grid; gap: 24px; }
        .grid-2 { grid-template-columns: repeat(2, 1fr); }
        .grid-3 { grid-template-columns: repeat(3, 1fr); }
        .grid-4 { grid-template-columns: repeat(4, 1fr); }
        .card { background: var(--white); border-radius: 16px; padding: 32px; box-shadow: var(--shadow); transition: transform 0.2s, box-shadow 0.2s; border: 1px solid var(--border); }
        .card:hover { transform: translateY(-4px); box-shadow: 0 12px 32px rgba(6,59,143,0.12); }
        .card-icon { width: 56px; height: 56px; border-radius: 12px; display: flex; align-items: center; justify-content: center; margin-bottom: 20px; font-size: 1.5rem; }
        .card-icon.blue { background: rgba(0,159,227,0.1); color: var(--blue); }
        .card-icon.navy { background: rgba(6,59,143,0.1); color: var(--navy); }
        .card-icon.cyan { background: rgba(0,168,168,0.1); color: var(--cyan); }
        .card-icon.green { background: rgba(24,184,58,0.1); color: var(--green); }
        .card h3 { font-size: 1.3rem; margin-bottom: 10px; }
        .card p { color: var(--secondary-text); font-size: 0.95rem; }
        .card-img { width: 100%; height: 200px; object-fit: cover; border-radius: 12px; margin-bottom: 20px; }

        /* Stats */
        .stats-bar { display: flex; justify-content: space-around; flex-wrap: wrap; gap: 32px; padding: 48px 0; }
        .stat { text-align: center; }
        .stat-number { font-family: 'Poppins', sans-serif; font-size: 2.5rem; font-weight: 800; background: linear-gradient(90deg, var(--navy), var(--green)); -webkit-background-clip: text; background-clip: text; color: transparent; }
        .stat-label { color: var(--secondary-text); font-size: 0.9rem; }

        /* Forms */
        .form-group { margin-bottom: 16px; }
        .form-group label { display: block; margin-bottom: 6px; font-weight: 600; font-size: 0.9rem; color: var(--primary-text); }
        .form-group input, .form-group textarea, .form-group select { width: 100%; padding: 12px 16px; border: 1px solid var(--border); border-radius: 8px; font-size: 1rem; font-family: inherit; transition: border-color 0.2s; }
        .form-group input:focus, .form-group textarea:focus, .form-group select:focus { outline: none; border-color: var(--blue); box-shadow: 0 0 0 3px rgba(0,159,227,0.1); }
        .form-group input[type="checkbox"] { width: auto; }

        /* Alerts */
        .alert { padding: 12px 20px; border-radius: 8px; margin-bottom: 16px; }
        .alert-success { background: #dcfce7; color: #166534; border: 1px solid #86efac; }
        .alert-error { background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; }

        /* Footer */
        .footer { background: var(--navy); color: var(--white); padding: 64px 0 32px; }
        .footer-grid { display: grid; grid-template-columns: 2fr 1fr 1fr 1fr 1fr; gap: 40px; margin-bottom: 40px; }
        .footer h4 { color: var(--white); font-size: 1rem; margin-bottom: 16px; text-transform: uppercase; letter-spacing: 0.05em; }
        .footer a { color: rgba(255,255,255,0.7); font-size: 0.9rem; display: block; margin-bottom: 8px; transition: color 0.2s; }
        .footer a:hover { color: var(--bright-green); }
        .footer-bottom { text-align: center; padding-top: 32px; border-top: 1px solid rgba(255,255,255,0.1); }
        .footer-bottom p { font-size: 0.85rem; color: rgba(255,255,255,0.6); }

        /* CRM Dashboard */
        .crm-sidebar { width: 240px; background: var(--navy); min-height: calc(100vh - 72px); padding: 24px 0; }
        .crm-sidebar a { display: block; padding: 12px 24px; color: rgba(255,255,255,0.7); font-size: 0.9rem; transition: all 0.2s; }
        .crm-sidebar a:hover, .crm-sidebar a.active { background: rgba(255,255,255,0.1); color: var(--white); border-left: 3px solid var(--cyan); }
        .crm-main { flex: 1; padding: 32px; background: var(--light-blue); min-height: calc(100vh - 72px); }
        .stat-card { background: var(--white); border-radius: 12px; padding: 24px; box-shadow: var(--shadow); }
        .stat-card .number { font-size: 2rem; font-weight: 800; color: var(--navy); }
        .stat-card .label { color: var(--secondary-text); font-size: 0.85rem; }

        /* Table */
        .table { width: 100%; border-collapse: collapse; background: var(--white); border-radius: 12px; overflow: hidden; box-shadow: var(--shadow); }
        .table th { background: var(--navy); color: var(--white); padding: 12px 16px; text-align: left; font-size: 0.85rem; font-weight: 600; }
        .table td { padding: 12px 16px; border-bottom: 1px solid var(--border); font-size: 0.9rem; }
        .table tr:hover { background: var(--light-blue); }
        .badge { padding: 4px 10px; border-radius: 20px; font-size: 0.75rem; font-weight: 600; }
        .badge-blue { background: rgba(0,159,227,0.1); color: var(--blue); }
        .badge-green { background: rgba(24,184,58,0.1); color: var(--green); }
        .badge-red { background: rgba(220,38,38,0.1); color: #DC2626; }
        .badge-navy { background: rgba(6,59,143,0.1); color: var(--navy); }

        /* Responsive */
        @media (max-width: 1024px) { .hero-grid { grid-template-columns: 1fr; } .hero-visual { display: none; } .grid-3, .grid-4 { grid-template-columns: repeat(2, 1fr); } .footer-grid { grid-template-columns: 1fr 1fr; } }
        @media (max-width: 768px) { .nav-links { display: none; } .mobile-menu-btn { display: block; } .grid-2, .grid-3, .grid-4 { grid-template-columns: 1fr; } .hero h1 { font-size: 2rem; } .section { padding: 48px 0; } .crm-sidebar { display: none; } .crm-main { padding: 16px; } .footer-grid { grid-template-columns: 1fr; } .table { font-size: 0.8rem; } }
    </style>
</head>
<body>
    <header class="header">
        <div class="container header-inner">
            <a href="{{ route('home') }}" class="logo">
                <img src="{{ asset('images/tech360-logo.png') }}" alt="TECH360" onerror="this.style.display='none'">
                <div>
                    <div class="logo-text">TECH360</div>
                    <div class="logo-slogan">Connect • Innovate • Grow</div>
                </div>
            </a>
            <nav class="nav-links">
                <a href="{{ route("home") }}">Platform</a>
                <a href="{{ route("about") }}">Solutions</a>
                <a href="{{ route('services') }}">Services</a>
                <a href="{{ route("portfolio") }}">How It Works</a>
                <a href="{{ route('portfolio') }}">Portfolio</a>
                <a href="{{ route('blog') }}">Blog</a>
                <a href="{{ route('pricing') }}">Pricing</a>
                <a href="{{ route('contact') }}">Contact</a>
                @auth
                    @if(auth()->user()->isStaff())
                        <a href="{{ route('crm.dashboard') }}">CRM</a>
                        <a href="{{ route('admin.dashboard') }}">Admin</a>
                    @else
                        <a href="{{ route('client.dashboard') }}">Dashboard</a>
                    @endif
                    <form method="POST" action="{{ route('logout') }}" style="display:inline;">@csrf<button type="submit" class="btn btn-sm btn-outline" style="border-color:var(--navy);color:var(--navy);">Logout</button></form>
                @else
                    <a href="{{ route('login') }}" class="btn btn-sm btn-primary">Login</a>
                @endauth
            </nav>
            <button class="mobile-menu-btn" onclick="document.querySelector('.nav-links').classList.toggle('show')"><i class="fas fa-bars"></i></button>
        </div>
    </header>

    @if(session('success'))
        <div class="container" style="margin-top:16px;"><div class="alert alert-success"><i class="fas fa-check-circle"></i> {{ session('success') }}</div></div>
    @endif
    @if($errors->any())
        <div class="container" style="margin-top:16px;"><div class="alert alert-error">@foreach($errors->all() as $error){{ $error }}<br>@endforeach</div></div>
    @endif

    @yield('content')

    <footer class="footer">
        <div class="container">
            <div class="footer-grid">
                <div>
                    <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">
                        <div style="background:linear-gradient(90deg,var(--navy),var(--green));color:white;width:40px;height:40px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:1.2rem;">T</div>
                        <div><div style="font-size:1.3rem;font-weight:800;color:white;">TECH360</div><div style="font-size:0.6rem;color:rgba(255,255,255,0.6);letter-spacing:0.1em;">CONNECT • INNOVATE • GROW</div></div>
                    </div>
                    <p style="color:rgba(255,255,255,0.7);font-size:0.9rem;max-width:280px;">Smart Technology Solutions for a Digital Tomorrow. Web, Cloud, Data, and Software Development.</p>
                    <p style="color:rgba(255,255,255,0.7);font-size:0.85rem;margin-top:12px;">TECH360<br>Enterprise Technology<br>Connect • Innovate • Grow<br></p>
                    <p style="color:rgba(255,255,255,0.7);font-size:0.85rem;margin-top:8px;"><a href="mailto:support@tech360.io" style="color:rgba(255,255,255,0.7);">support@tech360.io</a></p>
                </div>
                <div><h4>Services</h4><a href="{{ route('services') }}">Web Development</a><a href="{{ route('services') }}">Cloud Services</a><a href="{{ route('services') }}">Business Automation</a><a href="{{ route('services') }}">CRM Systems</a><a href="{{ route('services') }}">Software Development</a></div>
                <div><h4>Company</h4><a href="{{ route("about") }}">Solutions</a><a href="{{ route('portfolio') }}">Portfolio</a><a href="{{ route('blog') }}">Blog</a><a href="{{ route('pricing') }}">Pricing</a><a href="{{ route('contact') }}">Contact</a></div>
                <div><h4>Legal</h4><a href="{{ route('terms') }}">Terms & Conditions</a><a href="{{ route('refund-policy') }}">Refund Policy</a><a href="{{ route('privacy-policy') }}">Privacy Policy</a><a href="{{ route('cookie-policy') }}">Cookie Policy</a></div>
                <div><h4>Resources</h4><a href="{{ route('blog') }}">Blog</a><a href="{{ route('case-studies') }}">Case Studies</a><a href="{{ route('contact') }}">Get Started</a></div>
            </div>
            <div class="footer-bottom">
                <p>© {{ date('Y') }} TECH360. All rights reserved. | tech360.io | CONNECT • INNOVATE • GROW</p>
            </div>
        </div>
    </footer>

    <!-- AI Agent Chatbot Widget -->
    <div id="tech360AiChat" style="position:fixed;bottom:24px;right:24px;z-index:9999;font-family:'Inter',-apple-system,system-ui,sans-serif;">
        <button id="aiChatToggle" onclick="toggleAiChat()" style="background:linear-gradient(135deg,#063B8F,#009FE3,#18B83A);color:white;border:none;width:64px;height:64px;border-radius:50%;cursor:pointer;box-shadow:0 8px 32px rgba(6,59,143,0.3);font-size:1.5rem;display:flex;align-items:center;justify-content:center;transition:transform 0.2s;">
            <i class="fas fa-robot"></i>
        </button>
        <div id="aiChatPanel" style="display:none;position:absolute;bottom:80px;right:0;width:380px;max-width:calc(100vw - 48px);background:white;border-radius:16px;box-shadow:0 20px 60px rgba(6,59,143,0.2);overflow:hidden;border:1px solid #E2E8F0;">
            <div style="background:linear-gradient(135deg,#063B8F,#009FE3);color:white;padding:16px;display:flex;align-items:center;gap:12px;">
                <div style="background:rgba(255,255,255,0.2);width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1.2rem;"><i class="fas fa-robot"></i></div>
                <div>
                    <div style="font-weight:700;font-size:0.95rem;">TECH360 Assistant</div>
                    <div style="font-size:0.75rem;opacity:0.85;"><span style="display:inline-block;width:8px;height:8px;background:#18B83A;border-radius:50%;margin-right:4px;animation:pulse 2s infinite;"></span> Online — Real AI Agent</div>
                </div>
                <button onclick="toggleAiChat()" style="background:none;border:none;color:white;cursor:pointer;font-size:1.2rem;margin-left:auto;">×</button>
            </div>
            <div id="aiChatMessages" style="padding:16px;height:320px;overflow-y:auto;background:#F4FAFF;display:flex;flex-direction:column;gap:10px;">
                <div style="background:white;padding:12px 16px;border-radius:12px 12px 12px 4px;max-width:85%;font-size:0.88rem;box-shadow:0 2px 8px rgba(0,0,0,0.05);border:1px solid #E2E8F0;">
                    👋 Hi! I'm the TECH360 AI Assistant. I can answer questions about our services, pricing, the project workflow, refund policy, and help you get started. What would you like to know?
                </div>
            </div>
            <div style="padding:12px;border-top:1px solid #E2E8F0;background:white;">
                <form id="aiChatForm" onsubmit="sendAiMessage(event)" style="display:flex;gap:8px;">
                    <input type="text" id="aiChatInput" placeholder="Type your question..." style="flex:1;padding:10px 14px;border:1px solid #E2E8F0;border-radius:8px;font-size:0.9rem;font-family:inherit;outline:none;" autocomplete="off">
                    <button type="submit" style="background:#009FE3;color:white;border:none;padding:10px 16px;border-radius:8px;cursor:pointer;font-weight:600;"><i class="fas fa-paper-plane"></i></button>
                </form>
                <p style="font-size:0.7rem;color:#526173;text-align:center;margin-top:6px;">Powered by TECH360 AI Agent Platform — Real responses, not demo</p>
            </div>
        </div>
    </div>
    <style>
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.5; } }
        .ai-typing { display:flex;gap:4px;padding:8px;background:white;border-radius:8px;width:fit-content;border:1px solid #E2E8F0; }
        .ai-typing span { width:8px;height:8px;background:#009FE3;border-radius:50%;animation:bounce 1.4s infinite; }
        .ai-typing span:nth-child(2) { animation-delay:0.2s; }
        .ai-typing span:nth-child(3) { animation-delay:0.4s; }
        @keyframes bounce { 0%,60%,100% { transform:translateY(0); } 30% { transform:translateY(-8px); } }
    </style>
    <script>
    function toggleAiChat() {
        const panel = document.getElementById('aiChatPanel');
        const toggle = document.getElementById('aiChatToggle');
        panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        toggle.innerHTML = panel.style.display === 'block' ? '<i class="fas fa-times"></i>' : '<i class="fas fa-robot"></i>';
        if (panel.style.display === 'block') {
            document.getElementById('aiChatInput').focus();
        }
    }
    function appendMessage(text, isUser) {
        const container = document.getElementById('aiChatMessages');
        const div = document.createElement('div');
        div.style.cssText = isUser
            ? 'background:linear-gradient(135deg,#009FE3,#00A8A8);color:white;padding:12px 16px;border-radius:12px 12px 4px 12px;max-width:85%;align-self:flex-end;font-size:0.88rem;box-shadow:0 2px 8px rgba(0,0,0,0.05);'
            : 'background:white;padding:12px 16px;border-radius:12px 12px 12px 4px;max-width:85%;font-size:0.88rem;box-shadow:0 2px 8px rgba(0,0,0,0.05);border:1px solid #E2E8F0;';
        div.textContent = text;
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
    }
    function appendTyping() {
        const container = document.getElementById('aiChatMessages');
        const div = document.createElement('div');
        div.id = 'aiTypingIndicator';
        div.className = 'ai-typing';
        div.innerHTML = '<span></span><span></span><span></span>';
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
    }
    function removeTyping() {
        const el = document.getElementById('aiTypingIndicator');
        if (el) el.remove();
    }
    async function sendAiMessage(event) {
        event.preventDefault();
        const input = document.getElementById('aiChatInput');
        const msg = input.value.trim();
        if (!msg) return;
        appendMessage(msg, true);
        input.value = '';
        appendTyping();
        try {
            const res = await fetch('{{ route("public.ai.chat") }}', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': '{{ csrf_token() }}',
                },
                body: JSON.stringify({ message: msg })
            });
            const data = await res.json();
            removeTyping();
            if (data.success) {
                appendMessage(data.response, false);
            } else {
                appendMessage('I apologize — I had trouble processing that. Please try again or contact support@tech360.io.', false);
            }
        } catch (e) {
            removeTyping();
            appendMessage('Connection error. Please check your internet and try again.', false);
        }
    }
    </script>
    @yield('scripts')
</body>
</html>
