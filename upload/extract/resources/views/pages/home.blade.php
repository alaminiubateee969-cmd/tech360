@extends('layouts.app')
@section('title', 'TECH360 — Systems That Run Your Business at 10x Speed')
@section('description', 'We build, manage, and scale high-performance enterprise systems with guaranteed execution quality and zero downtime.')

@section('head')
<style>
/* === ANIMATED HERO WORKFLOW === */
.hero-workflow { position: relative; width: 100%; max-width: 520px; }
.wf-panel { background: rgba(255,255,255,0.95); backdrop-filter: blur(16px); border-radius: 16px; padding: 24px; box-shadow: 0 20px 60px rgba(6,59,143,0.15); border: 1px solid rgba(255,255,255,0.6); }
.wf-header { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; }
.wf-dot { width: 8px; height: 8px; border-radius: 50%; }
.wf-dot.green { background: var(--green); box-shadow: 0 0 8px var(--green); animation: pulse-dot 2s infinite; }
.wf-dot.blue { background: var(--blue); }
.wf-dot.amber { background: #F59E0B; }
@keyframes pulse-dot { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(1.3); } }
.wf-steps { display: flex; flex-direction: column; gap: 8px; }
.wf-step { display: flex; align-items: center; gap: 12px; padding: 10px 14px; border-radius: 8px; background: var(--light-blue); transition: all 0.4s; opacity: 0.4; transform: translateX(-10px); }
.wf-step.active { opacity: 1; transform: translateX(0); background: linear-gradient(90deg, rgba(0,159,227,0.1), rgba(24,184,58,0.05)); border-left: 3px solid var(--blue); }
.wf-step.done { opacity: 0.6; }
.wf-step.done .wf-step-icon { background: var(--green); color: white; }
.wf-step.active .wf-step-icon { background: var(--blue); color: white; animation: pulse-dot 1.5s infinite; }
.wf-step-icon { width: 28px; height: 28px; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 0.7rem; background: var(--border); color: var(--secondary-text); transition: all 0.3s; flex-shrink: 0; }
.wf-step-label { font-size: 0.8rem; font-weight: 600; color: var(--primary-text); }
.wf-step-status { font-size: 0.65rem; color: var(--secondary-text); margin-left: auto; }
.wf-progress-bar { height: 6px; background: var(--border); border-radius: 3px; margin-top: 16px; overflow: hidden; }
.wf-progress-fill { height: 100%; background: linear-gradient(90deg, var(--navy), var(--blue), var(--cyan), var(--green)); border-radius: 3px; width: 0%; transition: width 1.5s ease; }
.wf-float-badge { position: absolute; top: -16px; right: -16px; background: linear-gradient(135deg, var(--navy), var(--green)); color: white; padding: 8px 16px; border-radius: 8px; font-size: 0.75rem; font-weight: 700; box-shadow: 0 8px 24px rgba(6,59,143,0.3); animation: float-badge 3s ease-in-out infinite; }
@keyframes float-badge { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }

/* === PRODUCT PREVIEW DASHBOARD === */
.dash-mockup { background: white; border-radius: 16px; box-shadow: 0 20px 60px rgba(6,59,143,0.12); overflow: hidden; border: 1px solid var(--border); }
.dash-header { display: flex; align-items: center; gap: 8px; padding: 12px 16px; border-bottom: 1px solid var(--border); background: var(--light-blue); }
.dash-sidebar { width: 60px; background: var(--navy); padding: 16px 0; display: flex; flex-direction: column; align-items: center; gap: 16px; }
.dash-sidebar-icon { width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; color: rgba(255,255,255,0.5); transition: all 0.3s; }
.dash-sidebar-icon.active { background: rgba(255,255,255,0.15); color: white; }
.dash-body { flex: 1; padding: 20px; }
.dash-stat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
.dash-stat-card { background: var(--light-blue); border-radius: 8px; padding: 12px; }
.dash-stat-card .val { font-size: 1.4rem; font-weight: 800; }
.dash-stat-card .lbl { font-size: 0.65rem; color: var(--secondary-text); }
.dash-progress-track { height: 8px; background: var(--border); border-radius: 4px; overflow: hidden; margin: 8px 0; }
.dash-progress-bar { height: 100%; background: linear-gradient(90deg, var(--blue), var(--green)); border-radius: 4px; transition: width 2s ease; }
.dash-chart { display: flex; align-items: end; gap: 4px; height: 80px; }
.dash-bar { flex: 1; border-radius: 4px 4px 0 0; transition: height 1s ease; }
.dash-checklist { display: flex; flex-direction: column; gap: 6px; }
.dash-check-item { display: flex; align-items: center; gap: 8px; font-size: 0.75rem; }
.dash-check-circle { width: 16px; height: 16px; border-radius: 50%; border: 2px solid var(--border); display: flex; align-items: center; justify-content: center; font-size: 0.5rem; transition: all 0.5s; }
.dash-check-circle.checked { background: var(--green); border-color: var(--green); color: white; }

