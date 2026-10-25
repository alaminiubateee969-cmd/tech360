#!/usr/bin/env python3
"""
TECH360 LLC — Operational Book Generator
Generates a comprehensive Operational Book PDF covering all workflows, SOPs, runbooks.
"""
import os, sys
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch, cm, mm
from reportlab.lib.colors import HexColor, white, black
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak, Image, Table, TableStyle,
    KeepTogether, ListFlowable, ListItem, PageTemplate, Frame, NextPageTemplate
)
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

# Register fonts
try:
    pdfmetrics.registerFont(TTFont('NotoSans', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'))
    pdfmetrics.registerFont(TTFont('NotoSans-Bold', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'))
    FONT = 'NotoSans'
    FONT_BOLD = 'NotoSans-Bold'
except:
    FONT = 'Helvetica'
    FONT_BOLD = 'Helvetica-Bold'

# TECH360 brand palette
NAVY = HexColor('#063B8F')
BLUE = HexColor('#009FE3')
CYAN = HexColor('#00A8A8')
GREEN = HexColor('#18B83A')
BRIGHT_GREEN = HexColor('#20C94F')
LIGHT_BLUE = HexColor('#F4FAFF')
LIGHT_GREEN = HexColor('#F3FFF7')
PRIMARY_TEXT = HexColor('#152238')
SECONDARY_TEXT = HexColor('#526173')
BORDER = HexColor('#E2E8F0')
ACCENT_RED = HexColor('#DC2626')
ACCENT_AMBER = HexColor('#F59E0B')
GRAY_BG = HexColor('#F8FAFC')

OUTPUT_PATH = '/home/z/my-project/download/TECH360-Operational-Book.pdf'
IMAGE_DIR = '/home/z/my-project/tech360-laravel/public/images'

# Page setup
PAGE_W, PAGE_H = letter
MARGIN = 0.75 * inch
CONTENT_W = PAGE_W - 2 * MARGIN


def header_footer(canv, doc):
    canv.saveState()
    # Header bar
    canv.setFillColor(NAVY)
    canv.rect(0, PAGE_H - 0.4 * inch, PAGE_W, 0.4 * inch, fill=1, stroke=0)
    canv.setFillColor(white)
    canv.setFont(FONT_BOLD, 10)
    canv.drawString(MARGIN, PAGE_H - 0.27 * inch, 'TECH360 LLC — OPERATIONAL BOOK')
    canv.drawRightString(PAGE_W - MARGIN, PAGE_H - 0.27 * inch, 'Connect • Innovate • Grow')

    # Footer
    canv.setFillColor(SECONDARY_TEXT)
    canv.setFont(FONT, 8)
    canv.drawString(MARGIN, 0.4 * inch, '© TECH360 LLC — Confidential — Operational Book')
    canv.drawRightString(PAGE_W - MARGIN, 0.4 * inch, f'Page {doc.page}')
    canv.setStrokeColor(BORDER)
    canv.line(MARGIN, 0.55 * inch, PAGE_W - MARGIN, 0.55 * inch)
    canv.restoreState()


def cover_page(canv, doc):
    """First page cover - drawn manually."""
    canv.saveState()
    # Full bleed background
    canv.setFillColor(NAVY)
    canv.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)

    # Diagonal gradient stripes
    canv.setFillColor(BLUE)
    canv.rect(0, PAGE_H * 0.35, PAGE_W, PAGE_H * 0.05, fill=1, stroke=0)
    canv.setFillColor(CYAN)
    canv.rect(0, PAGE_H * 0.30, PAGE_W, PAGE_H * 0.03, fill=1, stroke=0)
    canv.setFillColor(GREEN)
    canv.rect(0, PAGE_H * 0.27, PAGE_W, PAGE_H * 0.02, fill=1, stroke=0)

    # Logo box (top-left)
    canv.setFillColor(white)
    canv.setFont(FONT_BOLD, 36)
    canv.drawString(MARGIN, PAGE_H - 1.2 * inch, 'TECH360')
    canv.setFont(FONT, 9)
    canv.setFillColor(HexColor('#B0CDE8'))
    canv.drawString(MARGIN, PAGE_H - 1.45 * inch, 'CONNECT • INNOVATE • GROW')

    # Main title
    canv.setFillColor(white)
    canv.setFont(FONT_BOLD, 44)
    canv.drawString(MARGIN, PAGE_H * 0.55, 'Operational')
    canv.drawString(MARGIN, PAGE_H * 0.48, 'Book')

    # Subtitle
    canv.setFillColor(HexColor('#B0CDE8'))
    canv.setFont(FONT, 16)
    canv.drawString(MARGIN, PAGE_H * 0.42, 'Complete Production Runbook & Standard Operating Procedures')

    # Tag line
    canv.setFillColor(BRIGHT_GREEN)
    canv.setFont(FONT_BOLD, 11)
    canv.drawString(MARGIN, PAGE_H * 0.36, 'Laravel 11 • PHP 8.2+ • MySQL 8 • cPanel Production')

    # Bottom info block
    canv.setFillColor(white)
    canv.setFont(FONT, 10)
    info_y = 1.5 * inch
    canv.drawString(MARGIN, info_y + 0.5 * inch, 'Company: TECH360 LLC')
    canv.drawString(MARGIN, info_y + 0.35 * inch, 'Address: 117 S Lexington St, Ste 100, Harrisonville, MO 64701')
    canv.drawString(MARGIN, info_y + 0.2 * inch, 'Email: support@tech360.io')
    canv.drawString(MARGIN, info_y + 0.05 * inch, 'Phone: +1 (800) 360-0199')
    canv.drawString(MARGIN, info_y - 0.1 * inch, 'Web: https://tech360.io')
    canv.drawString(MARGIN, info_y - 0.25 * inch, 'Version: 1.0 — Production Release')

    # Bottom strip
    canv.setFillColor(GREEN)
    canv.rect(0, 0, PAGE_W, 0.3 * inch, fill=1, stroke=0)
    canv.setFillColor(white)
    canv.setFont(FONT_BOLD, 9)
    canv.drawCentredString(PAGE_W / 2, 0.12 * inch, 'CONFIDENTIAL — INTERNAL USE ONLY — © TECH360 LLC')

    canv.restoreState()


def make_styles():
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(
        name='TechH1', fontName=FONT_BOLD, fontSize=22, textColor=NAVY,
        spaceBefore=18, spaceAfter=12, leading=26,
    ))
    styles.add(ParagraphStyle(
        name='TechH2', fontName=FONT_BOLD, fontSize=16, textColor=BLUE,
        spaceBefore=14, spaceAfter=8, leading=20,
    ))
    styles.add(ParagraphStyle(
        name='TechH3', fontName=FONT_BOLD, fontSize=12, textColor=NAVY,
        spaceBefore=10, spaceAfter=6, leading=15,
    ))
    styles.add(ParagraphStyle(
        name='TechBody', fontName=FONT, fontSize=10.5, textColor=PRIMARY_TEXT,
        spaceBefore=4, spaceAfter=4, leading=15, alignment=TA_JUSTIFY,
    ))
    styles.add(ParagraphStyle(
        name='TechBullet', fontName=FONT, fontSize=10, textColor=PRIMARY_TEXT,
        leftIndent=20, spaceBefore=2, spaceAfter=2, leading=14,
    ))
    styles.add(ParagraphStyle(
        name='TechNote', fontName=FONT, fontSize=9.5, textColor=SECONDARY_TEXT,
        leftIndent=16, rightIndent=16, spaceBefore=6, spaceAfter=6, leading=13,
        borderColor=BLUE, borderWidth=0, borderPadding=8, backColor=LIGHT_BLUE,
    ))
    styles.add(ParagraphStyle(
        name='TechWarn', fontName=FONT, fontSize=9.5, textColor=ACCENT_RED,
        leftIndent=16, rightIndent=16, spaceBefore=6, spaceAfter=6, leading=13,
        borderPadding=8, backColor=HexColor('#FEE2E2'),
    ))
    return styles


def section_table(rows, col_widths=None):
    if not col_widths:
        col_widths = [CONTENT_W * 0.3, CONTENT_W * 0.7]
    t = Table(rows, colWidths=col_widths, hAlign='LEFT')
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), NAVY),
        ('TEXTCOLOR', (0, 0), (-1, 0), white),
        ('FONTNAME', (0, 0), (-1, 0), FONT_BOLD),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('FONTNAME', (0, 1), (-1, -1), FONT),
        ('FONTSIZE', (0, 1), (-1, -1), 9.5),
        ('TEXTCOLOR', (0, 1), (-1, -1), PRIMARY_TEXT),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [white, GRAY_BG]),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    return t