/* === SERVICE DEMO FLOW === */
.svc-flow { display: flex; flex-direction: column; gap: 6px; margin-top: 16px; }
.svc-flow-node { display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-radius: 8px; background: var(--light-blue); font-size: 0.75rem; font-weight: 600; transition: all 0.4s; opacity: 0.5; }
.svc-flow-node.active { opacity: 1; background: linear-gradient(90deg, rgba(0,159,227,0.12), rgba(0,168,168,0.08)); border-left: 3px solid var(--blue); transform: scale(1.02); }
.svc-flow-node.done { opacity: 0.7; }
.svc-flow-node.done .svc-flow-dot { background: var(--green); }
.svc-flow-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--border); flex-shrink: 0; transition: all 0.3s; }
.svc-flow-node.active .svc-flow-dot { background: var(--blue); animation: pulse-dot 1.5s infinite; }
.svc-flow-arrow { text-align: center; font-size: 0.6rem; color: var(--secondary-text); }

/* === ARCHITECTURE DIAGRAM === */
.arch-diagram { display: flex; flex-direction: column; align-items: center; gap: 0; }
.arch-node { padding: 10px 24px; border-radius: 8px; font-size: 0.8rem; font-weight: 600; text-align: center; transition: all 0.4s; opacity: 0.5; min-width: 200px; }
.arch-node.active { opacity: 1; transform: scale(1.05); box-shadow: 0 4px 16px rgba(0,159,227,0.2); }
.arch-node.navy { background: var(--navy); color: white; }
.arch-node.blue { background: var(--blue); color: white; }
.arch-node.cyan { background: var(--cyan); color: white; }
.arch-node.green { background: var(--green); color: white; }
.arch-node.light { background: var(--light-blue); color: var(--navy); border: 1px solid var(--border); }
.arch-connector { width: 2px; height: 24px; background: linear-gradient(to bottom, var(--blue), var(--cyan)); margin: 0 auto; position: relative; }
.arch-connector::after { content: ''; position: absolute; top: 50%; left: -3px; width: 8px; height: 8px; border-radius: 50%; background: var(--blue); animation: arch-flow 2s infinite linear; }
@keyframes arch-flow { 0% { top: 0; opacity: 1; } 100% { top: 100%; opacity: 0; } }

/* === GUARANTEE BADGES === */
.guarantee-badge { position: relative; overflow: hidden; }
.guarantee-badge::before { content: ''; position: absolute; top: -50%; left: -50%; width: 200%; height: 200%; background: linear-gradient(45deg, transparent, rgba(255,255,255,0.1), transparent); animation: badge-shine 3s infinite; }
@keyframes badge-shine { 0% { transform: translateX(-100%) translateY(-100%); } 100% { transform: translateX(50%) translateY(50%); } }
@media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
</style>
@endsection

@section('content')
<!-- ===== HERO WITH LIVE WORKFLOW ===== -->
<section class="hero">
    <div class="container hero-grid">
        <div>
            <h1>Systems That Run Your Business at <span class="text-gradient">10x Speed</span></h1>
            <p>We build, manage, and scale high-performance enterprise systems with guaranteed execution quality and zero downtime.</p>
            <div class="hero-cta">
                <a href="{{ route('contact') }}" class="btn btn-gradient"><i class="fas fa-rocket"></i> Request Product Preview</a>
                <a href="#product-preview" class="btn btn-outline"><i class="fas fa-eye"></i> See TECH360 in Action</a>
            </div>
        </div>
        <div class="hero-visual"><img src="{{ asset("images/hero-platform.png") }}" alt="TECH360 Platform" style="max-width:100%;border-radius:16px;box-shadow:0 20px 60px rgba(6,59,143,0.15);" onerror="this.style.display=none">
            <div class="hero-workflow" id="heroWorkflow">
                <div class="wf-float-badge">10x Faster Delivery</div>
                <div class="wf-panel">
                    <div class="wf-header">
                        <div class="wf-dot green"></div>
                        <div class="wf-dot blue"></div>
                        <div class="wf-dot amber"></div>
                        <span style="font-size:0.75rem;font-weight:600;color:var(--navy);margin-left:8px;">TECH360 Platform</span>
                        <span style="font-size:0.65rem;color:var(--green);margin-left:auto;">● LIVE</span>
                    </div>
                    <div class="wf-steps" id="wfSteps">
                        <div class="wf-step" data-step="0"><div class="wf-step-icon"><i class="fas fa-inbox"></i></div><div><div class="wf-step-label">Request Received</div></div><div class="wf-step-status">PENDING</div></div>
                        <div class="wf-step" data-step="1"><div class="wf-step-icon"><i class="fas fa-clipboard-check"></i></div><div><div class="wf-step-label">Scope Verified</div></div><div class="wf-step-status">WAITING</div></div>
                        <div class="wf-step" data-step="2"><div class="wf-step-icon"><i class="fas fa-cog"></i></div><div><div class="wf-step-label">System Initialized</div></div><div class="wf-step-status">WAITING</div></div>
                        <div class="wf-step" data-step="3"><div class="wf-step-icon"><i class="fas fa-bolt"></i></div><div><div class="wf-step-label">Execution Running</div></div><div class="wf-step-status">WAITING</div></div>
                        <div class="wf-step" data-step="4"><div class="wf-step-icon"><i class="fas fa-search"></i></div><div><div class="wf-step-label">Quality Check</div></div><div class="wf-step-status">WAITING</div></div>
                        <div class="wf-step" data-step="5"><div class="wf-step-icon"><i class="fas fa-user-shield"></i></div><div><div class="wf-step-label">Admin Review</div></div><div class="wf-step-status">WAITING</div></div>
                        <div class="wf-step" data-step="6"><div class="wf-step-icon"><i class="fas fa-check-circle"></i></div><div><div class="wf-step-label">Ready for Delivery</div></div><div class="wf-step-status">WAITING</div></div>
                    </div>
                    <div class="wf-progress-bar"><div class="wf-progress-fill" id="wfProgress"></div></div>
                </div>
            </div>
        </div>
    </div>
</section>