def build_story(styles):
    story = []

    # ===== COVER (page 1) =====
    # Cover is drawn by cover_page callback; just need a PageBreak to advance.
    story.append(Spacer(1, 0.1 * inch))
    story.append(PageBreak())

    # ===== TABLE OF CONTENTS =====
    story.append(Paragraph('Table of Contents', styles['TechH1']))
    story.append(Spacer(1, 12))
    toc_items = [
        ('1.', 'Executive Summary', 3),
        ('2.', 'System Architecture Overview', 4),
        ('3.', 'Technology Stack', 5),
        ('4.', 'Roles & Access Control (RBAC)', 6),
        ('5.', 'Public Website Operations', 7),
        ('6.', 'CRM Operations Manual', 8),
        ('7.', 'Admin Command Center Operations', 10),
        ('8.', 'AI Agent Platform Operations', 12),
        ('9.', 'Commercial Workflow (31-Step Journey)', 15),
        ('10.', 'Payment Verification & Webhook Security', 17),
        ('11.', 'Refund Operations Manual', 18),
        ('12.', 'Source Code Protection (5-Gate)', 19),
        ('13.', 'Handover & Delivery Operations', 20),
        ('14.', 'Payout Tracking & Risk Engine', 21),
        ('15.', 'Evidence Vault Operations', 22),
        ('16.', 'Dispute & Chargeback Response', 23),
        ('17.', 'Cryptographic Integrity System', 24),
        ('18.', 'Communication & Client ID System', 25),
        ('19.', 'No-Delete Policy Enforcement', 26),
        ('20.', 'Security Operations (CSRF, HMAC, Rate Limiting)', 27),
        ('21.', 'CMS (Content Management) Operations', 28),
        ('22.', 'Audit Logging Policy', 29),
        ('23.', 'Backup & Disaster Recovery', 30),
        ('24.', 'cPanel Deployment Runbook', 31),
        ('25.', 'Cron Job & Scheduler Configuration', 33),
        ('26.', 'Maintenance & Monitoring', 34),
        ('27.', 'Incident Response Playbook', 35),
        ('28.', 'Testing & Quality Assurance', 36),
        ('29.', 'Compliance & Legal Reference', 37),
        ('30.', 'Glossary & Reference', 38),
    ]
    toc_rows = [[num, title, f'p. {page}'] for num, title, page in toc_items]
    t = Table(toc_rows, colWidths=[0.4 * inch, CONTENT_W - 1.4 * inch, 1 * inch])
    t.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (-1, -1), FONT),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('TEXTCOLOR', (0, 0), (-1, -1), PRIMARY_TEXT),
        ('ALIGN', (2, 0), (2, -1), 'RIGHT'),
        ('TEXTCOLOR', (2, 0), (2, -1), SECONDARY_TEXT),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LINEBELOW', (0, 0), (-1, -1), 0.3, BORDER),
    ]))
    story.append(t)
    story.append(PageBreak())

    # ===== 1. EXECUTIVE SUMMARY =====
    story.append(Paragraph('1. Executive Summary', styles['TechH1']))
    story.append(Paragraph(
        'TECH360 LLC operates a complete production-grade technology platform built on Laravel 11, PHP 8.2+, MySQL 8, '
        'and Apache/cPanel hosting. This Operational Book serves as the authoritative reference for every system, '
        'workflow, role, security control, and operational procedure in the platform. It is intended for system '
        'administrators, business development managers, developers, support staff, and executives who need a clear '
        'understanding of how the platform functions end-to-end.',
        styles['TechBody']
    ))
    story.append(Paragraph(
        'The platform combines four operational layers: (1) a premium public marketing website with thirteen landing pages '
        'and full SEO metadata, (2) a real database-driven CRM with contacts, leads, deals, tasks, communications, and '
        'activities, (3) a Super Admin command center managing users, payments, refunds, source-code delivery, payouts, '
        'evidence, disputes, AI agents, and audit logs, and (4) an own AI agent platform with eleven seeded agents, '
        'eight tools, an approval center, knowledge base, memory system, and execution engine with provider abstraction '
        'supporting OpenAI, Ollama, and custom endpoints.',
        styles['TechBody']
    ))
    story.append(Paragraph(
        'Every sensitive action — payment verification, refund approval, source-code release, handover, payout creation, '
        'evidence upload, dispute resolution, AI execution, and admin login — is permanently recorded in an immutable audit '
        'log. Financial records and communication evidence are subject to a strict no-delete policy: data may be soft-deleted '
        'for operational purposes, but never permanently destroyed. All contracts, invoices, deliveries, and source-code '
        'releases are sealed with SHA-256 cryptographic hashes to detect tampering.',
        styles['TechBody']
    ))
    story.append(Paragraph(
        'This document is structured into thirty sections covering every operational dimension. Sections 1 through 5 '
        'cover the foundation: architecture, technology, access control, and the public-facing website. Sections 6 '
        'through 8 document internal systems: CRM, admin command center, and AI agent platform. Sections 9 through 13 '
        'detail the commercial workflow from initial client contact through final source-code delivery. Sections 14 '
        'through 19 cover financial integrity: payouts, evidence vault, disputes, cryptographic integrity, '
        'communication channels, and the no-delete policy. Sections 20 through 24 cover security, CMS, audit logging, '
        'backup, and the cPanel deployment runbook. The remaining sections address maintenance, incident response, '
        'testing, compliance, and reference materials.',
        styles['TechBody']
    ))

    # Image: hero
    if os.path.exists(os.path.join(IMAGE_DIR, 'hero-platform.png')):
        story.append(Spacer(1, 12))
        img = Image(os.path.join(IMAGE_DIR, 'hero-platform.png'), width=CONTENT_W, height=CONTENT_W * 0.55)
        story.append(img)
        story.append(Paragraph(
            '<i>Figure 1.1 — TECH360 Platform Overview: A unified system combining website, CRM, admin, and AI agents.</i>',
            styles['TechBody']
        ))
    story.append(PageBreak())

    # ===== 2. ARCHITECTURE =====
    story.append(Paragraph('2. System Architecture Overview', styles['TechH1']))
    story.append(Paragraph(
        'TECH360 is built as a monolithic Laravel 11 application with a Blade-template frontend, Eloquent ORM data layer, '
        'and MySQL 8 storage. The architecture deliberately avoids microservices complexity to maintain operational '
        'simplicity on standard cPanel shared hosting — no Docker, no Kubernetes, no message brokers, no Redis, no '
        'Supervisor. The system runs on a single PHP-FPM process pool, with optional queue workers spawned by cron '
        'every minute for background jobs.',
        styles['TechBody']
    ))
    story.append(Paragraph('2.1 Layer Diagram', styles['TechH2']))
    layers = [
        ['Layer', 'Components', 'Technology'],
        ['Presentation', 'Blade templates, CSS, JavaScript animations', 'Laravel Blade, vanilla JS'],
        ['Application', 'Controllers, Services, Middleware', 'PHP 8.2+, Laravel 11'],
        ['Domain', 'Eloquent Models, Business Logic', '41 models across 9 domains'],
        ['Data Access', 'Eloquent ORM, Migrations', 'MySQL 8 / MariaDB 10.4+'],
        ['Integration', 'Webhooks, AI providers, Payment gateways', 'HMAC, Stripe, OpenAI/Ollama'],
        ['Storage', 'Local filesystem, private disk', 'storage/app/private for evidence'],
    ]
    story.append(section_table(layers))
    story.append(Spacer(1, 12))

    story.append(Paragraph('2.2 Component Inventory', styles['TechH2']))
    story.append(Paragraph(
        'The platform comprises 43 database migrations defining the schema, 41 Eloquent models representing business '
        'entities, 14 HTTP controllers handling requests, 58 Blade views rendering responses, 87 named routes mapping '
        'URLs to controllers, 3 middleware enforcing authentication and authorization, 3 services encapsulating AI '
        'execution logic, 14 model factories generating test data, and 7 test files containing 68 test cases validating '
        'behavior. The vendor directory ships with the production ZIP — no Composer or Node.js installation is required '
        'on the target server.',
        styles['TechBody']
    ))
    if os.path.exists(os.path.join(IMAGE_DIR, 'security-architecture.png')):
        story.append(Spacer(1, 12))
        img = Image(os.path.join(IMAGE_DIR, 'security-architecture.png'), width=CONTENT_W, height=CONTENT_W * 0.55)
        story.append(img)
        story.append(Paragraph('<i>Figure 2.1 — Security architecture showing layers of protection.</i>', styles['TechBody']))
    story.append(PageBreak())

    # ===== 3. TECHNOLOGY STACK =====
    story.append(Paragraph('3. Technology Stack', styles['TechH1']))
    story.append(Paragraph(
        'TECH360 uses a deliberately conservative, proven technology stack. Every component has been chosen for long-term '
        'stability, broad hosting support, and operational simplicity. The stack is compatible with virtually every '
        'cPanel-based shared host — the only requirements are PHP 8.2 or higher, MySQL 8.0 or higher (or MariaDB 10.4+), '
        'and Apache with mod_rewrite. No Node.js runtime, no Docker daemon, no Redis cache, no Supervisor process '
        'manager, and no Varnish reverse proxy are required for normal operation.',
        styles['TechBody']
    ))
    stack = [
        ['Component', 'Version', 'Purpose'],
        ['PHP', '8.2+', 'Server-side language and runtime'],
        ['Laravel Framework', '11.x', 'Application framework (MVC, routing, Eloquent, Blade)'],
        ['MySQL', '8.0+ / MariaDB 10.4+', 'Primary relational database (utf8mb4_unicode_ci)'],
        ['Apache', '2.4+', 'Web server with mod_rewrite for clean URLs'],
        ['Blade', '11.x (bundled)', 'Templating engine for views'],
        ['Eloquent', '11.x (bundled)', 'ORM for database access'],
        ['Sanctum', '4.x', 'Optional API token authentication'],
        ['OpenAI API', 'gpt-4o-mini default', 'AI provider (also supports Ollama, custom endpoints)'],
        ['Stripe', 'Live/Test', 'Payment gateway (PayPal optional)'],
        ['ReportLab', '11.x', 'PDF document generation (Operational Book)'],
        ['PHPUnit', '11.x', 'Testing framework for feature/unit tests'],
    ]
    story.append(section_table(stack, col_widths=[CONTENT_W * 0.3, CONTENT_W * 0.25, CONTENT_W * 0.45]))
    story.append(Spacer(1, 12))

    story.append(Paragraph('3.1 Why This Stack', styles['TechH2']))
    story.append(Paragraph(
        'Laravel 11 was chosen because it is the most widely-deployed PHP framework, with predictable upgrade paths, '
        'extensive documentation, and broad hosting support. PHP 8.2+ provides readonly properties, enum support, and '
        'significant performance improvements over PHP 7. MySQL 8 with strict mode and utf8mb4_unicode_ci collation '
        'ensures data integrity and full Unicode support including emoji in user-supplied content. Apache with '
        'mod_rewrite handles clean URLs without additional configuration on cPanel.',
        styles['TechBody']
    ))
    story.append(Paragraph(
        'The decision to ship the vendor directory in the production ZIP eliminates the need for Composer on the '
        'production server — important for shared hosting where Composer may not be installed. The trade-off is a larger '
        'ZIP file (approximately 9 MB), but this is acceptable given the operational simplicity gained. Storage '
        'operations use Laravel\'s local filesystem driver with a separate "private" disk for sensitive evidence files, '
        'ensuring they are never exposed under the public web root.',
        styles['TechBody']
    ))
    story.append(PageBreak())

    # ===== 4. ROLES & ACCESS CONTROL =====
    story.append(Paragraph('4. Roles & Access Control (RBAC)', styles['TechH1']))
    story.append(Paragraph(
        'TECH360 implements role-based access control through a single role column on the users table, evaluated by '
        'the AdminMiddleware on every protected route. Four roles exist: client (default for self-registered users), '
        'staff (employees with CRM access), admin (full system access including payments and refunds), and super_admin '
        '(identical to admin in the current schema but reserved for future escalation privileges). Every protected '
        'route is wrapped in middleware that checks the role server-side — never relying on UI hiding alone.',
        styles['TechBody']
    ))
    story.append(Paragraph('4.1 Role Permission Matrix', styles['TechH2']))
    perms = [
        ['Capability', 'Client', 'Staff', 'Admin'],
        ['View public website', 'YES', 'YES', 'YES'],
        ['Submit contact form', 'YES', 'YES', 'YES'],
        ['Register new account', 'YES', 'YES', 'YES'],
        ['View own client dashboard', 'YES', 'YES', 'YES'],
        ['Approve scope of work', 'YES (own)', 'YES (any)', 'YES (any)'],
        ['Initiate payment', 'YES (own)', 'NO', 'YES (any)'],
        ['View CRM dashboard', 'NO', 'YES', 'YES'],
        ['Create contact / lead / deal', 'NO', 'YES', 'YES'],
        ['Verify payment', 'NO', 'NO', 'YES'],
        ['Approve / deny refund', 'NO', 'NO', 'YES'],
        ['Release source code', 'NO', 'NO', 'YES'],
        ['Create / approve payout', 'NO', 'NO', 'YES'],
        ['Manage AI agents', 'NO', 'NO', 'YES'],
        ['Approve AI executions', 'NO', 'NO', 'YES'],
        ['Manage CMS content', 'NO', 'YES', 'YES'],
        ['View audit logs', 'NO', 'NO', 'YES'],
        ['Manage evidence vault', 'NO', 'NO', 'YES'],
        ['Open / resolve disputes', 'NO', 'NO', 'YES'],
    ]
    story.append(section_table(perms, col_widths=[CONTENT_W * 0.4, CONTENT_W * 0.2, CONTENT_W * 0.2, CONTENT_W * 0.2]))
    story.append(Spacer(1, 8))
    story.append(Paragraph(
        '<b>Enforcement:</b> The AdminMiddleware class checks <code>auth()->user()->isStaff()</code> which returns true '
        'only when the role is "admin" or "staff". Unauthorized users receive an HTTP 403 Forbidden response with the '
        'message "Unauthorized. Admin access required." Unauthenticated users are redirected to the login page (HTTP '
        '302) by Laravel\'s built-in auth middleware.',
        styles['TechNote']
    ))
    story.append(PageBreak())

    # ===== 5. PUBLIC WEBSITE =====
    story.append(Paragraph('5. Public Website Operations', styles['TechH1']))
    story.append(Paragraph(
        'The public website comprises thirteen landing pages, all rendered from Blade templates with consistent '
        'TECH360 branding. Every page returns HTTP 200, includes SEO metadata (title, description, canonical URL, '
        'Open Graph, Twitter Card), uses responsive design tested at 320px, 375px, 390px, 768px, 1024px, and 1440px+ '
        'breakpoints, and respects prefers-reduced-motion for users with motion sensitivity. The homepage features '
        'an animated hero workflow, product preview dashboard, service demonstrations, and an architecture diagram '
        'with data flow particles.',
        styles['TechBody']
    ))
    story.append(Paragraph('5.1 Public Page Inventory', styles['TechH2']))
    pages = [
        ['Route', 'Page Title', 'Purpose'],
        ['/', 'TECH360 — Systems That Run Your Business at 10x Speed', 'Animated hero, product preview, services'],
        ['/about', 'About TECH360', 'Company mission, vision, values'],
        ['/services', 'Services | TECH360 LLC', 'Nine service lines with pricing tiers'],
        ['/services/{slug}', 'Service Detail', 'Individual service page (CMS-driven)'],
        ['/industries', 'Industries', 'Industry verticals served'],
        ['/portfolio', 'Portfolio', 'Project showcase (CMS-driven)'],
        ['/case-studies', 'Case Studies', 'Detailed project case studies'],
        ['/blog', 'Blog', 'Published blog posts (CMS-driven)'],
        ['/blog/{slug}', 'Blog Post', 'Individual blog article'],
        ['/pricing', 'Pricing', 'Six pricing tiers with FAQ'],
        ['/contact', 'Contact', 'Project inquiry form (creates CRM lead)'],
        ['/terms', 'Terms & Conditions', 'TECH360 LLC legal terms'],
        ['/refund-policy', 'Refund Policy', 'Refund policy (no refund after scope approval)'],
        ['/privacy-policy', 'Privacy Policy', 'Data privacy practices'],
        ['/cookie-policy', 'Cookie Policy', 'Cookie usage disclosure'],
    ]
    story.append(section_table(pages, col_widths=[CONTENT_W * 0.22, CONTENT_W * 0.43, CONTENT_W * 0.35]))
    story.append(PageBreak())

    # ===== 6. CRM OPERATIONS =====
    story.append(Paragraph('6. CRM Operations Manual', styles['TechH1']))
    story.append(Paragraph(
        'The CRM module is a real database-driven system with six interconnected modules: contacts, leads, deals, tasks, '
        'communications, and activities. Every metric displayed on the CRM dashboard is pulled from live database '
        'queries — there are no fake counters or hardcoded numbers. All lists use Laravel\'s built-in pagination (20 '
        'records per page by default) with eager loading to prevent N+1 query problems.',
        styles['TechBody']
    ))

    story.append(Paragraph('6.1 Contacts Module', styles['TechH2']))
    story.append(Paragraph(
        'Contacts are the foundational entity of the CRM. Every contact receives a unique identifier in the format '
        'TECH-CON-XXXXXX (zero-padded sequential number) at creation time. Contacts can be created through the admin '
        'interface, through the public contact form (which automatically creates a contact and lead), or through AI '
        'agent tools that have been granted the crm_create_lead permission. Contacts support search by name, email, '
        'or phone; filtering by status (lead, qualified, customer, inactive); and full pagination.',
        styles['TechBody']
    ))
    story.append(Paragraph(
        'Each contact detail page displays the contact\'s leads, deals, tasks, communications timeline, and activity '
        'history. Admins can add new communications directly from the contact detail page, selecting channel (email, '
        'phone, WhatsApp, SMS, meeting), direction (inbound/outbound), and status (completed, missed, scheduled).',
        styles['TechBody']
    ))

    story.append(Paragraph('6.2 Leads Module', styles['TechH2']))
    story.append(Paragraph(
        'Leads represent potential business opportunities. Each lead has a unique TECH-LEAD-XXXXXX identifier, links to '
        'a contact, tracks source (website, manual, ad, referral), service interest, status (new, contacted, qualified, '
        'proposal, negotiation, won, lost), and priority (low, medium, high). The CRM dashboard surfaces new leads '
        'count, qualified leads count, and a leads-by-source breakdown.',
        styles['TechBody']
    ))

    story.append(Paragraph('6.3 Deals Module', styles['TechH2']))
    story.append(Paragraph(
        'Deals are revenue-bearing opportunities in a sales pipeline. Each deal has a title, value, currency, stage '
        '(lead, qualified, proposal, negotiation, won, lost), probability percentage, expected close date, and '
        'assigned owner. The dashboard displays open deals count, won deals count, pipeline value (sum of open deal '
        'values), and won value (sum of won deal values). Deals can be filtered by stage.',
        styles['TechBody']
    ))

    story.append(Paragraph('6.4 Tasks Module', styles['TechH2']))
    story.append(Paragraph(
        'Tasks are actionable items assigned to staff or related to contacts. Each task has a title, description, '
        'optional contact link, priority (low, medium, high), due date, and status (pending, in_progress, completed). '
        'The dashboard surfaces pending tasks count.',
        styles['TechBody']
    ))

    story.append(Paragraph('6.5 Communications & Activities', styles['TechH2']))
    story.append(Paragraph(
        'Communications are recorded interactions with contacts across channels (email, phone, WhatsApp, SMS, meeting). '
        'Each communication records direction (inbound/outbound), status, subject, content, and timestamp. '
        'Activities are auto-generated audit entries for every CRM action (contact created, lead converted, deal moved '
        'stage) and provide a complete activity timeline per contact.',
        styles['TechBody']
    ))
    if os.path.exists(os.path.join(IMAGE_DIR, 'crm-dashboard.png')):
        story.append(Spacer(1, 12))
        img = Image(os.path.join(IMAGE_DIR, 'crm-dashboard.png'), width=CONTENT_W, height=CONTENT_W * 0.55)
        story.append(img)
        story.append(Paragraph('<i>Figure 6.1 — CRM Dashboard showing real database metrics.</i>', styles['TechBody']))
    story.append(PageBreak())

    # ===== 7. ADMIN COMMAND CENTER =====
    story.append(Paragraph('7. Admin Command Center Operations', styles['TechH1']))
    story.append(Paragraph(
        'The Admin Command Center is the operational hub for system administrators. From a single dashboard, admins '
        'can monitor every active project, verify pending payments, review refund requests, release source code for '
        'completed projects, browse audit logs, manage AI agents, create payouts, upload evidence, and resolve '
        'disputes. Every action is gated by server-side role checks and logged in the audit trail.',
        styles['TechBody']
    ))

    story.append(Paragraph('7.1 Admin Modules', styles['TechH2']))
    admin_modules = [
        ['Module', 'Route Prefix', 'Purpose'],
        ['Dashboard', '/admin/dashboard', 'Overview metrics + quick links'],
        ['Clients', '/admin/clients', 'View all clients, projects per client'],
        ['Projects', '/admin/projects', 'View projects, release handover'],
        ['Payments', '/admin/payments', 'View payments, verify pending'],
        ['Refunds', '/admin/refunds', 'Review refund requests, approve/deny'],
        ['Audit Logs', '/admin/audit-logs', 'Browse all audit log entries'],
        ['AI Command', '/admin/ai-command-center', 'Legacy AI dashboard'],
        ['AI Dashboard', '/admin/ai/dashboard', 'AI agent overview & approvals'],
        ['AI Agents', '/admin/ai/agents', 'Create, toggle, execute AI agents'],
        ['AI Approvals', '/admin/ai/approvals', 'Approve/reject pending AI executions'],
        ['AI Knowledge', '/admin/ai/knowledge', 'Manage knowledge documents'],
        ['AI Workflows', '/admin/ai/workflows', 'Create multi-step AI workflows'],
        ['AI Logs', '/admin/ai/logs', 'Browse AI execution logs'],
        ['Payouts', '/admin/payouts', 'Create & approve payouts'],
        ['Evidence Vault', '/admin/evidence', 'Upload & verify evidence'],
        ['Disputes', '/admin/disputes', 'Open, compile, resolve disputes'],
        ['CMS Services', '/admin/cms/services', 'Manage service catalog'],
        ['CMS Portfolio', '/admin/cms/portfolio', 'Manage portfolio items'],
        ['CMS Blog', '/admin/cms/blog', 'Publish blog posts'],
        ['CMS Testimonials', '/admin/cms/testimonials', 'Manage testimonials'],
        ['CMS Settings', '/admin/cms/settings', 'Application settings'],
        ['Form Submissions', '/admin/cms/form-submissions', 'View contact form submissions'],
    ]
    story.append(section_table(admin_modules, col_widths=[CONTENT_W * 0.25, CONTENT_W * 0.30, CONTENT_W * 0.45]))
    story.append(PageBreak())

    # ===== 8. AI AGENT PLATFORM =====
    story.append(Paragraph('8. AI Agent Platform Operations', styles['TechH1']))
    story.append(Paragraph(
        'TECH360 operates its own AI agent platform — not a SaaS dependency. Eleven named AI agents are seeded by '
        'default, each with a defined role, system instructions, execution mode, and access to a curated set of tools. '
        'The AI execution engine supports three providers (OpenAI, Ollama, custom endpoints) through a unified '
        'abstraction layer. Every execution is logged with start time, end time, token usage, status, and any errors. '
        'Actions requiring human review enter a pending approval queue that admins must explicitly approve or reject.',
        styles['TechBody']
    ))

    story.append(Paragraph('8.1 Seeded AI Agents', styles['TechH2']))
    agents = [
        ['#', 'Agent Name', 'Mode', 'Purpose'],
        ['1', 'AI Command Center Agent', 'Approval', 'Routes requests to other agents'],
        ['2', 'Lead Management Agent', 'Approval', 'Classify, score, prioritize leads'],
        ['3', 'CRM Agent', 'Approval', 'Search CRM, create activities'],
        ['4', 'Sales Agent', 'Approval', 'Pipeline analysis, stale deals'],
        ['5', 'Customer Communication Agent', 'Approval', 'Summarize communications, draft replies'],
        ['6', 'Website Enquiry Agent', 'Approval', 'Process form submissions, classify'],
        ['7', 'Support Agent', 'Approval', 'Knowledge base search, escalation'],
        ['8', 'Marketing Agent', 'Approval', 'Campaign recommendations'],
        ['9', 'Reporting Agent', 'Approval', 'Daily, weekly, monthly reports'],
        ['10', 'Security Monitoring Agent', 'Approval', 'Audit log review, alerts'],
        ['11', 'System/Deployment Agent', 'Approval', 'Health checks, config review'],
    ]
    story.append(section_table(agents, col_widths=[0.3 * inch, 2.2 * inch, 0.8 * inch, CONTENT_W - 0.3*inch - 2.2*inch - 0.8*inch]))
    story.append(Spacer(1, 8))

    story.append(Paragraph('8.2 AI Execution Modes', styles['TechH2']))
    story.append(Paragraph(
        'Three execution modes control how each agent runs. <b>Manual</b> mode requires explicit admin approval before '
        'any execution — the agent cannot act autonomously. <b>Approval</b> mode (default for all seeded agents) creates '
        'a pending approval record when triggered; an admin must explicitly approve before the agent\'s output is '
        'released. <b>Autonomous</b> mode executes immediately without approval — this mode is reserved for low-risk, '
        'read-only agents and should never be enabled for agents with write tools.',
        styles['TechBody']
    ))

    story.append(Paragraph('8.3 AI Tools (8 Seeded)', styles['TechH2']))
    tools = [
        ['Tool Slug', 'Risk', 'Description'],
        ['crm_search_leads', 'Low', 'Search leads (read-only)'],
        ['crm_create_lead', 'Medium', 'Create a new lead'],
        ['crm_search_contacts', 'Low', 'Search contacts (read-only)'],
        ['crm_create_activity', 'Low', 'Create activity record'],
        ['crm_create_task', 'Low', 'Create a CRM task'],
        ['get_pipeline_stats', 'Low', 'Sales pipeline statistics (read-only)'],
        ['email_draft', 'Medium', 'Draft an email response (requires approval)'],
        ['system_health', 'Low', 'Check application health (read-only)'],
    ]
    story.append(section_table(tools, col_widths=[CONTENT_W * 0.3, CONTENT_W * 0.15, CONTENT_W * 0.55]))
    story.append(Spacer(1, 8))
    story.append(Paragraph(
        '<b>Security Constraint:</b> AI tools cannot execute arbitrary SQL, PHP, or shell commands. They cannot '
        'access .env configuration or passwords. They cannot send external communications without explicit admin '
        'approval. Every tool call is audit-logged with parameters, result, and duration.',
        styles['TechWarn']
    ))
    story.append(PageBreak())

    # ===== 9. COMMERCIAL WORKFLOW (31-STEP JOURNEY) =====
    story.append(Paragraph('9. Commercial Workflow — 31-Step Customer Journey', styles['TechH1']))
    story.append(Paragraph(
        'Every client engagement follows a structured 31-step journey from initial WhatsApp contact through final '
        'source-code delivery. No step may be skipped. Each transition is enforced at the database and controller '
        'level, with full audit logging. The journey is divided into seven phases: Inquiry, Scope, Payment, '
        'Development, QA, Delivery, and Post-Delivery.',
        styles['TechBody']
    ))

    story.append(Paragraph('9.1 Phase 1: Inquiry (Steps 1–5)', styles['TechH2']))
    p1 = [
        ['Step', 'Action', 'System State'],
        ['1', 'Client contacts via WhatsApp / contact form', 'Lead captured in CRM'],
        ['2', 'System auto-requests client email', 'CommunicationChannel created'],
        ['3', 'Client verifies email', 'client_verifications.status=verified'],
        ['4', 'System generates TECH-CL-XXXXXX identifier', 'client_identifier assigned'],
        ['5', 'BD Manager assigned to lead', 'bd_manager_id set'],
    ]
    story.append(section_table(p1, col_widths=[0.4 * inch, CONTENT_W * 0.55, CONTENT_W * 0.45 - 0.4*inch]))
    story.append(Spacer(1, 8))

    story.append(Paragraph('9.2 Phase 2: Scope (Steps 6–10)', styles['TechH2']))
    p2 = [
        ['Step', 'Action', 'System State'],
        ['6', 'BD Manager creates Scope of Work draft', 'scope_of_works.status=pending'],
        ['7', 'Scope versioned and sent to client', 'scope_versions created'],
        ['8', 'Client reviews scope in portal', 'project.commercial_state=SCOPE_SENT'],
        ['9', 'Client signs 5 acknowledgements', 'scope_approvals created'],
        ['10', 'Scope approved — refund policy locks', 'project.commercial_state=SCOPE_APPROVED'],
    ]
    story.append(section_table(p2, col_widths=[0.4 * inch, CONTENT_W * 0.55, CONTENT_W * 0.45 - 0.4*inch]))
    story.append(Spacer(1, 8))

    story.append(Paragraph('9.3 Phase 3: Payment (Steps 11–14)', styles['TechH2']))
    p3 = [
        ['Step', 'Action', 'System State'],
        ['11', 'Invoice generated with cryptographic hash', 'invoices.created + integrity_records'],
        ['12', 'Client initiates payment', 'payments.status=pending'],
        ['13', 'Payment webhook received (HMAC verified)', 'payments.status=paid'],
        ['14', 'Admin verifies payment server-side', 'project.commercial_state=PAYMENT_PAID'],
    ]
    story.append(section_table(p3, col_widths=[0.4 * inch, CONTENT_W * 0.55, CONTENT_W * 0.45 - 0.4*inch]))
    story.append(Spacer(1, 8))

    story.append(Paragraph('9.4 Phase 4: Development (Steps 15–19)', styles['TechH2']))
    p4 = [
        ['Step', 'Action', 'System State'],
        ['15', 'Project activated for development', 'project.commercial_state=DEVELOPMENT'],
        ['16', 'Development tasks created & assigned', 'project_tasks created'],
        ['17', 'Daily check-ins logged', 'activities logged'],
        ['18', 'Milestone progress tracked', 'project_milestones updated'],
        ['19', 'Staging preview prepared', 'previews created'],
    ]
    story.append(section_table(p4, col_widths=[0.4 * inch, CONTENT_W * 0.55, CONTENT_W * 0.45 - 0.4*inch]))
    story.append(Spacer(1, 8))

    story.append(Paragraph('9.5 Phase 5: QA (Steps 20–23)', styles['TechH2']))
    p5 = [
        ['Step', 'Action', 'System State'],
        ['20', 'QA record created', 'qa_records created'],
        ['21', 'Code review completed', 'qa_records.code_review=passed'],
        ['22', 'Security scan run', 'qa_records.security_scan=passed'],
        ['23', 'Performance test passed', 'qa_records.performance=passed'],
    ]
    story.append(section_table(p5, col_widths=[0.4 * inch, CONTENT_W * 0.55, CONTENT_W * 0.45 - 0.4*inch]))
    story.append(Spacer(1, 8))

    story.append(Paragraph('9.6 Phase 6: Delivery (Steps 24–28)', styles['TechH2']))
    p6 = [
        ['Step', 'Action', 'System State'],
        ['24', 'Client previews staging build', 'project.commercial_state=FINAL_REVIEW'],
        ['25', 'Client signs acceptance form', 'delivery.client_confirmed=true'],
        ['26', 'Admin approves handover', 'delivery.admin_approval=approved'],
        ['27', 'Password rotation completed', 'delivery.password_rotation_complete=true'],
        ['28', 'Source code released to client', 'project.commercial_state=FINAL_HANDOVER'],
    ]
    story.append(section_table(p6, col_widths=[0.4 * inch, CONTENT_W * 0.55, CONTENT_W * 0.45 - 0.4*inch]))
    story.append(Spacer(1, 8))

    story.append(Paragraph('9.7 Phase 7: Post-Delivery (Steps 29–31)', styles['TechH2']))
    p7 = [
        ['Step', 'Action', 'System State'],
        ['29', 'Payout processed to development team', 'payouts.status=completed'],
        ['30', '30-day bug-fix support window opens', 'project.commercial_state=PROJECT_CLOSED'],
        ['31', 'Evidence vault finalized', 'evidence_vault sealed'],
    ]
    story.append(section_table(p7, col_widths=[0.4 * inch, CONTENT_W * 0.55, CONTENT_W * 0.45 - 0.4*inch]))
    story.append(Spacer(1, 8))
    if os.path.exists(os.path.join(IMAGE_DIR, 'dev-lifecycle.png')):
        img = Image(os.path.join(IMAGE_DIR, 'dev-lifecycle.png'), width=CONTENT_W, height=CONTENT_W * 0.45)
        story.append(img)
        story.append(Paragraph('<i>Figure 9.1 — Development lifecycle from scope to handover.</i>', styles['TechBody']))
    story.append(PageBreak())

    # ===== 10. PAYMENT VERIFICATION =====
    story.append(Paragraph('10. Payment Verification & Webhook Security', styles['TechH1']))
    story.append(Paragraph(
        'Payment verification is the most security-critical operation in the platform. The system enforces a strict '
        'separation between payment initiation (client-side) and payment verification (server-side only). A client can '
        'never mark their own payment as paid — only an admin or a verified webhook can do so. Every webhook call is '
        'authenticated via HMAC-SHA256 signature verification, replay-protected with a 5-minute timestamp window, and '
        'made idempotent by checking for already-processed transaction IDs.',
        styles['TechBody']
    ))
    story.append(Paragraph('10.1 Payment Status Lifecycle', styles['TechH2']))
    pay_states = [
        ['Status', 'Set By', 'Description'],
        ['pending', 'Client initiates', 'Payment created, awaiting gateway response'],
        ['paid', 'Admin OR webhook (HMAC)', 'Payment verified server-side'],
        ['failed', 'Webhook', 'Payment failed at gateway'],
        ['refunded', 'Admin (after refund approval)', 'Refund processed'],
    ]
    story.append(section_table(pay_states, col_widths=[CONTENT_W * 0.2, CONTENT_W * 0.35, CONTENT_W * 0.45]))
    story.append(Spacer(1, 12))

    story.append(Paragraph('10.2 Webhook HMAC Verification', styles['TechH2']))
    story.append(Paragraph(
        'The webhook endpoint at <code>/webhook/payment</code> expects an HTTP header <code>X-TECH360-Signature</code> '
        'containing the HMAC-SHA256 of the raw request body, using the secret stored in <code>PAYMENT_WEBHOOK_SECRET</code>. '
        'Verification uses <code>hash_equals()</code> for constant-time comparison to prevent timing attacks. A secondary '
        'header <code>X-TECH360-Timestamp</code> is checked against the current time ± 300 seconds to prevent replay '
        'attacks. If the secret is unset (development mode), the webhook accepts unsigned requests but logs a warning.',
        styles['TechBody']
    ))
    story.append(Paragraph(
        '<b>Idempotency:</b> If a webhook is received for a transaction ID that has already been processed (payment '
        'status already "paid"), the endpoint returns HTTP 200 with <code>{"status":"already_processed"}</code> without '
        'making any database changes. This prevents duplicate processing when Stripe/PayPal retry delivery.',
        styles['TechNote']
    ))
    story.append(PageBreak())

    # ===== 11. REFUND OPERATIONS =====
    story.append(Paragraph('11. Refund Operations Manual', styles['TechH1']))
    story.append(Paragraph(
        'Refunds are governed by the TECH360 Refund Policy: <b>after Scope of Work approval, payments are non-refundable '
        'except where required by applicable law or otherwise agreed in writing.</b> This policy is enforced operationally '
        'through a mandatory admin review step — refunds are never auto-approved, even for low-value requests. Every '
        'refund decision is audit-logged with the reviewer, decision, reason, and timestamp.',
        styles['TechBody']
    ))
    story.append(Paragraph('11.1 Refund Workflow', styles['TechH2']))
    refund_flow = [
        ['Step', 'Action', 'Actor', 'System State'],
        ['1', 'Client submits refund request form', 'Client', 'refund_requests.status=refund_requested'],
        ['2', 'Admin reviews request in /admin/refunds', 'Admin', 'refund_requests.status=refund_review'],
        ['3', 'Admin approves or denies', 'Admin', 'refund_requests.status=approved or denied'],
        ['4', 'If approved, refund executed via gateway', 'Admin', 'refund_requests.status=refunded'],
        ['5', 'Audit log entry created', 'System', 'audit_logs.action=refund_approved'],
        ['6', 'Client notified by email', 'System', 'communication logged'],
    ]
    story.append(section_table(refund_flow, col_widths=[0.4 * inch, CONTENT_W * 0.4, CONTENT_W * 0.15, CONTENT_W * 0.45 - 0.4*inch]))
    story.append(Spacer(1, 12))

    story.append(Paragraph('11.2 Idempotency Protection', styles['TechH2']))
    story.append(Paragraph(
        'Each refund request has a unique <code>refund_id</code> in the format REF-2026-XXXXXX. Once a refund has been '
        'reviewed (status moved to approved, denied, or refunded), it cannot be re-reviewed — the controller returns '
        'an error message: "This refund has already been decided." This prevents accidental duplicate refunds if an '
        'admin clicks the approve button multiple times or if the page is refreshed.',
        styles['TechBody']
    ))
    story.append(PageBreak())

    # ===== 12. SOURCE CODE PROTECTION =====
    story.append(Paragraph('12. Source Code Protection (5-Gate Authorization)', styles['TechH1']))
    story.append(Paragraph(
        'Source code is TECH360\'s most valuable intellectual property. Until all five authorization gates pass, the '
        'client cannot download the source code package. This is not a UI-level hide — the controller performs a '
        'server-side check on every download attempt and returns HTTP 403 Forbidden with an explicit reason if any '
        'gate fails.',
        styles['TechBody']
    ))
    story.append(Paragraph('12.1 The Five Gates', styles['TechH2']))
    gates = [
        ['Gate', 'Check', 'Failure Reason'],
        ['1. Scope Approved', 'Project has at least one scope with status=approved', 'Scope not approved'],
        ['2. Payment Verified', 'Project has payment record with status=paid', 'Payment not verified'],
        ['3. QA Passed', 'Delivery.qa_status = passed', 'QA not passed'],
        ['4. Admin Approval', 'Delivery.admin_approval = approved', 'Admin approval required'],
        ['5. Password Rotation', 'Delivery.password_rotation_complete = true', 'Password rotation pending'],
    ]
    story.append(section_table(gates, col_widths=[CONTENT_W * 0.25, CONTENT_W * 0.5, CONTENT_W * 0.25]))
    story.append(Spacer(1, 12))

    story.append(Paragraph('12.2 Download Authorization Flow', styles['TechH2']))
    story.append(Paragraph(
        'When a client requests <code>/client/projects/{project}/download</code>, the DeliveryController invokes '
        '<code>checkSourceCodeAccess()</code> which evaluates all five gates. If any gate fails, the request is aborted '
        'with HTTP 403 and a message listing the failed gates. If all gates pass, the controller returns a signed '
        'download URL pointing to the source code package in private storage. The signed URL expires after a '
        'configurable TTL (default 24 hours) to prevent sharing.',
        styles['TechBody']
    ))
    story.append(Paragraph(
        '<b>No source files are stored under public/.</b> All source-code packages live in '
        '<code>storage/app/private/source_releases/</code> which is outside the cPanel document root. Files are served '
        'only through the authorized download endpoint after all gates pass.',
        styles['TechWarn']
    ))
    if os.path.exists(os.path.join(IMAGE_DIR, 'delivery-handover.png')):
        story.append(Spacer(1, 12))
        img = Image(os.path.join(IMAGE_DIR, 'delivery-handover.png'), width=CONTENT_W, height=CONTENT_W * 0.55)
        story.append(img)
        story.append(Paragraph('<i>Figure 12.1 — Delivery handover workflow with 5-gate protection.</i>', styles['TechBody']))
    story.append(PageBreak())

    # ===== 13. HANDOVER =====
    story.append(Paragraph('13. Handover & Delivery Operations', styles['TechH1']))
    story.append(Paragraph(
        'Handover is the controlled process of transferring completed work from TECH360 to the client. It includes '
        'delivery of source code, deployment documentation, credentials, and final acceptance. Every handover action '
        'is audited and the credentials handover is recorded separately from the source-code release.',
        styles['TechBody']
    ))
    story.append(Paragraph('13.1 Handover Components', styles['TechH2']))
    handover_items = [
        ['Component', 'Storage Location', 'Hash'],
        ['Source code package', 'storage/app/private/source_releases/', 'SHA-256'],
        ['Deployment guide', 'storage/app/private/handover/', 'SHA-256'],
        ['Credentials file', 'storage/app/private/handover/', 'SHA-256 (encrypted at rest)'],
        ['Acceptance form', 'evidence_vault (type=acceptance)', 'SHA-256'],
        ['Audit log entry', 'audit_logs table', 'N/A (append-only)'],
    ]
    story.append(section_table(handover_items, col_widths=[CONTENT_W * 0.3, CONTENT_W * 0.45, CONTENT_W * 0.25]))
    story.append(Spacer(1, 12))
    story.append(Paragraph(
        'The admin clicks "Release Handover" on the admin projects page. This sets the delivery record\'s '
        '<code>admin_approval=approved</code>, <code>admin_approved_by</code>, and <code>admin_approved_at</code> '
        'fields, then transitions the project\'s <code>commercial_state</code> to <code>FINAL_HANDOVER</code>. The '
        'client can now access the handover page and download the source code (provided password rotation is also '
        'complete).',
        styles['TechBody']
    ))
    story.append(PageBreak())

    # ===== 14. PAYOUTS =====
    story.append(Paragraph('14. Payout Tracking & Risk Engine', styles['TechH1']))
    story.append(Paragraph(
        'Payouts are disbursements from TECH360 to developers, vendors, contractors, and partners. They are tracked '
        'separately from payment verification — a client payment being verified does not automatically trigger a '
        'payout. Every payout is risk-assessed at creation time using a deterministic scoring algorithm.',
        styles['TechBody']
    ))

    story.append(Paragraph('14.1 Risk Engine Thresholds', styles['TechH2']))
    risk = [
        ['Threshold', 'Amount', 'Behavior'],
        ['Instant payout eligible', '< $10,000', 'Auto-eligible for immediate processing'],
        ['Standard review', '$10,000 – $19,999', 'Requires admin approval before processing'],
        ['High-value mandatory review', '≥ $20,000', 'Status forced to "on_hold" — cannot be auto-approved'],
        ['New client (under 7 days)', 'Any amount', 'Risk score +30 — additional review recommended'],
    ]
    story.append(section_table(risk, col_widths=[CONTENT_W * 0.3, CONTENT_W * 0.2, CONTENT_W * 0.5]))
    story.append(Spacer(1, 12))

    story.append(Paragraph('14.2 Payout Status Lifecycle', styles['TechH2']))
    story.append(Paragraph(
        'A payout moves through the following states: <b>pending</b> (created, awaiting approval) → '
        '<b>approved</b> (admin approved, awaiting processing) → <b>processing</b> (gateway contacted) → '
        '<b>completed</b> (gateway confirmed success) or <b>failed</b> (gateway reported failure). '
        'High-value payouts are created in the <b>on_hold</b> state and cannot move to approved without explicit '
        'admin action.',
        styles['TechBody']
    ))
    story.append(Paragraph(
        '<b>Audit & Evidence:</b> Every payout creation, approval, and processing generates an audit log entry. A '
        'corresponding evidence_vault entry of type "payout" is created automatically, capturing the amount, method, '
        'risk score, and risk flags. This evidence is permanent and cannot be deleted.',
        styles['TechNote']
    ))
    story.append(PageBreak())

    # ===== 15. EVIDENCE VAULT =====
    story.append(Paragraph('15. Evidence Vault Operations', styles['TechH1']))
    story.append(Paragraph(
        'The Evidence Vault is TECH360\'s centralized, immutable repository for all evidentiary records. It serves as '
        'the single source of truth during disputes, audits, compliance reviews, and legal proceedings. The vault '
        'stores twelve categories of evidence, each with mandatory SHA-256 file hashing, content hashing, lock status, '
        'and a permanent_delete_blocked flag that prevents hard deletion.',
        styles['TechBody']
    ))

    story.append(Paragraph('15.1 Evidence Types', styles['TechH2']))
    ev_types = [
        ['Type', 'Example Use Case'],
        ['communication', 'WhatsApp / email / call logs with clients'],
        ['payment', 'Stripe/PayPal receipts, bank statements'],
        ['contract', 'Signed Scope of Work, formal agreements'],
        ['invoice', 'Generated invoices with cryptographic seals'],
        ['delivery', 'Delivery receipts, handover confirmations'],
        ['acceptance', 'Client acceptance forms (signed)'],
        ['payout', 'Payout records to vendors/developers'],
        ['refund', 'Refund receipts, gateway confirmations'],
        ['dispute', 'Chargeback notifications, case files'],
        ['audit', 'Audit log exports (compressed)'],
        ['source_release', 'Source code package with hash'],
        ['handover', 'Credentials handover, deployment guides'],
    ]
    story.append(section_table(ev_types, col_widths=[CONTENT_W * 0.25, CONTENT_W * 0.75]))
    story.append(Spacer(1, 12))

    story.append(Paragraph('15.2 Integrity Verification', styles['TechH2']))
    story.append(Paragraph(
        'Every evidence record stores two hashes: <code>file_hash</code> (SHA-256 of the attached file) and '
        '<code>content_hash</code> (SHA-256 of the title and description text). Admins can manually trigger an '
        'integrity check at any time, which recalculates the file hash and compares it to the stored value. If they '
        'differ, the verification returns "tampered" and an alert is raised. Downloads are blocked when tampering is '
        'detected.',
        styles['TechBody']
    ))
    story.append(PageBreak())

    # ===== 16. DISPUTES =====
    story.append(Paragraph('16. Dispute & Chargeback Response', styles['TechH1']))
    story.append(Paragraph(
        'When Stripe, PayPal, or a bank notifies TECH360 of a chargeback or client dispute, an admin opens a dispute '
        'record in the platform. The system sets a 7-day response window (configurable) and prepares to auto-compile '
        'an evidence package from all related records.',
        styles['TechBody']
    ))

    story.append(Paragraph('16.1 Auto-Compiled Evidence Package', styles['TechH2']))
    story.append(Paragraph(
        'When an admin clicks "Compile Evidence" on a dispute, the system queries all related tables — evidence_vault '
        '(for the project/client), payments, scope_of_works, deliveries, and audit_logs — and assembles them into a '
        'canonical JSON document. This document is hashed with SHA-256 and stored as the <code>evidence_package_hash</code> '
        'on the dispute record. The hash is tamper-evident: any change to the underlying records would produce a '
        'different hash on recompilation.',
        styles['TechBody']
    ))

    story.append(Paragraph('16.2 Dispute Resolution', styles['TechH2']))
    story.append(Paragraph(
        'Disputes can be resolved as <b>won</b> (chargeback reversed in TECH360\'s favor), <b>lost</b> (chargeback '
        'upheld), or <b>expired</b> (response window missed). The resolution is logged with the resolver, timestamp, '
        'and notes. The dispute record and its evidence package remain in the database permanently — they are never '
        'deleted, even after resolution — to support future compliance audits.',
        styles['TechBody']
    ))
    story.append(PageBreak())

    # ===== 17. CRYPTOGRAPHIC INTEGRITY =====
    story.append(Paragraph('17. Cryptographic Integrity System', styles['TechH1']))
    story.append(Paragraph(
        'TECH360 uses SHA-256 hashing to seal critical business records against tampering. The IntegrityRecord model '
        'captures a canonical JSON representation of an entity (contract, invoice, delivery, source release, scope, '
        'handover, or evidence) combined with a random salt, then hashes the combined string. The hash, salt, and '
        'canonical payload are stored permanently in the integrity_records table.',
        styles['TechBody']
    ))

    story.append(Paragraph('17.1 Sealing Process', styles['TechH2']))
    story.append(Paragraph(
        'When an entity is sealed (via <code>IntegrityRecord::seal()</code>), the system: (1) collects the entity\'s '
        'data into an associative array, (2) serializes it to canonical JSON with sorted keys and no slash escaping, '
        '(3) appends a 32-byte random salt, (4) computes SHA-256 of the combined string, (5) stores the hash, salt, '
        'and signed payload in the integrity_records table. The salt prevents rainbow-table attacks even if two '
        'identical entities exist.',
        styles['TechBody']
    ))

    story.append(Paragraph('17.2 Verification Process', styles['TechH2']))
    story.append(Paragraph(
        'To verify integrity (via <code>IntegrityRecord::verify()</code>), the system: (1) loads the latest '
        'integrity record for the entity, (2) re-serializes the current entity state to canonical JSON, (3) appends '
        'the stored salt, (4) recomputes the SHA-256, (5) compares it to the stored hash using <code>hash_equals()</code> '
        'for constant-time comparison. If they match, returns "verified". If they differ, the record is marked '
        '"tampered" with a timestamp and note, and returns "tampered".',
        styles['TechBody']
    ))
    story.append(PageBreak())

    # ===== 18. COMMUNICATION =====
    story.append(Paragraph('18. Communication & Client ID System', styles['TechH1']))
    story.append(Paragraph(
        'TECH360 follows a WhatsApp-first contact flow. When a lead contacts the company via WhatsApp, the system '
        'creates a CommunicationChannel record with primary_channel=whatsapp and the lead\'s WhatsApp number. The '
        'system then automatically requests the lead\'s email address — without an email, the lead cannot be converted '
        'to a full client account. Once the email is collected and verified, the system generates a unique '
        'TECH-CL-XXXXXX client identifier and assigns a Business Development (BD) Manager.',
        styles['TechBody']
    ))

    story.append(Paragraph('18.1 Client ID Format', styles['TechH2']))
    story.append(Paragraph(
        'Client identifiers follow the format <code>TECH-CL-XXXXXX</code> where XXXXXX is a zero-padded sequential '
        'number starting at 000001. Identifiers are generated only after email verification — leads who have not '
        'verified their email remain in pre-client status. Once assigned, the identifier is permanent and cannot be '
        'reused even if the client is later soft-deleted.',
        styles['TechBody']
    ))

    story.append(Paragraph('18.2 BD Manager Assignment', styles['TechH2']))
    story.append(Paragraph(
        'Every CommunicationChannel has an optional <code>bd_manager_id</code> field linking to a User record. BD '
        'Managers are staff or admin users responsible for nurturing the lead through the sales pipeline. Assignment '
        'can be manual (admin assigns via UI) or automatic (round-robin distribution to available managers). The '
        'assigned manager appears on the CRM dashboard and receives notifications of new activities on their leads.',
        styles['TechBody']
    ))
    story.append(PageBreak())

    # ===== 19. NO-DELETE POLICY =====
    story.append(Paragraph('19. No-Delete Policy Enforcement', styles['TechH1']))
    story.append(Paragraph(
        'TECH360 enforces a strict no-delete policy on all financial, contractual, and communication evidence. '
        'Employees — including admins — cannot permanently destroy these records. The policy is enforced at three '
        'layers: database (SoftDeletes trait on all financial/evidence models), model (overridden delete() method '
        'that force-routes to soft-delete when permanent_delete_blocked=true), and audit (every soft-delete action '
        'is logged with the actor, reason, and timestamp).',
        styles['TechBody']
    ))

    story.append(Paragraph('19.1 Affected Tables', styles['TechH2']))
    no_delete = [
        ['Table', 'SoftDeletes', 'permanent_delete_blocked'],
        ['payouts', 'YES', 'YES (always)'],
        ['evidence_vault', 'YES', 'YES (always)'],
        ['disputes', 'YES', 'YES (always)'],
        ['communication_channels', 'YES', 'Recommended'],
        ['audit_logs', 'NO (append-only)', 'YES (always)'],
        ['payments', 'NO', 'Modify only — never delete'],
        ['scope_of_works', 'NO', 'Modify only — versioned'],
        ['scope_approvals', 'NO (immutable)', 'YES (always)'],
        ['invoices', 'NO', 'Modify only — sealed'],
        ['deliveries', 'NO', 'Modify only — sealed'],
        ['refund_requests', 'NO', 'Modify only — sealed'],
        ['integrity_records', 'NO (append-only)', 'YES (always)'],
    ]
    story.append(section_table(no_delete, col_widths=[CONTENT_W * 0.35, CONTENT_W * 0.25, CONTENT_W * 0.4]))
    story.append(Spacer(1, 12))

    story.append(Paragraph('19.2 Soft-Delete Workflow', styles['TechH2']))
    story.append(Paragraph(
        'When an admin clicks "Soft-Delete" on an evidence vault item, they must provide a reason. The system sets '
        'the <code>deleted_at</code> timestamp (Laravel SoftDeletes trait) but preserves the row in the database. '
        'The file on disk is preserved. The hash is preserved. The audit log records the action '
        '<code>evidence_soft_deleted</code> with the admin ID, IP address, reason, and timestamp. The record can be '
        'restored later if needed via <code>EvidenceVault::withTrashed()->find($id)->restore()</code>.',
        styles['TechBody']
    ))
    story.append(PageBreak())

    # ===== 20. SECURITY =====
    story.append(Paragraph('20. Security Operations (CSRF, HMAC, Rate Limiting)', styles['TechH1']))
    story.append(Paragraph(
        'TECH360 implements defense-in-depth security with multiple overlapping controls. No single control is relied '
        'upon exclusively — if one fails, others compensate. The security posture is reviewed quarterly and after any '
        'incident.',
        styles['TechBody']
    ))

    story.append(Paragraph('20.1 Security Control Inventory', styles['TechH2']))
    sec = [
        ['Control', 'Implementation', 'Verification'],
        ['CSRF Protection', '@csrf on every form + validateCsrfTokens except webhooks', 'PHPUnit test'],
        ['HMAC Webhook Auth', 'hash_equals(hash_hmac(sha256, payload, secret))', 'PHPUnit test'],
        ['Rate Limiting', 'throttle middleware on login/register/contact/webhooks/AI command', 'PHPUnit test (429)'],
        ['Session Encryption', 'SESSION_ENCRYPT=true env var', 'Config check'],
        ['Secure Cookies', 'SESSION_SECURE_COOKIE=true (requires HTTPS)', 'Browser DevTools'],
        ['SameSite Cookies', 'samesite=lax in session config', 'Browser DevTools'],
        ['Password Hashing', 'bcrypt (Laravel default)', 'Database inspection'],
        ['Mass Assignment Protection', '$fillable on every model', 'Code review'],
        ['SQL Injection Protection', 'Eloquent parameterized queries only — no raw SQL', 'Code review'],
        ['XSS Protection', 'Blade {{ }} auto-escaping + Content-Security-Policy header', 'Browser DevTools'],
        ['Security Headers', '.htaccess: X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, HSTS, Referrer-Policy', 'curl -I'],
        ['Sensitive File Blocking', '.htaccess blocks .env, composer.*, artisan, phpunit.xml, *.md', 'curl /env test'],
        ['File Upload Validation', 'Extension + MIME + size + safe filename + private storage', 'PHPUnit test'],
        ['Signed URLs', 'Source-code download uses signed URLs with TTL', 'Controller inspection'],
        ['RBAC', 'AdminMiddleware server-side on every protected route', 'PHPUnit test (403)'],
    ]
    story.append(section_table(sec, col_widths=[CONTENT_W * 0.3, CONTENT_W * 0.5, CONTENT_W * 0.2]))
    story.append(PageBreak())

    # ===== 21. CMS =====
    story.append(Paragraph('21. CMS (Content Management) Operations', styles['TechH1']))
    story.append(Paragraph(
        'The CMS module allows authorized staff to manage website content without developer intervention. Six '
        'sub-modules exist: Services (the service catalog), Portfolio (project showcase), Blog (article publishing), '
        'Testimonials (client quotes), Settings (application configuration), and Form Submissions (contact form '
        'inbox). All CMS data is consumed by the public website in real-time — there is no separate publishing step.',
        styles['TechBody']
    ))
    story.append(Paragraph(
        'Each CMS entity supports slug-based URL routing (e.g., <code>/services/website-development</code>), '
        'is_active flag for draft/published state, SEO metadata fields (seo_title, seo_description), and image '
        'fields. Blog posts have a published_at timestamp and only appear on the public blog listing when status '
        'is "published" AND published_at is in the past.',
        styles['TechBody']
    ))
    story.append(PageBreak())

    # ===== 22. AUDIT LOGGING =====
    story.append(Paragraph('22. Audit Logging Policy', styles['TechH1']))
    story.append(Paragraph(
        'Every sensitive action in TECH360 is permanently recorded in the audit_logs table. Audit entries are '
        'append-only — they can never be modified or deleted. Each entry captures: timestamp, action name, actor '
        'type (admin, client, system, ai_agent), actor ID, client ID (if applicable), project ID (if applicable), '
        'payment ID (if applicable), scope ID (if applicable), structured details as JSON, IP address, and user agent.',
        styles['TechBody']
    ))

    story.append(Paragraph('22.1 Audited Actions', styles['TechH2']))
    audited = [
        ['Category', 'Actions Logged'],
        ['Authentication', 'login_success, login_failed, logout, password_reset'],
        ['Payment', 'payment_initiated, payment_verified, payment_webhook_received'],
        ['Refund', 'refund_requested, refund_approved, refund_denied, refund_processed'],
        ['Scope', 'scope_created, scope_versioned, scope_approved, scope_change_requested'],
        ['Delivery', 'delivery_created, delivery_qa_passed, delivery_confirmed, handover_released'],
        ['Source Code', 'source_download_attempted, source_download_blocked, source_download_authorized'],
        ['Payout', 'payout_created, payout_approved, payout_processed, payout_failed'],
        ['Evidence', 'evidence_uploaded, evidence_downloaded, evidence_soft_deleted, evidence_verified'],
        ['Dispute', 'dispute_opened, dispute_evidence_compiled, dispute_resolved_won, dispute_resolved_lost'],
        ['AI', 'ai_agent_created, ai_execution_started, ai_execution_completed, ai_execution_failed, ai_approval_required, ai_approval_approved, ai_approval_rejected'],
        ['CMS', 'cms_service_created, cms_blog_published, cms_portfolio_updated'],
        ['System', 'settings_updated, user_role_changed, source_release_signed'],
    ]
    story.append(section_table(audited, col_widths=[CONTENT_W * 0.2, CONTENT_W * 0.8]))
    story.append(PageBreak())

    # ===== 23. BACKUP =====
    story.append(Paragraph('23. Backup & Disaster Recovery', styles['TechH1']))
    story.append(Paragraph(
        'TECH360 follows a 3-2-1 backup strategy: 3 copies of data, on 2 different media, with 1 copy offsite. The '
        'primary backup mechanism is cPanel\'s built-in Backup Wizard, configured to run daily at 02:00 server time. '
        'Backups include the entire home directory, all MySQL databases, and email forwarders.',
        styles['TechBody']
    ))

    story.append(Paragraph('23.1 Backup Schedule', styles['TechH2']))
    backup_sched = [
        ['Frequency', 'Target', 'Retention'],
        ['Daily at 02:00', 'cPanel Backup Wizard → /backups/', '14 days'],
        ['Weekly on Sunday 01:00', 'cPanel Backup Wizard → offsite FTP', '8 weeks'],
        ['Monthly on 1st at 00:00', 'Manual download → AWS S3 bucket', '12 months'],
        ['On-demand', 'php artisan db:backup (spatie/backup)', 'As needed'],
    ]
    story.append(section_table(backup_sched, col_widths=[CONTENT_W * 0.3, CONTENT_W * 0.45, CONTENT_W * 0.25]))
    story.append(Spacer(1, 12))

    story.append(Paragraph('23.2 Disaster Recovery Procedures', styles['TechH2']))
    story.append(Paragraph(
        '<b>Database failure:</b> Restore from most recent cPanel backup. Estimated recovery time: 30 minutes. '
        'Data loss: up to 24 hours (since last daily backup). For mission-critical operations, consider setting up '
        'MySQL replication to a standby server.',
        styles['TechBody']
    ))
    story.append(Paragraph(
        '<b>File system failure:</b> Restore home directory from cPanel backup. The vendor/ directory is included '
        'in the production ZIP, so even a complete filesystem loss can be recovered by re-uploading the ZIP and '
        'running <code>php artisan migrate --force</code>.',
        styles['TechBody']
    ))
    story.append(Paragraph(
        '<b>Compromised admin account:</b> Immediately reset the compromised password via phpMyAdmin or '
        '<code>php artisan tinker</code>. Review audit logs for actions taken by the compromised account. Rotate '
        'SESSION_ENCRYPT key (invalidates all sessions). Revoke any AI agent tokens. Notify all other admins.',
        styles['TechBody']
    ))
    story.append(PageBreak())

    # ===== 24. CPANEL DEPLOYMENT =====
    story.append(Paragraph('24. cPanel Deployment Runbook', styles['TechH1']))
    story.append(Paragraph(
        'This runbook documents the complete deployment process for TECH360 on a standard cPanel host. The entire '
        'process takes approximately 30–45 minutes for a first-time deployment and 10–15 minutes for an update.',
        styles['TechBody']
    ))

    story.append(Paragraph('24.1 Pre-Deployment Checklist', styles['TechH2']))
    story.append(Paragraph(
        'Before deploying, verify the following: (1) cPanel hosting account with PHP 8.2+ available, (2) MySQL 8.0+ '
        'or MariaDB 10.4+ database access, (3) SSL certificate installed (Let\'s Encrypt via cPanel is fine), (4) SSH '
        'or cPanel Terminal access recommended for running migrations, (5) DNS for the target domain pointing to the '
        'cPanel server, (6) Production ZIP file <code>tech360-laravel-cpanel-production-final.zip</code> downloaded.',
        styles['TechBody']
    ))

    story.append(Paragraph('24.2 Deployment Steps', styles['TechH2']))
    deploy = [
        ['Step', 'Action', 'Verification'],
        ['1', 'Upload ZIP via cPanel File Manager', 'ZIP appears in file list'],
        ['2', 'Extract ZIP to domain directory', 'tech360-laravel/ folder created'],
        ['3', 'Copy .env.example to .env', '.env file exists'],
        ['4', 'Edit .env with production values (DB, MAIL, AI keys)', 'All required vars set'],
        ['5', 'Create MySQL DB & user via cPanel Wizard', 'DB shows in phpMyAdmin'],
        ['6', 'Set document root to /tech360-laravel/public', 'Domain serves Laravel'],
        ['7', 'Set PHP version to 8.2+ via MultiPHP Manager', 'php -v shows 8.2+'],
        ['8', 'Run migrations: php artisan migrate --force', '43 tables created'],
        ['9', 'Run seeders: php artisan db:seed --force', '11 AI agents + 8 tools seeded'],
        ['10', 'Generate APP_KEY: php artisan key:generate', 'APP_KEY set in .env'],
        ['11', 'Create storage link: php artisan storage:link', 'storage/ symlink exists'],
        ['12', 'Set permissions: chmod -R 775 storage bootstrap/cache', 'Laravel can write logs'],
        ['13', 'Cache: php artisan config:cache && route:cache && view:cache', 'Caches optimized'],
        ['14', 'Configure cron job (see Section 25)', 'Schedule runs every minute'],
        ['15', 'Test homepage, login, CRM, AI dashboard', 'All return 200'],
    ]
    story.append(section_table(deploy, col_widths=[0.4 * inch, CONTENT_W * 0.55, CONTENT_W * 0.45 - 0.4*inch]))
    story.append(PageBreak())

    # ===== 25. CRON =====
    story.append(Paragraph('25. Cron Job & Scheduler Configuration', styles['TechH1']))
    story.append(Paragraph(
        'Laravel\'s task scheduler requires a single cron entry running every minute. The scheduler then dispatches '
        'any scheduled tasks defined in <code>routes/console.php</code> or registered via '
        '<code>->schedule()</code> calls. cPanel does not run the scheduler automatically — the cron entry must be '
        'added manually via cPanel → Cron Jobs.',
        styles['TechBody']
    ))

    story.append(Paragraph('25.1 Cron Job Configuration', styles['TechH2']))
    story.append(Paragraph(
        '<b>Minute:</b> * (every minute)<br/>'
        '<b>Hour:</b> * (every hour)<br/>'
        '<b>Day:</b> * (every day)<br/>'
        '<b>Month:</b> * (every month)<br/>'
        '<b>Weekday:</b> * (every weekday)<br/>'
        '<b>Command:</b><br/>'
        '<code>/usr/local/bin/php /home/USERNAME/tech360-laravel/artisan schedule:run &gt;&gt; /dev/null 2&gt;&amp;1</code>',
        styles['TechBody']
    ))
    story.append(Paragraph(
        'Replace <code>/usr/local/bin/php</code> with the actual PHP binary path on your cPanel server if different '
        '(check via cPanel → MultiPHP Manager → "PHP Path" or via SSH <code>which php</code>). Replace '
        '<code>USERNAME</code> with your cPanel username.',
        styles['TechNote']
    ))

    story.append(Paragraph('25.2 Optional Queue Worker Cron', styles['TechH2']))
    story.append(Paragraph(
        'By default, TECH360 uses <code>QUEUE_CONNECTION=sync</code> (jobs run inline). If you switch to '
        '<code>QUEUE_CONNECTION=database</code> for background processing, add a second cron job to process the queue:',
        styles['TechBody']
    ))
    story.append(Paragraph(
        '<code>* * * * * /usr/local/bin/php /home/USERNAME/tech360-laravel/artisan queue:work --stop-when-empty &gt;&gt; /dev/null 2&gt;&amp;1</code>',
        styles['TechBody']
    ))
    story.append(PageBreak())

    # ===== 26. MAINTENANCE =====
    story.append(Paragraph('26. Maintenance & Monitoring', styles['TechH1']))
    story.append(Paragraph(
        'Routine maintenance ensures the platform remains healthy and performant. The following tasks should be '
        'performed on the schedule indicated. All maintenance windows should be scheduled during low-traffic hours '
        '(02:00–05:00 server time).',
        styles['TechBody']
    ))
    maint = [
        ['Task', 'Frequency', 'Command / Action'],
        ['Clear expired sessions', 'Daily', 'Automatic via scheduler'],
        ['Clear old cache entries', 'Daily', 'Automatic via scheduler'],
        ['Rotate log files', 'Weekly', 'Laravel daily log handler configured'],
        ['Database optimization', 'Monthly', 'php artisan db:optimize (mysqlcheck)'],
        ['Backup verification', 'Weekly', 'Restore 1 random backup to staging'],
        ['Security update check', 'Weekly', 'composer audit (run on dev copy)'],
        ['SSL certificate renewal', 'Auto', 'Let\'s Encrypt auto-renewal'],
        ['Storage cleanup', 'Monthly', 'Delete orphaned temp files in storage/'],
        ['Audit log review', 'Weekly', 'Admin reviews /admin/audit-logs for anomalies'],
        ['AI agent health check', 'Weekly', 'Test each agent with a known prompt'],
    ]
    story.append(section_table(maint, col_widths=[CONTENT_W * 0.3, CONTENT_W * 0.2, CONTENT_W * 0.5]))
    story.append(PageBreak())

    # ===== 27. INCIDENT RESPONSE =====
    story.append(Paragraph('27. Incident Response Playbook', styles['TechH1']))
    story.append(Paragraph(
        'When a security incident or operational disruption occurs, follow this playbook. The goal is to contain the '
        'incident, eradicate the cause, recover service, and document lessons learned. Every incident — regardless of '
        'severity — must be documented in the audit log and reviewed in a post-mortem within 72 hours.',
        styles['TechBody']
    ))

    story.append(Paragraph('27.1 Severity Levels', styles['TechH2']))
    sev = [
        ['Severity', 'Definition', 'Response Time'],
        ['P0 Critical', 'Production down, data loss, security breach', 'Immediate (24/7)'],
        ['P1 High', 'Major feature broken, payment system down', '1 hour'],
        ['P2 Medium', 'Feature degraded, performance issue', '4 hours'],
        ['P3 Low', 'Cosmetic issue, minor bug', 'Next business day'],
    ]
    story.append(section_table(sev, col_widths=[CONTENT_W * 0.2, CONTENT_W * 0.55, CONTENT_W * 0.25]))
    story.append(Spacer(1, 12))

    story.append(Paragraph('27.2 Response Procedure', styles['TechH2']))
    story.append(Paragraph(
        '<b>1. Identify</b> — Confirm the incident is real. Check logs, monitor alerts, reproduce the issue if '
        'possible. <b>2. Contain</b> — If a security breach, immediately disable affected accounts, rotate API keys, '
        'and if necessary, take the application offline (set APP_MAINTENANCE=true). <b>3. Eradicate</b> — Remove the '
        'root cause: patch the vulnerability, block the offending IP, restore from backup if data was corrupted. '
        '<b>4. Recover</b> — Restore service, verify with end-to-end tests, monitor closely for 24 hours. '
        '<b>5. Document</b> — Write a post-mortem within 72 hours covering: timeline, root cause, impact, actions '
        'taken, lessons learned, preventive measures.',
        styles['TechBody']
    ))
    story.append(PageBreak())

    # ===== 28. TESTING =====
    story.append(Paragraph('28. Testing & Quality Assurance', styles['TechH1']))
    story.append(Paragraph(
        'TECH360 ships with a comprehensive PHPUnit test suite covering 68 test cases across 7 test files. Tests use '
        'the RefreshDatabase trait and an in-memory SQLite database for speed and isolation. The test suite is '
        'organized into: PublicRoutesTest (18 cases verifying every public route returns 200), AuthenticationTest '
        '(6 cases covering registration, login, logout, invalid credentials, rate limiting), AuthorizationTest (11 '
        'cases verifying RBAC enforcement), CrmTest (9 cases for CRUD operations on CRM entities), '
        'CommercialWorkflowTest (6 cases covering payment verification, scope approval, audit logs, source-code '
        'blocking), AiAgentTest (14 cases for AI agent execution, approvals, command routing), and '
        'WebhookSecurityTest (4 cases for HMAC validation, idempotency, replay protection).',
        styles['TechBody']
    ))

    story.append(Paragraph('28.1 Running Tests', styles['TechH2']))
    story.append(Paragraph(
        'Tests are run via Composer scripts:<br/>'
        '<code>composer install --dev</code> (installs PHPUnit)<br/>'
        '<code>composer test</code> (runs <code>php artisan test</code>)<br/>'
        '<code>./vendor/bin/phpunit --testsuite=Feature</code> (feature tests only)<br/>'
        '<code>./vendor/bin/phpunit --testsuite=Unit</code> (unit tests only)<br/>'
        '<code>./vendor/bin/phpunit --coverage-html coverage</code> (with coverage report)',
        styles['TechBody']
    ))
    story.append(PageBreak())

    # ===== 29. COMPLIANCE =====
    story.append(Paragraph('29. Compliance & Legal Reference', styles['TechH1']))
    story.append(Paragraph(
        'TECH360 operates under a strict legal framework documented in four public-facing policies: Terms & Conditions, '
        'Refund Policy, Privacy Policy, and Cookie Policy. All policies are versioned with an Effective Date and any '
        'changes require client notification for active engagements. The current effective date for Terms and Refund '
        'Policy is May 19, 2026.',
        styles['TechBody']
    ))
    story.append(Paragraph(
        '<b>Refund Policy Summary:</b> After Scope of Work approval, project payments are non-refundable except where '
        'required by applicable law or otherwise agreed in writing. This policy is enforced operationally through the '
        'mandatory admin review step in the refund workflow — refunds are never auto-approved.',
        styles['TechWarn']
    ))

    story.append(Paragraph('29.1 Company Information', styles['TechH2']))
    company = [
        ['Field', 'Value'],
        ['Legal Name', 'TECH360 LLC'],
        ['Headquarters', '117 S Lexington St, Ste 100, Harrisonville, MO 64701'],
        ['Email', 'support@tech360.io'],
        ['Phone', '+1 (800) 360-0199'],
        ['Website', 'https://tech360.io'],
        ['Slogan', 'Connect • Innovate • Grow'],
        ['Terms Effective Date', 'May 19, 2026'],
        ['Refund Policy Effective Date', 'May 19, 2026'],
    ]
    story.append(section_table(company, col_widths=[CONTENT_W * 0.35, CONTENT_W * 0.65]))
    story.append(PageBreak())

    # ===== 30. GLOSSARY =====
    story.append(Paragraph('30. Glossary & Reference', styles['TechH1']))
    glossary = [
        ['Term', 'Definition'],
        ['BD Manager', 'Business Development Manager — staff member assigned to nurture a lead through the sales pipeline.'],
        ['Client ID', 'Unique TECH-CL-XXXXXX identifier assigned after email verification.'],
        ['Commercial State', 'The lifecycle stage of a project (INITIAL_INQUIRY, SCOPE_SENT, SCOPE_APPROVED, PAYMENT_PENDING, PAYMENT_PAID, DEVELOPMENT, FINAL_REVIEW, FINAL_HANDOVER, PROJECT_CLOSED).'],
        ['Evidence Vault', 'Centralized immutable repository for all evidentiary records, with SHA-256 hashing and no-delete policy.'],
        ['Gate', 'One of five authorization checks that must pass before source-code release.'],
        ['HMAC', 'Hash-based Message Authentication Code — used to verify webhook authenticity.'],
        ['Idempotency', 'Property where repeated calls produce the same result — used to prevent duplicate payment processing.'],
        ['Integrity Record', 'SHA-256 hash + salt seal on a business entity to detect tampering.'],
        ['Mode (AI)', 'Execution mode for an AI agent: manual, approval (default), or autonomous.'],
        ['No-Delete Policy', 'Operational rule that financial/communication evidence cannot be permanently destroyed.'],
        ['Payout', 'Disbursement from TECH360 to a developer, vendor, contractor, or partner.'],
        ['RBAC', 'Role-Based Access Control — server-side enforcement of user role permissions.'],
        ['Risk Score', '0–100 numeric score for payouts, computed from amount and client history.'],
        ['Scope of Work', 'Formal document defining project deliverables, milestones, and pricing.'],
        ['Soft-Delete', 'Setting deleted_at timestamp without removing the database row — preserves data, hides from listings.'],
        ['Source Code Protection', '5-gate authorization that prevents source-code download before all gates pass.'],
        ['TECH-CL-XXXXXX', 'Client identifier format.'],
        ['TECH-CON-XXXXXX', 'Contact identifier format.'],
        ['Webhook', 'HTTP POST callback from a payment gateway or AI provider to TECH360.'],
    ]
    story.append(section_table(glossary, col_widths=[CONTENT_W * 0.25, CONTENT_W * 0.75]))

    return story


def main():
    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)

    doc = SimpleDocTemplate(
        OUTPUT_PATH,
        pagesize=letter,
        leftMargin=MARGIN, rightMargin=MARGIN,
        topMargin=0.75 * inch, bottomMargin=0.75 * inch,
        title='TECH360 LLC — Operational Book',
        author='TECH360 LLC',
        subject='Production Operations Manual',
        creator='TECH360 Production System',
    )

    # Use Frame + PageTemplate for cover page (no header/footer)
    frame = Frame(MARGIN, MARGIN, CONTENT_W, PAGE_H - 2 * MARGIN, id='normal')
    cover_template = PageTemplate(id='Cover', frames=[frame], onPage=cover_page)
    body_template = PageTemplate(id='Body', frames=[frame], onPage=header_footer)
    doc.addPageTemplates([cover_template, body_template])

    story = build_story(make_styles())

    # Switch to body template after the cover
    story.insert(1, NextPageTemplate('Body'))

    doc.build(story)
    print(f'✅ Generated: {OUTPUT_PATH}')
    print(f'   Size: {os.path.getsize(OUTPUT_PATH) / 1024:.1f} KB')


if __name__ == '__main__':
    main()