<!-- ===== PRODUCT PREVIEW ===== -->
<section class="section section-light" id="product-preview">
    <div class="container">
        <div class="section-header">
            <h2>See TECH360 <span class="text-gradient">in Action</span></h2>
            <p>Product Preview — Real dashboard interface</p>
        </div>
        <div style="max-width:900px;margin:0 auto;">
            <img src="{{ asset("images/crm-dashboard.png") }}" alt="TECH360 CRM Dashboard" style="width:100%;border-radius:12px;margin-bottom:16px;box-shadow:0 12px 40px rgba(6,59,143,0.1);" onerror="this.style.display=none"><div class="dash-mockup">
                <div class="dash-header">
                    <div style="display:flex;gap:6px;"><div style="width:10px;height:10px;border-radius:50%;background:#FF5F57;"></div><div style="width:10px;height:10px;border-radius:50%;background:#FFBD2E;"></div><div style="width:10px;height:10px;border-radius:50%;background:#28CA42;"></div></div>
                    <span style="font-size:0.75rem;color:var(--secondary-text);margin-left:8px;">tech360.io/client/dashboard</span>
                </div>
                <div style="display:flex;">
                    <div class="dash-sidebar">
                        <div class="dash-sidebar-icon active"><i class="fas fa-tachometer-alt"></i></div>
                        <div class="dash-sidebar-icon"><i class="fas fa-folder"></i></div>
                        <div class="dash-sidebar-icon"><i class="fas fa-tasks"></i></div>
                        <div class="dash-sidebar-icon"><i class="fas fa-comments"></i></div>
                        <div class="dash-sidebar-icon"><i class="fas fa-file"></i></div>
                        <div class="dash-sidebar-icon"><i class="fas fa-credit-card"></i></div>
                    </div>
                    <div class="dash-body">
                        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
                            <div><h3 style="font-size:1.1rem;">Website & CRM Platform</h3><p style="font-size:0.7rem;color:var(--secondary-text);">Project ID: T360-1048</p></div>
                            <span class="badge badge-blue" id="dashStatus">IN PROGRESS</span>
                        </div>
                        <div class="dash-stat-grid">
                            <div class="dash-stat-card"><div class="val" style="color:var(--blue);" id="dashProgress">42%</div><div class="lbl">Progress</div></div>
                            <div class="dash-stat-card"><div class="val" style="color:var(--cyan);" id="dashTasks">18/24</div><div class="lbl">Tasks Done</div></div>
                            <div class="dash-stat-card"><div class="val" style="color:var(--green);">PASS</div><div class="lbl">Quality</div></div>
                            <div class="dash-stat-card"><div class="val" style="color:var(--navy);">$2,500</div><div class="lbl">Budget</div></div>
                        </div>
                        <div style="margin-bottom:16px;">
                            <div style="display:flex;justify-content:space-between;font-size:0.7rem;margin-bottom:4px;"><span style="font-weight:600;">Project Completion</span><span id="dashProgressText">42%</span></div>
                            <div class="dash-progress-track"><div class="dash-progress-bar" id="dashProgressBar" style="width:42%;"></div></div>
                        </div>
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
                            <div>
                                <h4 style="font-size:0.8rem;margin-bottom:8px;">Quality Checklist</h4>
                                <div class="dash-checklist">
                                    <div class="dash-check-item"><div class="dash-check-circle checked">✓</div> Code Quality</div>
                                    <div class="dash-check-item"><div class="dash-check-circle checked">✓</div> UI Responsiveness</div>
                                    <div class="dash-check-item"><div class="dash-check-circle checked">✓</div> Database</div>
                                    <div class="dash-check-item"><div class="dash-check-circle" id="qcSecurity">○</div> Security</div>
                                    <div class="dash-check-item"><div class="dash-check-circle" id="qcPerformance">○</div> Performance</div>
                                    <div class="dash-check-item"><div class="dash-check-circle" id="qcDeployment">○</div> Deployment</div>
                                </div>
                            </div>
                            <div>
                                <h4 style="font-size:0.8rem;margin-bottom:8px;">Activity Timeline</h4>
                                <div style="font-size:0.7rem;color:var(--secondary-text);">
                                    <div style="margin-bottom:6px;"><span class="badge badge-green" style="font-size:0.6rem;">DONE</span> Requirements gathered</div>
                                    <div style="margin-bottom:6px;"><span class="badge badge-green" style="font-size:0.6rem;">DONE</span> Design approved</div>
                                    <div style="margin-bottom:6px;"><span class="badge badge-blue" style="font-size:0.6rem;">ACTIVE</span> Development in progress</div>
                                    <div style="margin-bottom:6px;"><span class="badge badge-navy" style="font-size:0.6rem;">PENDING</span> QA testing</div>
                                    <div><span class="badge badge-navy" style="font-size:0.6rem;">PENDING</span> Delivery</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <p style="text-align:center;font-size:0.75rem;color:var(--secondary-text);margin-top:12px;">Product Preview — Demonstration of actual TECH360 client dashboard</p>
        </div>
    </div>
</section>

<!-- ===== SERVICES WITH DEMONSTRATIONS ===== -->
<section class="section">
    <div class="container">
        <div class="section-header">
            <h2>High-Speed Managed <span class="text-gradient">Services</span></h2>
            <p>Every service demonstrates how the technology works</p>
        </div>
        <div class="grid grid-2" style="gap:32px;">
            <!-- CRM Demo -->
            <div class="card">
                <div class="card-icon blue"><i class="fas fa-users-cog"></i></div>
                <img src="{{ asset("images/crm-dashboard.png") }}" alt="CRM Dashboard" class="card-img"><h3>CRM <h3>CRM & Lead Management</h3> Lead Management</h3>
                <p style="margin-bottom:16px;">Complete pipeline from lead to customer — automated and tracked.</p>
                <div class="svc-flow" id="crmFlow">
                    <div class="svc-flow-node"><div class="svc-flow-dot"></div>Lead Created <span style="margin-left:auto;font-size:0.6rem;color:var(--secondary-text);">Website</span></div>
                    <div class="svc-flow-arrow">↓</div>
                    <div class="svc-flow-node"><div class="svc-flow-dot"></div>Contact Created</div>
                    <div class="svc-flow-arrow">↓</div>
                    <div class="svc-flow-node"><div class="svc-flow-dot"></div>Lead Assigned</div>
                    <div class="svc-flow-arrow">↓</div>
                    <div class="svc-flow-node"><div class="svc-flow-dot"></div>Follow-up Scheduled</div>
                    <div class="svc-flow-arrow">↓</div>
                    <div class="svc-flow-node"><div class="svc-flow-dot"></div>Proposal Sent</div>
                    <div class="svc-flow-arrow">↓</div>
                    <div class="svc-flow-node"><div class="svc-flow-dot"></div>Deal Won → Customer</div>
                </div>
            </div>
            <!-- Cloud Demo -->
            <div class="card">
                <div class="card-icon navy"><i class="fas fa-cloud"></i></div>
                <img src="{{ asset("images/cloud-architecture.png") }}" alt="Cloud Architecture" class="card-img"><h3>Cloud Infrastructure</h3>
                <p style="margin-bottom:16px;">Scalable cloud deployment with monitoring and security.</p>
                <div class="arch-diagram" id="cloudArch">
                    <div class="arch-node light">USER</div>
                    <div class="arch-connector"></div>
                    <div class="arch-node blue">CLOUDFLARE (CDN + WAF)</div>
                    <div class="arch-connector"></div>
                    <div class="arch-node navy">APPLICATION (Laravel)</div>
                    <div class="arch-connector"></div>
                    <div class="arch-node cyan">CACHE LAYER</div>
                    <div class="arch-connector"></div>
                    <div class="arch-node green">DATABASE (MySQL)</div>
                </div>
            </div>
            <!-- Automation Demo -->
            <div class="card">
                <div class="card-icon cyan"><i class="fas fa-cogs"></i></div>
                <img src="{{ asset("images/automation-workflow.png") }}" alt="Automation Workflow" class="card-img"><h3>Business Automation</h3>
                <p style="margin-bottom:16px;">Automated workflows that execute without manual intervention.</p>
                <div class="svc-flow" id="autoFlow">
                    <div class="svc-flow-node"><div class="svc-flow-dot"></div>TRIGGER: New Lead</div>
                    <div class="svc-flow-arrow">↓</div>
                    <div class="svc-flow-node"><div class="svc-flow-dot"></div>RULE: Assign + Score</div>
                    <div class="svc-flow-arrow">↓</div>
                    <div class="svc-flow-node"><div class="svc-flow-dot"></div>TASK: Send Welcome</div>
                    <div class="svc-flow-arrow">↓</div>
                    <div class="svc-flow-node"><div class="svc-flow-dot"></div>NOTIFICATION: Alert Staff</div>
                    <div class="svc-flow-arrow">↓</div>
                    <div class="svc-flow-node"><div class="svc-flow-dot"></div>COMPLETION: Lead Logged</div>
                </div>
            </div>
            <!-- Software Dev Demo -->
            <div class="card">
                <div class="card-icon green"><i class="fas fa-code"></i></div>
                <img src="{{ asset("images/dev-lifecycle.png") }}" alt="Development Lifecycle" class="card-img"><h3>Software Development</h3>
                <p style="margin-bottom:16px;">Full-cycle development with quality gates at every stage.</p>
                <div class="svc-flow" id="devFlow">
                    <div class="svc-flow-node"><div class="svc-flow-dot"></div>Requirement Analysis</div>
                    <div class="svc-flow-arrow">↓</div>
                    <div class="svc-flow-node"><div class="svc-flow-dot"></div>Architecture Design</div>
                    <div class="svc-flow-arrow">↓</div>
                    <div class="svc-flow-node"><div class="svc-flow-dot"></div>Development</div>
                    <div class="svc-flow-arrow">↓</div>
                    <div class="svc-flow-node"><div class="svc-flow-dot"></div>Testing (QA)</div>
                    <div class="svc-flow-arrow">↓</div>
                    <div class="svc-flow-node"><div class="svc-flow-dot"></div>Deployment</div>
                </div>
            </div>
        </div>
    </div>
</section>

<!-- ===== HOW IT WORKS ===== -->
<section class="section section-light">
    <div class="container">
        <div class="section-header">
            <h2>How <span class="text-gradient">It Works</span></h2>
            <p>From request to launch — a proven 4-stage process</p>
        </div>
        <div class="grid grid-4">
            <div class="card" style="text-align:center;">
                <div style="font-size:2.5rem;font-weight:800;background:linear-gradient(90deg,var(--navy),var(--blue));-webkit-background-clip:text;background-clip:text;color:transparent;">01</div>
                <div class="card-icon blue" style="margin:12px auto;"><i class="fas fa-search"></i></div>
                <h3>Discover & Scope</h3>
                <p>Submit project details or select a ready system.</p>
                <div style="margin-top:12px;font-size:0.7rem;color:var(--blue);">●●○○</div>
            </div>
            <div class="card" style="text-align:center;">
                <div style="font-size:2.5rem;font-weight:800;background:linear-gradient(90deg,var(--blue),var(--cyan));-webkit-background-clip:text;background-clip:text;color:transparent;">02</div>
                <div class="card-icon navy" style="margin:12px auto;"><i class="fas fa-cog"></i></div>
                <h3>System Setup</h3>
                <p>Our team audits and initializes your environment.</p>
                <div style="margin-top:12px;font-size:0.7rem;color:var(--cyan);">●●●○</div>
            </div>
            <div class="card" style="text-align:center;">
                <div style="font-size:2.5rem;font-weight:800;background:linear-gradient(90deg,var(--cyan),var(--green));-webkit-background-clip:text;background-clip:text;color:transparent;">03</div>
                <div class="card-icon cyan" style="margin:12px auto;"><i class="fas fa-bolt"></i></div>
                <h3>Automated Execution</h3>
                <p>High-speed workflow engines build your modules.</p>
                <div style="margin-top:12px;font-size:0.7rem;color:var(--green);">●●●●</div>
            </div>
            <div class="card" style="text-align:center;">
                <div style="font-size:2.5rem;font-weight:800;background:linear-gradient(90deg,var(--green),var(--bright-green));-webkit-background-clip:text;background-clip:text;color:transparent;">04</div>
                <div class="card-icon green" style="margin:12px auto;"><i class="fas fa-rocket"></i></div>
                <h3>Review & Launch</h3>
                <p>Rigorous quality control before final handover.</p>
                <div style="margin-top:12px;font-size:0.7rem;color:var(--green);">✓ COMPLETE</div>
            </div>
        </div>
    </div>
</section>

<!-- ===== ARCHITECTURE DIAGRAM ===== -->
<section class="section">
    <div class="container">
        <div class="section-header">
            <h2>TECH360 <span class="text-gradient">Architecture</span></h2>
            <p>How the complete system works — from customer to delivery</p>
        </div>
        <div style="max-width:400px;margin:0 auto;" id="archDiagram">
            <div class="arch-diagram">
                <div class="arch-node light">CUSTOMER REQUEST</div>
                <div class="arch-connector"></div>
                <div class="arch-node blue">TECH360 WEBSITE</div>
                <div class="arch-connector"></div>
                <div class="arch-node navy">CRM SYSTEM</div>
                <div class="arch-connector"></div>
                <div class="arch-node navy">SUPER ADMIN</div>
                <div class="arch-connector"></div>
                <div class="arch-node cyan">WORKFLOW ENGINE</div>
                <div class="arch-connector"></div>
                <div class="arch-node cyan">TASK EXECUTION</div>
                <div class="arch-connector"></div>
                <div class="arch-node green">QUALITY AUDIT</div>
                <div class="arch-connector"></div>
                <div class="arch-node green">ADMIN REVIEW</div>
                <div class="arch-connector"></div>
                <div class="arch-node light">CLIENT DELIVERY</div>
            </div>
        </div>
    </div>
</section>

<!-- ===== GUARANTEE ===== -->
<section class="section">
    <div class="container">
        <div style="background:linear-gradient(135deg,var(--navy) 0%,var(--blue) 50%,var(--green) 100%);border-radius:24px;padding:64px 48px;color:white;text-align:center;">
            <div style="display:inline-flex;align-items:center;justify-content:center;width:80px;height:80px;border-radius:50%;background:rgba(255,255,255,0.15);margin-bottom:24px;">
                <img src="{{ asset("images/quality-checklist.png") }}" alt="Quality Checklist" style="width:80px;height:80px;border-radius:50%;object-fit:cover;">
            </div>
            <h2 style="color:white;font-size:2.5rem;">100% Risk-Free Guarantee</h2>
            <p style="color:rgba(255,255,255,0.85);font-size:1.1rem;max-width:700px;margin:16px auto 40px;">Every system undergoes multi-layer quality assurance before delivery. If the final delivery does not match the approved scope, we offer unlimited revisions or a refund under our transparent SLA.</p>
            <div class="grid grid-3" style="max-width:900px;margin:0 auto;">
                <div class="guarantee-badge" style="background:rgba(255,255,255,0.1);border-radius:12px;padding:24px;backdrop-filter:blur(10px);">
                    <div style="font-size:1.5rem;color:var(--bright-green);margin-bottom:8px;"><i class="fas fa-handshake"></i></div>
                    <h4 style="color:white;">Milestone Control</h4>
                    <p style="color:rgba(255,255,255,0.7);font-size:0.85rem;">Project milestones tracked and verified.</p>
                </div>
                <div class="guarantee-badge" style="background:rgba(255,255,255,0.1);border-radius:12px;padding:24px;backdrop-filter:blur(10px);">
                    <div style="font-size:1.5rem;color:var(--bright-green);margin-bottom:8px;"><i class="fas fa-check-circle"></i></div>
                    <h4 style="color:white;">Quality Verification</h4>
                    <p style="color:rgba(255,255,255,0.7);font-size:0.85rem;">Delivery reviewed before launch.</p>
                </div>
                <div class="guarantee-badge" style="background:rgba(255,255,255,0.1);border-radius:12px;padding:24px;backdrop-filter:blur(10px);">
                    <div style="font-size:1.5rem;color:var(--bright-green);margin-bottom:8px;"><i class="fas fa-undo"></i></div>
                    <h4 style="color:white;">Transparent Refund</h4>
                    <p style="color:rgba(255,255,255,0.7);font-size:0.85rem;">Handled per approved agreement and policy.</p>
                </div>
            </div>
        </div>
    </div>
</section>

<!-- ===== CTA ===== -->
<section class="section gradient-tech" style="text-align:center;color:white;">
    <div class="container">
        <img src="{{ asset("images/delivery-handover.png") }}" alt="Project Delivery" style="max-width:400px;width:100%;border-radius:16px;margin-bottom:24px;"><h2 style="color:white;font-size:2.5rem;">Ready to Scale at 10x Speed?</h2>
        <p style="color:rgba(255,255,255,0.8);font-size:1.2rem;margin:16px 0 32px;">Your Vision. Our Technology. Limitless Possibilities.</p>
        <a href="{{ route('contact') }}" class="btn btn-outline" style="background:white;color:var(--navy);border:none;font-size:1.1rem;padding:16px 40px;"><i class="fas fa-paper-plane"></i> Request Product Preview</a>
    </div>
</section>
@endsection

@section('scripts')
<script>
// === HERO WORKFLOW ANIMATION ===
(function() {
    const steps = document.querySelectorAll('#wfSteps .wf-step');
    const progressFill = document.getElementById('wfProgress');
    const statuses = ['PENDING', 'VERIFIED', 'INITIALIZED', 'RUNNING...', 'CHECKING...', 'REVIEWING...', 'READY'];
    let current = 0;
    function advanceWorkflow() {
        steps.forEach((step, i) => {
            step.classList.remove('active', 'done');
            if (i < current) { step.classList.add('done'); step.querySelector('.wf-step-status').textContent = 'DONE'; }
            else if (i === current) { step.classList.add('active'); step.querySelector('.wf-step-status').textContent = statuses[i]; step.querySelector('.wf-step-status').style.color = 'var(--blue)'; }
            else { step.querySelector('.wf-step-status').textContent = 'WAITING'; step.querySelector('.wf-step-status').style.color = 'var(--secondary-text)'; }
        });
        const progress = Math.round((current / (steps.length - 1)) * 100);
        progressFill.style.width = progress + '%';
        current = (current + 1) % (steps.length + 1);
        if (current > steps.length - 1) { current = 0; setTimeout(advanceWorkflow, 2000); return; }
        setTimeout(advanceWorkflow, 1500);
    }
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setTimeout(advanceWorkflow, 1000); }
})();

// === PRODUCT PREVIEW DASHBOARD ANIMATION ===
(function() {
    const progressBar = document.getElementById('dashProgressBar');
    const progressText = document.getElementById('dashProgressText');
    const progressPct = document.getElementById('dashProgress');
    const tasksCount = document.getElementById('dashTasks');
    const statusBadge = document.getElementById('dashStatus');
    const qcSecurity = document.getElementById('qcSecurity');
    const qcPerformance = document.getElementById('qcPerformance');
    const qcDeployment = document.getElementById('qcDeployment');
    const stages = [
        { progress: 42, tasks: '18/24', status: 'IN PROGRESS', statusClass: 'badge-blue', qc: [0,0,0] },
        { progress: 68, tasks: '20/24', status: 'IN PROGRESS', statusClass: 'badge-blue', qc: [1,0,0] },
        { progress: 84, tasks: '23/24', status: 'NEAR COMPLETE', statusClass: 'badge-blue', qc: [1,1,0] },
        { progress: 100, tasks: '24/24', status: 'QA PASSED', statusClass: 'badge-green', qc: [1,1,1] },
    ];
    let stageIdx = 0;
    function updateDashboard() {
        const s = stages[stageIdx];
        progressBar.style.width = s.progress + '%';
        progressText.textContent = s.progress + '%';
        progressPct.textContent = s.progress + '%';
        tasksCount.textContent = s.tasks;
        statusBadge.textContent = s.status;
        statusBadge.className = 'badge ' + s.statusClass;
        qcSecurity.className = 'dash-check-circle' + (s.qc[0] ? ' checked' : '');
        qcSecurity.innerHTML = s.qc[0] ? '✓' : '○';
        qcPerformance.className = 'dash-check-circle' + (s.qc[1] ? ' checked' : '');
        qcPerformance.innerHTML = s.qc[1] ? '✓' : '○';
        qcDeployment.className = 'dash-check-circle' + (s.qc[2] ? ' checked' : '');
        qcDeployment.innerHTML = s.qc[2] ? '✓' : '○';
        stageIdx = (stageIdx + 1) % stages.length;
    }
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setInterval(updateDashboard, 3000); }
})();

// === SERVICE FLOW ANIMATIONS ===
function animateFlow(containerId) {
    const nodes = document.querySelectorAll('#' + containerId + ' .svc-flow-node');
    let idx = 0;
    function next() {
        nodes.forEach(n => n.classList.remove('active', 'done'));
        for (let i = 0; i < idx; i++) nodes[i]?.classList.add('done');
        nodes[idx]?.classList.add('active');
        idx = (idx + 1) % (nodes.length + 1);
        if (idx > nodes.length) idx = 0;
    }
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setInterval(next, 1200); next(); }
}
animateFlow('crmFlow');
animateFlow('autoFlow');
animateFlow('devFlow');

// === ARCHITECTURE DIAGRAM ANIMATION ===
(function() {
    const nodes = document.querySelectorAll('#archDiagram .arch-node');
    let idx = 0;
    function next() {
        nodes.forEach(n => n.classList.remove('active'));
        nodes[idx]?.classList.add('active');
        idx = (idx + 1) % nodes.length;
    }
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setInterval(next, 800); next(); }
})();

// === CLOUD ARCHITECTURE ANIMATION ===
(function() {
    const nodes = document.querySelectorAll('#cloudArch .arch-node');
    let idx = 0;
    function next() {
        nodes.forEach(n => n.classList.remove('active'));
        nodes[idx]?.classList.add('active');
        idx = (idx + 1) % nodes.length;
    }
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setInterval(next, 1000); next(); }
})();
</script>
@endsection
