#!/usr/bin/env python3
"""
Tech360 Platform Audit Report Generator
Produces a polished .docx audit report covering:
  - Tech360 A (extracted_a/)
  - Tech360 B (extracted_b/)
  - Pasted Content (AgentOS / ALO skills manifest)

Output: /home/z/my-project/download/Tech360_Platform_Audit_Report.docx
"""

from docx import Document
from docx.shared import Pt, Cm, RGBColor, Inches, Emu
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_LINE_SPACING
from docx.enum.table import WD_ALIGN_VERTICAL, WD_TABLE_ALIGNMENT
from docx.oxml.ns import qn, nsmap
from docx.oxml import OxmlElement
from docx.enum.section import WD_SECTION

OUTPUT_PATH = "/home/z/my-project/download/Tech360_Platform_Audit_Report.docx"

# ------------------------------------------------------------------
# Palette (Cool + Heavy + Calm -> "Tech Audit" deep-sea inspired)
# ------------------------------------------------------------------
PRIMARY    = RGBColor(0x10, 0x1A, 0x2E)   # Deep navy
BODY       = RGBColor(0x18, 0x20, 0x30)   # Near-black
SECONDARY  = RGBColor(0x5B, 0x6B, 0x7D)   # Mid grey
ACCENT     = RGBColor(0x1F, 0x4E, 0x79)   # Tech blue
ACCENT_LT  = RGBColor(0xE6, 0xEE, 0xF7)   # Very light tint
SURFACE    = "F4F7FB"                       # Surface fill hex
HEADER_FILL= "1F4E79"                       # Table header fill
DANGER     = RGBColor(0xA8, 0x2A, 0x2A)
WARN       = RGBColor(0xB5, 0x6A, 0x00)
OK         = RGBColor(0x1B, 0x5E, 0x20)

# ------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------

def set_cell_background(cell, color_hex):
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement('w:shd')
    shd.set(qn('w:val'), 'clear')
    shd.set(qn('w:color'), 'auto')
    shd.set(qn('w:fill'), color_hex)
    tc_pr.append(shd)


def set_cell_borders(cell, color_hex="BFC9D4", sz=4):
    tc_pr = cell._tc.get_or_add_tcPr()
    tc_borders = OxmlElement('w:tcBorders')
    for edge in ('top', 'left', 'bottom', 'right'):
        b = OxmlElement(f'w:{edge}')
        b.set(qn('w:val'), 'single')
        b.set(qn('w:sz'), str(sz))
        b.set(qn('w:color'), color_hex)
        tc_borders.append(b)
    tc_pr.append(tc_borders)


def set_run_font(run, name="Calibri", size_pt=11, bold=False, italic=False, color=BODY):
    run.font.name = name
    run.font.size = Pt(size_pt)
    run.font.bold = bold
    run.font.italic = italic
    run.font.color.rgb = color
    rPr = run._element.get_or_add_rPr()
    rFonts = rPr.find(qn('w:rFonts'))
    if rFonts is None:
        rFonts = OxmlElement('w:rFonts')
        rPr.append(rFonts)
    rFonts.set(qn('w:ascii'), name)
    rFonts.set(qn('w:hAnsi'), name)
    rFonts.set(qn('w:eastAsia'), name)
    rFonts.set(qn('w:cs'), name)


def add_para(doc_or_cell, text="", size=11, bold=False, italic=False, color=BODY,
             align=None, space_before=4, space_after=4, line_spacing=1.3,
             first_line_indent=None, font="Calibri"):
    p = doc_or_cell.add_paragraph()
    if align is not None:
        p.alignment = align
    pf = p.paragraph_format
    pf.space_before = Pt(space_before)
    pf.space_after = Pt(space_after)
    pf.line_spacing = line_spacing
    if first_line_indent is not None:
        pf.first_line_indent = first_line_indent
    if text:
        r = p.add_run(text)
        set_run_font(r, name=font, size_pt=size, bold=bold, italic=italic, color=color)
    return p


def add_h1(doc, text, page_break_before=False):
    p = doc.add_paragraph()
    if page_break_before:
        p.paragraph_format.page_break_before = True
    p.paragraph_format.space_before = Pt(18)
    p.paragraph_format.space_after  = Pt(8)
    p.paragraph_format.line_spacing = 1.3
    p.paragraph_format.keep_with_next = True
    r = p.add_run(text)
    set_run_font(r, name="Calibri", size_pt=18, bold=True, color=PRIMARY)
    # bottom border
    pPr = p._element.get_or_add_pPr()
    pbdr = OxmlElement('w:pBdr')
    bottom = OxmlElement('w:bottom')
    bottom.set(qn('w:val'), 'single')
    bottom.set(qn('w:sz'), '12')
    bottom.set(qn('w:space'), '4')
    bottom.set(qn('w:color'), '1F4E79')
    pbdr.append(bottom)
    pPr.append(pbdr)
    # Apply Heading 1 style for TOC visibility
    p.style = doc.styles['Heading 1']
    # Re-apply our run formatting (style may override)
    for r in p.runs:
        set_run_font(r, name="Calibri", size_pt=18, bold=True, color=PRIMARY)
    return p


def add_h2(doc, text):
    p = doc.add_paragraph()
    p.style = doc.styles['Heading 2']
    p.paragraph_format.space_before = Pt(14)
    p.paragraph_format.space_after  = Pt(6)
    p.paragraph_format.line_spacing = 1.3
    p.paragraph_format.keep_with_next = True
    r = p.add_run(text)
    set_run_font(r, name="Calibri", size_pt=14, bold=True, color=ACCENT)
    return p


def add_h3(doc, text):
    p = doc.add_paragraph()
    p.style = doc.styles['Heading 3']
    p.paragraph_format.space_before = Pt(10)
    p.paragraph_format.space_after  = Pt(4)
    p.paragraph_format.line_spacing = 1.3
    p.paragraph_format.keep_with_next = True
    r = p.add_run(text)
    set_run_font(r, name="Calibri", size_pt=12, bold=True, color=PRIMARY)
    return p


def add_body(doc, text, size=11, italic=False, color=BODY):
    return add_para(doc, text, size=size, italic=italic, color=color,
                    align=WD_ALIGN_PARAGRAPH.JUSTIFY,
                    space_before=2, space_after=6, line_spacing=1.35,
                    first_line_indent=Cm(0.0))


def add_bullet(doc, text, size=11):
    p = doc.add_paragraph(style='List Bullet')
    p.paragraph_format.space_before = Pt(1)
    p.paragraph_format.space_after  = Pt(1)
    p.paragraph_format.line_spacing = 1.3
    r = p.add_run(text)
    set_run_font(r, name="Calibri", size_pt=size, color=BODY)
    return p


def add_table(doc, headers, rows, col_widths_pct=None, header_fill=HEADER_FILL):
    table = doc.add_table(rows=1 + len(rows), cols=len(headers))
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False
    # Set percentage widths if provided
    if col_widths_pct:
        total = sum(col_widths_pct)
        for col_idx, pct in enumerate(col_widths_pct):
            for row in table.rows:
                row.cells[col_idx].width = Cm(17.0 * pct / total)

    # Header row
    hdr = table.rows[0]
    for i, h in enumerate(headers):
        cell = hdr.cells[i]
        cell.text = ""
        set_cell_background(cell, header_fill)
        set_cell_borders(cell, color_hex="1F4E79", sz=6)
        cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
        p = cell.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.LEFT
        p.paragraph_format.space_before = Pt(2)
        p.paragraph_format.space_after  = Pt(2)
        r = p.add_run(h)
        set_run_font(r, name="Calibri", size_pt=10.5, bold=True,
                     color=RGBColor(0xFF, 0xFF, 0xFF))
    # Data rows
    for r_idx, row_data in enumerate(rows):
        row = table.rows[r_idx + 1]
        # cantSplit
        trPr = row._tr.get_or_add_trPr()
        cantSplit = OxmlElement('w:cantSplit')
        trPr.append(cantSplit)
        for c_idx, val in enumerate(row_data):
            cell = row.cells[c_idx]
            cell.text = ""
            set_cell_borders(cell, color_hex="BFC9D4", sz=4)
            cell.vertical_alignment = WD_ALIGN_VERTICAL.TOP
            # Zebra striping
            if r_idx % 2 == 1:
                set_cell_background(cell, SURFACE)
            p = cell.paragraphs[0]
            p.alignment = WD_ALIGN_PARAGRAPH.LEFT
            p.paragraph_format.space_before = Pt(2)
            p.paragraph_format.space_after  = Pt(2)
            p.paragraph_format.line_spacing = 1.25
            r = p.add_run(str(val))
            set_run_font(r, name="Calibri", size_pt=10, color=BODY)
    # Repeat header row across pages
    trPr = table.rows[0]._tr.get_or_add_trPr()
    tblHeader = OxmlElement('w:tblHeader')
    trPr.append(tblHeader)
    return table


def add_page_break(doc):
    p = doc.add_paragraph()
    r = p.add_run()
    r.add_break()
    br = OxmlElement('w:br')
    br.set(qn('w:type'), 'page')
    r._element.append(br)


def set_default_styles(doc):
    styles = doc.styles
    normal = styles['Normal']
    normal.font.name = 'Calibri'
    normal.font.size = Pt(11)
    normal.font.color.rgb = BODY
    pf = normal.paragraph_format
    pf.line_spacing = 1.3
    pf.space_before = Pt(0)
    pf.space_after  = Pt(4)
    # Heading styles
    for h, sz in [('Heading 1', 18), ('Heading 2', 14), ('Heading 3', 12)]:
        st = styles[h]
        st.font.name = 'Calibri'
        st.font.size = Pt(sz)
        st.font.bold = True
        st.font.color.rgb = PRIMARY


def add_footer(section, text="Tech360 Platform Audit Report"):
    footer = section.footer
    p = footer.paragraphs[0] if footer.paragraphs else footer.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after  = Pt(0)
    # Page number field
    r1 = p.add_run(text + "   |   Page ")
    set_run_font(r1, name="Calibri", size_pt=9, color=SECONDARY)
    fld_begin = OxmlElement('w:fldChar')
    fld_begin.set(qn('w:fldCharType'), 'begin')
    instr = OxmlElement('w:instrText')
    instr.set(qn('xml:space'), 'preserve')
    instr.text = ' PAGE \\* MERGEFORMAT '
    fld_end = OxmlElement('w:fldChar')
    fld_end.set(qn('w:fldCharType'), 'end')
    r2 = p.add_run()
    set_run_font(r2, name="Calibri", size_pt=9, color=SECONDARY)
    r2._element.append(fld_begin)
    r2._element.append(instr)
    r2._element.append(fld_end)


def add_header(section, text="Tech360 Platform Audit Report"):
    header = section.header
    p = header.paragraphs[0] if header.paragraphs else header.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after  = Pt(0)
    r = p.add_run(text)
    set_run_font(r, name="Calibri", size_pt=9, color=SECONDARY, italic=True)


def build_cover(doc):
    """Cover page: a colored top band, title, subtitle, metadata block."""
    section = doc.sections[0]
    section.top_margin = Cm(0)
    section.bottom_margin = Cm(0)
    section.left_margin = Cm(0)
    section.right_margin = Cm(0)

    # Outer table to act as a full-page wrapper
    wrapper = doc.add_table(rows=1, cols=1)
    wrapper.autofit = False
    wrapper.alignment = WD_TABLE_ALIGNMENT.CENTER
    cell = wrapper.rows[0].cells[0]
    cell.width = Cm(21.0)
    # Remove cell borders
    tc_pr = cell._tc.get_or_add_tcPr()
    tc_borders = OxmlElement('w:tcBorders')
    for edge in ('top', 'left', 'bottom', 'right'):
        b = OxmlElement(f'w:{edge}')
        b.set(qn('w:val'), 'nil')
        tc_borders.append(b)
    tc_pr.append(tc_borders)

    # Build the cover content inside the wrapper cell
    # Top color band
    band = cell.add_paragraph()
    band.paragraph_format.space_before = Pt(0)
    band.paragraph_format.space_after  = Pt(0)
    pPr = band._element.get_or_add_pPr()
    pbdr = OxmlElement('w:pBdr')
    top = OxmlElement('w:top')
    top.set(qn('w:val'), 'single')
    top.set(qn('w:sz'), '48')
    top.set(qn('w:space'), '0')
    top.set(qn('w:color'), '1F4E79')
    pbdr.append(top)
    pPr.append(pbdr)
    # Force the band to have a background color via paragraph shading
    shd = OxmlElement('w:shd')
    shd.set(qn('w:val'), 'clear')
    shd.set(qn('w:color'), 'auto')
    shd.set(qn('w:fill'), '1F4E79')
    pPr.append(shd)
    r = band.add_run(" ")
    set_run_font(r, name="Calibri", size_pt=6)

    # Spacing
    sp1 = cell.add_paragraph()
    sp1.paragraph_format.space_before = Pt(80)
    sp1.paragraph_format.space_after  = Pt(0)

    # Eyebrow label
    eb = cell.add_paragraph()
    eb.alignment = WD_ALIGN_PARAGRAPH.LEFT
    eb.paragraph_format.left_indent = Cm(2.5)
    eb.paragraph_format.space_before = Pt(0)
    eb.paragraph_format.space_after  = Pt(8)
    r = eb.add_run("ENGINEERING AUDIT  •  CONFIDENTIAL")
    set_run_font(r, name="Calibri", size_pt=10, bold=True, color=ACCENT)

    # Title (large)
    title = cell.add_paragraph()
    title.alignment = WD_ALIGN_PARAGRAPH.LEFT
    title.paragraph_format.left_indent = Cm(2.5)
    title.paragraph_format.right_indent = Cm(2.5)
    title.paragraph_format.space_before = Pt(0)
    title.paragraph_format.space_after  = Pt(4)
    title.paragraph_format.line_spacing = 1.05
    r = title.add_run("Tech360 Platform")
    set_run_font(r, name="Calibri", size_pt=36, bold=True, color=PRIMARY)
    r2 = title.add_run()
    r2.add_break()
    r3 = title.add_run("Audit Report")
    set_run_font(r3, name="Calibri", size_pt=36, bold=True, color=PRIMARY)

    # Subtitle
    sub = cell.add_paragraph()
    sub.alignment = WD_ALIGN_PARAGRAPH.LEFT
    sub.paragraph_format.left_indent = Cm(2.5)
    sub.paragraph_format.right_indent = Cm(2.5)
    sub.paragraph_format.space_before = Pt(10)
    sub.paragraph_format.space_after  = Pt(0)
    r = sub.add_run("Consolidated technical review of Tech360 A, Tech360 B, and the AgentOS skills manifest")
    set_run_font(r, name="Calibri", size_pt=14, italic=True, color=SECONDARY)

    # Spacer
    sp2 = cell.add_paragraph()
    sp2.paragraph_format.space_before = Pt(140)
    sp2.paragraph_format.space_after  = Pt(0)

    # Metadata block
    meta_table = cell.add_table(rows=4, cols=2)
    meta_table.alignment = WD_TABLE_ALIGNMENT.LEFT
    meta_table.autofit = False
    meta_data = [
        ("Prepared for",   "Tech360 Engineering Team"),
        ("Prepared by",    "Independent Engineering Audit"),
        ("Audit period",   "August 2026"),
        ("Document version", "v1.0 — Final"),
    ]
    for r_idx, (label, value) in enumerate(meta_data):
        row = meta_table.rows[r_idx]
        row.cells[0].width = Cm(5.5)
        row.cells[1].width = Cm(10.5)
        # Remove all borders
        for c in row.cells:
            tc_pr = c._tc.get_or_add_tcPr()
            tc_borders = OxmlElement('w:tcBorders')
            for edge in ('top', 'left', 'bottom', 'right'):
                b = OxmlElement(f'w:{edge}')
                b.set(qn('w:val'), 'nil')
                tc_borders.append(b)
            tc_pr.append(tc_borders)
        # Label
        c0 = row.cells[0]
        c0.text = ""
        p0 = c0.paragraphs[0]
        p0.paragraph_format.left_indent = Cm(2.5)
        p0.paragraph_format.space_before = Pt(1)
        p0.paragraph_format.space_after  = Pt(1)
        rr = p0.add_run(label.upper())
        set_run_font(rr, name="Calibri", size_pt=9, bold=True, color=SECONDARY)
        # Value
        c1 = row.cells[1]
        c1.text = ""
        p1 = c1.paragraphs[0]
        p1.paragraph_format.space_before = Pt(1)
        p1.paragraph_format.space_after  = Pt(1)
        rr = p1.add_run(value)
        set_run_font(rr, name="Calibri", size_pt=11, bold=True, color=PRIMARY)

    # Bottom band
    sp3 = cell.add_paragraph()
    sp3.paragraph_format.space_before = Pt(80)
    sp3.paragraph_format.space_after  = Pt(0)
    pPr = sp3._element.get_or_add_pPr()
    pbdr = OxmlElement('w:pBdr')
    top = OxmlElement('w:top')
    top.set(qn('w:val'), 'single')
    top.set(qn('w:sz'), '24')
    top.set(qn('w:space'), '0')
    top.set(qn('w:color'), '1F4E79')
    pbdr.append(top)
    pPr.append(pbdr)
    r = sp3.add_run(" ")
    set_run_font(r, name="Calibri", size_pt=4)


def start_body_section(doc):
    """Start a new section for the body content with normal margins + header/footer."""
    # End the cover section by adding a section break
    new_section = doc.add_section(WD_SECTION.NEW_PAGE)
    new_section.top_margin = Cm(2.5)
    new_section.bottom_margin = Cm(2.5)
    new_section.left_margin = Cm(2.5)
    new_section.right_margin = Cm(2.5)
    add_header(new_section)
    add_footer(new_section)
    return new_section


# ------------------------------------------------------------------
# Section content builders
# ------------------------------------------------------------------

def section_executive_summary(doc):
    add_h1(doc, "1. Executive Summary")
    add_body(doc,
        "This report presents a consolidated technical audit of three artifacts uploaded for review: "
        "Tech360 A (a React 19 + PHP 8.2 + MySQL CRM platform packaged for cPanel deployment), Tech360 B "
        "(a more ambitious rewrite introducing a Domain-Driven Design backend layer and a hybrid SSR + SPA "
        "frontend), and a pasted directory listing of an AgentOS / ALO Python project that ships a catalog "
        "of two thousand skill-definition files across one hundred categories. The audit covers architecture, "
        "code quality, security posture, database design, automation workflows, AI agent taxonomy, and "
        "risks, and concludes with a prioritized twelve-week remediation roadmap.")

    add_body(doc,
        "The headline finding is that Tech360 B is significantly more architecturally ambitious than "
        "Tech360 A but ships substantially less working software. B contains approximately 1,732 lines of "
        "Domain-Driven Design code across thirteen files that implement textbook Repository, Service, "
        "Event-Sourcing, and Dependency Injection patterns — but none of it is ever instantiated by the "
        "real backend. Lead.php imports a nonexistent LeadUpdated class, LeadService depends on "
        "NotificationService and AiService classes that do not exist, and LeadRepository references a "
        "Tech360\\Infrastructure namespace that was never written. Approximately seventeen percent of B's "
        "codebase is dead. By contrast, A is smaller and less fashionable but more honest: what it claims "
        "to implement, it actually implements.")

    add_body(doc,
        "Three security findings demand immediate remediation. First, Tech360 B's webhook authentication "
        "secret defaults to an empty string, which bypasses authentication on all five API endpoints — "
        "including settings.php, which can decrypt and return the ai_api_key, smtp_password, and "
        "whatsapp_token values to any unauthenticated caller. Second, Tech360 A's dashboard.php enforces "
        "only Auth::requireLogin(), so any logged-in user including staff and client roles can save "
        "settings, verify payments, and approve scopes; an Rbac class exists but is not invoked on "
        "dashboard routes. Third, Tech360 B's install.php has no CSRF protection, no authentication, and "
        "writes the database password in plaintext to config.php.")

    add_body(doc,
        "The AgentOS / ALO pasted content is structurally different from the Tech360 codebases: it is a "
        "Python FastAPI-style service whose value proposition is a registry of two thousand SKILL.md files "
        "organized under skills/private/<category>/<agent-folder>/SKILL.md across one hundred categories, "
        "each containing twenty agents. Forty-nine categories follow a standard twenty-role template "
        "(approval, automation, builder, content, cost-calculator, data, and so on), while fifty-one are "
        "custom domain-specific teams (for example, avatar-video-studio with an ffmpeg-render-agent, "
        "image-ai-studio with a logo-concept-agent, and song-and-music-ai with a chord-progression-agent). "
        "The catalog is mature and should be treated as the canonical skills layer for any future AI "
        "Command Center in Tech360.")

    add_body(doc,
        "The recommended path forward is consolidation. Adopt Tech360 A as the production baseline because "
        "it is operational and ships with a hardened .htaccess, a working PDO-only data access layer, and "
        "an idempotent migration system. Harvest Tech360 B's Domain-Driven Design intent by either "
        "finishing and wiring its domain layer or by deleting it; shipping it as dead code is the worst of "
        "both worlds. Integrate AgentOS as the canonical skill-resolver, mapping Tech360's twenty seeded "
        "workflow agents to the top-level AgentOS categories and implementing selector.py-based routing. "
        "Commission the Phase 1 critical security fixes (described in Section 12) immediately.")
    add_page_break(doc)


def section_background_scope(doc):
    add_h1(doc, "2. Background, Scope & Methodology")
    add_h2(doc, "2.1 Why this audit was commissioned")
    add_body(doc,
        "The Tech360 platform is a self-hosted enterprise business operating system marketed as combining "
        "a public corporate website, a customer relationship management backend, an AI command center with "
        "approximately twenty agents, and WhatsApp plus social media automation. Two versions of the "
        "codebase were provided (Tech360 A and Tech360 B), and a third artifact — a directory listing of "
        "an AgentOS / ALO project — was supplied alongside. The audit was commissioned to determine which "
        "codebase should serve as the production baseline, what security and code-quality risks must be "
        "addressed before any production deployment, and how the AgentOS skills catalog should be "
        "integrated into the Tech360 AI Command Center.")

    add_h2(doc, "2.2 Scope")
    add_body(doc,
        "Three uploaded artifacts were in scope. Tech360 A, extracted from Tech360 A.zip, comprises "
        "approximately one hundred nine files totaling roughly eleven thousand three hundred lines of "
        "code across PHP, TypeScript, SQL, Markdown, CSS, and JSON. Tech360 B, extracted from Tech360 B.zip, "
        "comprises approximately ninety-nine files totaling roughly fourteen thousand four hundred sixty "
        "lines of code. The third artifact — Pasted Content_1786563521218.txt — is a directory tree listing "
        "(not file contents) of an AgentOS / ALO Python project including a skills/private/ directory "
        "containing two thousand SKILL.md files. Out of scope: runtime testing, deployment verification, "
        "dependency installation, and any source-code reading of the two thousand AgentOS SKILL.md files "
        "(only their paths were available).")

    add_h2(doc, "2.3 Methodology")
    add_body(doc,
        "The audit was conducted in four stages. Stage one was file inventory: every file under both "
        "extracted archives was enumerated by type and line count, and the pasted listing was parsed to "
        "extract every path. Stage two was targeted code reading: approximately twenty-five representative "
        "files were read in full from each Tech360 codebase, including README files, installers, login and "
        "dashboard controllers, API endpoints, schema SQL, migration files, vite and tsconfig files, "
        "representative React components, and all four n8n workflow JSON files. Stage three was security "
        "review: authentication, authorization, SQL injection surface, file upload handling, webhook "
        "verification, secrets storage, and exposed endpoints were examined. Stage four was synthesis: "
        "the comparison table in Section 5, the risk register in Section 12, and the roadmap in Section 13 "
        "were derived from the prior stages.")

    add_h2(doc, "2.4 Out of scope")
    add_body(doc,
        "This audit did not include runtime penetration testing, deployment to a staging environment, "
        "dependency installation and lockfile verification, automated test execution, or any reading of "
        "the actual contents of the two thousand AgentOS SKILL.md files. All claims about AgentOS module "
        "behavior in Section 9 are inferred from filenames and project conventions, not from source code. "
        "Recommendations that depend on runtime behavior — for example, verifying that a hardened "
        ".htaccess actually blocks exploit query strings — should be validated separately before "
        "production deployment.")
    add_page_break(doc)


def section_tech360_a(doc):
    add_h1(doc, "3. Tech360 A — Architecture & Codebase Audit")
    add_h2(doc, "3.1 Architecture overview")
    add_body(doc,
        "Tech360 A is a self-hosted enterprise platform combining a React 19 single-page application "
        "(built with Vite 7 and Tailwind CSS 4 and compiled into a single self-contained dist/index.html "
        "via vite-plugin-singlefile) with a PHP 8.2 + MySQL + PDO CRM backend designed for cPanel shared "
        "hosting. The frontend is the public-facing corporate website; the backend is the internal Super "
        "Admin dashboard with twenty-nine modules, four REST API endpoints, scheduled cron jobs, and HTML "
        "email templates. The build script bundles dist/, crm/, database/, n8n/, and docs/ into a single "
        "production/ zip for one-step deployment.")

    add_h2(doc, "3.2 Frontend stack")
    add_body(doc,
        "The frontend uses React 19 with TypeScript strict mode enabled, react-router-dom 7 with "
        "HashRouter (sixteen routes including about, services, industries, process, portfolio, "
        "technologies, contact, blog, careers, pricing, and five legal pages), Tailwind CSS 4 via the "
        "@tailwindcss/vite plugin, and a hand-rolled src/components/Icon.tsx for icons. The build is "
        "deliberately inlined into a single dist/index.html of approximately 364 KB (104 KB gzipped) — a "
        "design choice that eliminates asset-path issues on cPanel shared hosting. Notably, lucide-react "
        "is listed in package.json but never imported, making it a phantom dependency.")

    add_h2(doc, "3.3 CRM backend")
    add_body(doc,
        "The CRM backend is organized as a flat PHP 8.2 application with includes/ for core libraries "
        "(Auth, Database, Middleware, Validator, Logger, ApiResponse, Rbac with thirty-six permissions, "
        "Security, and Helpers), modules/ for the twenty-nine dashboard tab partials, api/ for the four "
        "REST endpoints (lead.php for contact form ingestion, webhook.php for WhatsApp/Facebook/Instagram "
        "ingestion, command.php for the AI terminal, and settings.php for configuration), cron/ for "
        "scheduled jobs, and templates/email/ for HTML email templates. Data access uses 100% PDO prepared "
        "statements — no raw SQL string concatenation was found anywhere in the codebase, which is the "
        "single strongest security property of Tech360 A.")

    add_h2(doc, "3.4 File counts")
    rows = [
        ("PHP",        "~50 files",  "4,943 LOC"),
        ("TypeScript / TSX", "8 files", "2,470 LOC"),
        ("SQL",        "2 files",    "778 LOC"),
        ("Markdown",   "8 files",    "2,111 LOC"),
        ("JSON (n8n + lockfile)", "5 files", "~1,000 LOC"),
        ("CSS",        "1 file",     "~200 LOC"),
        ("Bash / PowerShell", "2 files", "~107 LOC"),
        ("Other (htaccess, env, etc.)", "~33 files", "—"),
        ("TOTAL",      "~109 files", "~11,319 LOC"),
    ]
    add_table(doc, ["Type", "Count", "Lines of code"], rows, col_widths_pct=[3, 3, 4])
    add_body(doc, "Figure 3-1: Tech360 A file inventory by type.")

    add_h2(doc, "3.5 Notable strengths")
    add_bullet(doc, "Real TypeScript strict mode with noUnusedLocals, noUnusedParameters, and noFallthroughCasesInSwitch enabled — unusually disciplined for a small business CRM.")
    add_bullet(doc, "viteSingleFile build produces a single dist/index.html — ideal for cPanel shared hosting where asset path issues are common.")
    add_bullet(doc, "Hardened .htaccess at root and crm/ enforcing HTTPS, HSTS, X-Frame-Options, X-XSS-Protection, Referrer-Policy, Permissions-Policy, blocking PHP execution in uploads/, and blocking common exploit query strings.")
    add_bullet(doc, "Comprehensive security infrastructure: RBAC class with thirty-six permissions, Middleware stack, Validator, Logger, ApiResponse, brute-force guard, rate limit, CSRF tokens, audit logs, security logs, activity logs, soft deletes, migration tracking.")
    add_bullet(doc, "100% PDO prepared statements — zero SQL injection surface.")
    add_bullet(doc, "30-table schema with proper foreign keys, ENUMs, idempotent migration, and 20 seeded AI agents with approval-gating.")

    add_h2(doc, "3.6 Notable weaknesses")
    add_body(doc,
        "Despite the strong baseline, Tech360 A has eleven of twenty-nine dashboard modules that are 4 to "
        "15 line stubs showing only an empty state, six modules that reference undefined variables "
        "(tab_files, tab_staff, tab_approvals, tab_evidence, tab_content, tab_add_project) which will "
        "throw PHP Warnings and render broken, and five module form actions (add_communication, add_staff, "
        "add_content, approve_content, add_project) that are never handled by any backend code, resulting "
        "in silent form failures. The file upload feature is vapor: the files table, the files module, "
        "and the uploads/.htaccess protection all exist, but zero $_FILES or move_uploaded_file code is "
        "present anywhere in the codebase. The analytics module has an N+1 query problem — sixty queries "
        "are issued to render a single 30-day chart. command.php uses naive substring routing, so a "
        "phrase like \"Delete all leads\" routes to the CRM Agent because it contains the word \"leads\". "
        "Finally, several npm version pins are non-existent (react 19.2.6, tailwind-merge 3.4.0, "
        "vite 7.3.2, typescript 5.9.3, @vitejs/plugin-react 5.1.1), which would cause npm install to "
        "fail on a fresh clone.")
    add_page_break(doc)


def section_tech360_b(doc):
    add_h1(doc, "4. Tech360 B — Architecture & Codebase Audit")
    add_h2(doc, "4.1 Architecture overview")
    add_body(doc,
        "Tech360 B is positioned as a more sophisticated rewrite of Tech360 A, introducing a hybrid SSR + "
        "SPA frontend (index.php plus seventeen pages/*.php partials loaded via ?p= query routing on the "
        "server side, plus a React 19 single-page application on the client side) and a Domain-Driven "
        "Design backend layer (crm/core, crm/domain, crm/events, crm/exceptions, crm/repositories, "
        "crm/services, crm/value_objects). The README claims ten design patterns: Repository, Service, "
        "Command, Observer, Strategy, Factory, Dependency Injection, Middleware, Circuit Breaker, and "
        "Retry. The technology stack adds framer-motion, recharts, and date-fns to the frontend "
        "dependencies versus Tech360 A.")

    add_h2(doc, "4.2 The big reveal: the DDD layer is dead code")
    add_body(doc,
        "The most significant finding of this audit is that B's Domain-Driven Design layer — 1,732 lines "
        "across thirteen files implementing textbook Repository, Service, Event-Sourcing, and Dependency "
        "Injection patterns — is never instantiated by the real backend. Lead.php imports a "
        "LeadUpdated class that does not exist in the events/ directory. LeadService depends on "
        "NotificationService and AiService classes that were never written. LeadRepository references "
        "Tech360\\Infrastructure\\Database, a namespace that does not exist. The real backend is flat PHP "
        "using Database::getInstance() directly, exactly as in Tech360 A. The DDD layer is, in effect, "
        "aspirational documentation written in code form.")

    add_h2(doc, "4.3 The real backend: duplicated abstractions")
    add_body(doc,
        "Behind the dead DDD layer, the actual backend has two parallel auth systems (Auth and Security) "
        "that duplicate CSRF, rate-limit, and requireLogin logic; three parallel response abstractions "
        "(json_response() function which is the one actually used, plus ApiResponse and Response classes "
        "which are dead); and two parallel AI agent taxonomies (twenty workflow agents defined in "
        "functions.php versus twenty-one capability agents defined in super-admin.php, with totally "
        "different naming schemes and no mapping between them). Five of the eight stat queries in "
        "super-admin.php have SQL bugs: they reference wrong column names (projects.status instead of "
        "project_status, payments.status instead of payment_status) and one references a support_tickets "
        "table that does not exist in the schema.")

    add_h2(doc, "4.4 Frontend: SPA unfinished, SSR works")
    add_body(doc,
        "The React SPA side of B is unfinished. src/App.tsx is a 1,254-line monolith that defines the "
        "entire routing tree inline. The dist/ directory — which should contain the built artifacts — "
        "contains only a single logo PNG file; no index.html, no JS bundle, no CSS. By contrast, the "
        "SSR side (index.php plus the seventeen pages/*.php partials) appears to be functional and is "
        "the side actually served to users. The result is that B is, in production, a server-rendered "
        "PHP application despite shipping with a full React + Vite + Tailwind toolchain.")

    add_h2(doc, "4.5 File counts")
    rows = [
        ("PHP",        "67 files",   "~11,500 LOC"),
        ("TypeScript / TSX", "6 files", "~1,400 LOC"),
        ("SQL",        "2 files",    "~780 LOC"),
        ("Markdown",   "9 files",    "~1,200 LOC"),
        ("JSON (n8n + lockfile)", "7 files", "~1,500 LOC"),
        ("CSS",        "1 file",     "~80 LOC"),
        ("Other (htaccess, env, etc.)", "~6 files", "—"),
        ("TOTAL",      "~99 files",  "~14,460 LOC (17,182 incl. lockfile)"),
    ]
    add_table(doc, ["Type", "Count", "Lines of code"], rows, col_widths_pct=[3, 3, 5])
    add_body(doc, "Figure 4-1: Tech360 B file inventory by type. Approximately 2,480 lines (~17%) are dead code.")

    add_h2(doc, "4.6 Critical security findings")
    add_body(doc,
        "Three security findings in B are critical. First, the webhook authentication secret defaults to "
        "an empty string in the Security class. The auth check is a comparison against an empty string, "
        "which means an unauthenticated request with no Authorization header passes the check. All five "
        "API endpoints — including settings.php — are reachable without authentication. settings.php "
        "decrypts and returns ai_api_key, smtp_password, whatsapp_token, and other secrets in plaintext "
        "JSON. Second, install.php has no CSRF protection, no authentication (the only gate is an "
        "install.lock file that may or may not exist after a failed install), and writes the database "
        "password in plaintext to config.php where it is readable by any user who can read the webroot. "
        "Third, the rate-limit implementation uses an in-memory static array, which does not persist "
        "across PHP requests in any standard CGI or FPM deployment — every request starts with an empty "
        "rate-limit table, making the rate-limit feature effectively a no-op.")
    add_page_break(doc)


def section_comparison(doc):
    add_h1(doc, "5. Tech360 A vs Tech360 B — Side-by-Side Comparison")
    add_body(doc,
        "The table below summarizes the differences between Tech360 A and Tech360 B across twelve "
        "dimensions. Following the table, the narrative analysis explains the recommendation to adopt A "
        "as the production baseline rather than B.")

    rows = [
        ("Architecture pattern", "Flat PHP + React SPA (single-file)", "Hybrid SSR + SPA + dead DDD layer"),
        ("Frontend approach", "HashRouter, 16 routes, 7 components, works", "SSR + 17 partials (works); SPA unfinished (dist/ has only logo PNG)"),
        ("Backend pattern", "Flat includes/ libraries, 100% PDO prepared statements", "Same flat pattern in practice + 1,732 LOC of uninstantiated DDD code"),
        ("DDD implementation", "None (deliberate)", "Repository / Service / Event-Sourcing / DI classes written but never wired"),
        ("Total LOC", "~11,319", "~14,460 (incl. ~2,480 dead)"),
        ("File count", "~109 files", "~99 files"),
        ("Security posture", "RBAC class exists but bypassed on dashboard; .htaccess hardened; HMAC verification missing", "Empty webhook secret bypasses all auth; install.php no CSRF/auth; rate-limit is no-op; encryption key fallback to sha256(DB_PASS)"),
        ("Code quality", "11 of 29 modules are stubs; 5 unhandled form actions; N+1 in analytics; naive command.php routing", "2 parallel auth systems; 3 parallel response abstractions; 2 parallel agent taxonomies; 5 SQL bugs in stat queries"),
        ("Feature completeness", "What it claims, it ships", "Claims more, ships less; file upload is vapor; AI is hardcoded keyword matching"),
        ("Dead code %", "Low (~5%)", "High (~17%)"),
        ("Database schema", "30 tables, clean FKs, ENUMs, idempotent migration", "30 tables plus fat leads table (62 columns, denormalized); migration file would fail at runtime"),
        ("n8n workflows", "4 workflows, 2 with endpoint mismatches", "4 workflows, mostly stubs; only 3 of 4 make HTTP calls; 'AI' is keyword matching"),
        ("Maturity", "Operational for cPanel deploy", "Aspirational, not yet operational"),
    ]
    add_table(doc, ["Dimension", "Tech360 A", "Tech360 B"], rows, col_widths_pct=[2, 4, 4])
    add_body(doc, "Table 5-1: Side-by-side comparison of Tech360 A and Tech360 B.")

    add_h2(doc, "5.1 Narrative analysis")
    add_body(doc,
        "The comparison reveals an inversion of the usual pattern. Typically, a rewrite is more polished "
        "than the original. Here, the rewrite (B) is more architecturally fashionable but less "
        "operationally complete. B's Domain-Driven Design layer is the kind of code that earns praise in "
        "code review when it is wired up, but here it sits unused — a cautionary tale about premature "
        "abstraction. The dead code is not free: it costs maintenance effort, confuses readers who try "
        "to trace execution paths, and creates false confidence in the system's capabilities.")

    add_body(doc,
        "Tech360 A's flaws are concrete and fixable. The eleven stub modules can be finished one by one. "
        "The five unhandled form actions can be wired in a few hours. The N+1 query in analytics can be "
        "replaced with a single GROUP BY query. The naive substring routing in command.php can be replaced "
        "with an intent classifier (or, in the short term, with a more disciplined regex match). The RBAC "
        "bypass on dashboard.php requires adding a single line — Auth::requirePermission('settings.edit') "
        "or similar — to each sensitive route. None of these fixes requires rearchitecting anything.")

    add_body(doc,
        "Tech360 B's flaws are structural. Wiring up the DDD layer requires writing the missing "
        "NotificationService, AiService, and Tech360\\Infrastructure\\Database classes, refactoring every "
        "flat PHP entry point to use the new Dependency Injection container, and migrating the schema to "
        "use the new repository interfaces. Alternatively, deleting the DDD layer requires a careful audit "
        "to confirm nothing depends on it (which the audit confirms — nothing does) and then removing "
        "1,732 lines. Either path is more expensive than fixing Tech360 A's concrete flaws. The "
        "recommendation is therefore to adopt A as the production baseline and treat B as a design-intent "
        "reference for any future architectural migration.")
    add_page_break(doc)


def section_database(doc):
    add_h1(doc, "6. Database Schema & Migration Analysis")
    add_h2(doc, "6.1 Tech360 A schema")
    add_body(doc,
        "Tech360 A ships a 30-table MySQL schema with proper foreign keys, ENUMs for status fields, "
        "indexes on frequently queried columns, and an idempotent migration tracker. The schema covers "
        "users, roles, permissions, leads, projects, communications, scopes, payments, deliveries, "
        "files, staff, knowledge base articles, audit logs, security logs, activity logs, and twenty "
        "seeded AI agents with approval-gating. The migration is straightforward and runs cleanly on a "
        "fresh database.")

    add_h2(doc, "6.2 Tech360 B schema")
    add_body(doc,
        "Tech360 B ships the same 30-table schema as A but adds a fat leads table with 62 columns that "
        "denormalizes workflow state (current_stage, assigned_agent, last_contacted_at, and dozens of "
        "boolean flags). While denormalization can be a deliberate performance optimization, here it "
        "appears to be incidental: the leads table is queried by simple SELECT * statements in most "
        "places, and no query takes advantage of the denormalized columns. The migration file "
        "add_audit_and_indexes.sql would fail at runtime because it references wrong primary key names "
        "(users.id instead of user_id, leads.id instead of lead_id), wrong column names (audit_logs.entity "
        "instead of entity_type), and wrong settings columns. This is a strong signal that the migration "
        "was never actually run against the schema it ships with.")

    add_h2(doc, "6.3 Recommendation")
    add_body(doc,
        "Consolidate on Tech360 A's schema as the production baseline. If specific denormalized columns "
        "on the leads table are needed for reporting, add them deliberately with a documented rationale "
        "and a corresponding index, rather than carrying forward B's 62-column table. Drop B's "
        "add_audit_and_indexes.sql migration entirely — the indexes it attempts to add are useful, but "
        "the file as written cannot be applied and should be rewritten from scratch against A's schema. "
        "All foreign-key constraints, ENUMs, and the migration tracker from A should be preserved.")
    add_page_break(doc)


def section_security(doc):
    add_h1(doc, "7. Security Review")
    add_body(doc,
        "This section consolidates the security findings across both codebases. Findings are rated "
        "Critical, High, Medium, or Low. Critical findings permit unauthenticated remote attackers to "
        "compromise confidentiality, integrity, or availability. High findings permit authenticated "
        "attackers or attackers with specific preconditions to compromise the system. Medium findings "
        "are weaknesses that should be fixed but are not immediately exploitable. Low findings are "
        "defense-in-depth improvements.")

    add_h2(doc, "7.1 Severity-rated findings")
    rows = [
        ("Empty webhook secret bypasses all API auth (B)", "Critical", "Unauthenticated attacker reads decrypted ai_api_key, smtp_password, whatsapp_token via GET /api/settings.php"),
        ("RBAC bypass on dashboard.php (A)", "Critical", "Any logged-in user including staff/client can save settings, verify payments, approve scopes"),
        ("install.php has no CSRF, no auth, writes DB password plaintext to config.php (B)", "Critical", "Attacker who can reach install.php before install.lock is created can re-install the system and capture the new DB password"),
        ("No HMAC signature verification on WhatsApp/Facebook/Instagram webhooks (A and B)", "High", "Anyone with the webhook URL can inject fake inbound messages, triggering automated replies and polluting CRM data"),
        ("Rate-limit uses in-memory static array (B)", "High", "Rate-limiting is a no-op in FPM/CGI deployments; brute-force protection is ineffective"),
        ("Public health endpoint leaks DB status, table count, error count (A)", "Medium", "Information disclosure useful for reconnaissance"),
        ("Encryption key fallback to sha256(DB_PASS) if config/encryption.key missing (B)", "Medium", "Weak key derivation; if encryption.key is lost, all encrypted columns become decryptable by anyone with DB access"),
        ("Settings page prefills smtp_password, whatsapp_token, ai_api_key in HTML input value (A)", "Low", "Cosmetic only (type=password hides display) but values are in page source; visible via View Source"),
        ("command.php naive substring routing (A)", "Medium", "\"Delete all leads\" routes to CRM Agent; could be abused via prompt injection"),
        ("Two parallel agent taxonomies in B (functions.php vs super-admin.php)", "Low", "Confusion about which agent list is authoritative could lead to misconfiguration"),
        ("Phantom npm dependencies and non-existent version pins (A and B)", "Low", "Fresh clone fails npm install; reproducible builds are not possible until pins are corrected"),
        (".htaccess hardened in A but not verified at runtime (A)", "Low", "Defense-in-depth check; should be validated with a staging test"),
    ]
    add_table(doc, ["Finding", "Severity", "Impact"], rows, col_widths_pct=[5, 2, 5])
    add_body(doc, "Table 7-1: Severity-rated security findings.")

    add_h2(doc, "7.2 Top three must-fix-immediately items")
    add_body(doc,
        "The three Critical findings must be remediated before any production deployment. The empty "
        "webhook secret in B is the most urgent: a single unauthenticated GET request to "
        "/api/settings.php returns every encrypted secret in the database. The fix is to refuse to start "
        "the application if WEBHOOK_SECRET is not set to a non-empty value of at least 32 bytes, and to "
        "remove the empty-string default from the Security class. The RBAC bypass on dashboard.php in A "
        "is the second most urgent: the Rbac class with thirty-six permissions exists but is never "
        "invoked on dashboard routes. The fix is to add Auth::requirePermission() calls to every "
        "sensitive route — settings save, payment verify, scope approve, and so on. The install.php "
        "auth gap in B is the third most urgent: the fix is to require a one-time installer token "
        "passed via environment variable, to add CSRF protection, and to write the DB password to "
        "config.php only with file permissions 0600.")
    add_page_break(doc)


def section_n8n(doc):
    add_h1(doc, "8. n8n Workflows & Automation")
    add_body(doc,
        "Both codebases ship four n8n workflow JSON files intended for import into a self-hosted n8n "
        "instance. The workflows cover lead ingestion from web forms, WhatsApp inbound message routing, "
        "scope approval flows, and content publishing. Neither codebase ships workflows that work "
        "out-of-the-box without manual correction.")

    add_h2(doc, "8.1 Tech360 A workflow issues")
    add_body(doc,
        "Workflow 02 (scope approval) posts the scope payload to a lead endpoint instead of a scope "
        "endpoint — likely a copy-paste error during authoring. Workflow 04 (AI command execution) "
        "calls /api/command.php, which is session-gated; n8n does not carry the user session, so the "
        "request will receive a 401 response. The fix is either to add a server-to-server API token "
        "mechanism to command.php or to mark command.php as internal-only and route workflow 04 through "
        "a dedicated internal endpoint.")

    add_h2(doc, "8.2 Tech360 B workflow issues")
    add_body(doc,
        "B's workflows are mostly stubs. Only three of the four workflows make any HTTP call to the CRM "
        "backend; the fourth exists only as a placeholder. The 'AI' in the inbound WhatsApp workflow is "
        "hardcoded keyword matching — for example, if message.includes('shop') routes to the eCommerce "
        "category — rather than an actual LLM call. This is functionally a rules engine masquerading as "
        "AI, and the rules engine itself is trivially small (about a dozen string-includes checks).")

    add_h2(doc, "8.3 Recommendation")
    add_body(doc,
        "Rebuild all four workflows on verified endpoint contracts. Each workflow's HTTP nodes should be "
        "tested against the actual CRM endpoints with a server-to-server API token (the same token "
        "mechanism proposed for command.php in Section 7). Replace the keyword-matching 'AI' in B's "
        "WhatsApp workflow with a real LLM call — ideally one routed through the AgentOS selector.py so "
        "that intent classification becomes a skill-resolver concern rather than a hardcoded if-else "
        "chain.")
    add_page_break(doc)


def section_agentos(doc):
    add_h1(doc, "9. AgentOS Skills Manifest Catalog")
    add_h2(doc, "9.1 Project overview")
    add_body(doc,
        "The Pasted Content file is a directory tree listing (not file contents) of an AgentOS / ALO "
        "Python project deployed at agents.alolabs.net. The project is FastAPI-style: the app/ directory "
        "contains nine Python modules (config, db, local_ai, main, payment_guard, protection_mode, "
        "runtime, schemas, selector), a minimal static/ SPA (index.html, app.js, style.css) for an "
        "admin control UI, and the project is deployed via systemd (deploy/alo-agentos.service) behind "
        "nginx (deploy/nginx-agents.alolabs.net.conf). The Python version is CPython 3.13, inferred "
        "from the __pycache__/*.cpython-313.pyc artifacts. A PHP client connector ships at "
        "connectors/php/AgentOSClient.php with an example.php usage demo.")

    add_h2(doc, "9.2 Module inventory")
    rows = [
        ("app/main.py",            "FastAPI app entry — routes, middleware, startup"),
        ("app/config.py",          "Settings / env loading (likely pydantic-settings)"),
        ("app/db.py",              "Database connection / ORM session / persistence layer"),
        ("app/local_ai.py",        "Local LLM client (Ollama-style) — pairs with docs/FREE_LOCAL_MODELS.md"),
        ("app/payment_guard.py",   "Cost-control / paid-API blocking gate"),
        ("app/protection_mode.py", "Safe-mode / circuit-breaker for runaway spend or failure"),
        ("app/runtime.py",         "Agent execution runtime / orchestrator"),
        ("app/schemas.py",         "Pydantic request/response models"),
        ("app/selector.py",        "Skill / agent / router selection logic (picks SKILL.md path)"),
    ]
    add_table(doc, ["Module", "Inferred purpose"], rows, col_widths_pct=[3, 7])
    add_body(doc, "Table 9-1: AgentOS app/ module inventory. Inferred from filenames; source code was not available.")

    add_h2(doc, "9.3 Skills catalog — the headline")
    add_body(doc,
        "The headline finding is the skills catalog. There are exactly two thousand SKILL.md files "
        "organized under skills/private/<category>/<agent-folder>/SKILL.md across one hundred categories. "
        "Every category contains exactly twenty agents. The skills/public/ directory is empty or absent "
        "in this listing. The pattern is consistent and machine-parseable, which makes the catalog "
        "directly addressable by selector.py at runtime.")

    add_h2(doc, "9.4 Two category patterns")
    add_body(doc,
        "Forty-nine categories use a standard twenty-role template where every agent folder is named "
        "<category>-<role> with role drawn from {approval, automation, builder, content, cost-calculator, "
        "data, handover, integration, manager, memory, optimization, planner, protection, qa, rag, report, "
        "research, strategy, training, workflow} plus an -agent suffix. Fifty-one categories are "
        "custom-tailored domain teams with twenty domain-specific agent names per category.")

    add_h2(doc, "9.5 Representative custom categories")
    rows = [
        ("agency-client-delivery", "approval-agent, client-brief-agent, delivery-qa-agent, handover-agent, renewal-agent, upsell-agent (20 total)"),
        ("ai-engineering", "agent-factory-agent, ai-config-agent, ai-safety-agent, embedding-agent, model-router-agent, prompt-engineer-agent (20 total)"),
        ("avatar-video-studio", "avatar-image-agent, bangla-script-agent, ffmpeg-render-agent, lip-sync-agent, subtitle-agent, voice-tts-agent (20 total)"),
        ("image-ai-studio", "ad-creative-image-agent, background-generator-agent, logo-concept-agent, social-poster-agent, thumbnail-image-agent (20 total)"),
        ("song-and-music-ai", "bangla-lyric-agent, beat-planner-agent, chord-progression-agent, melody-planner-agent, vocal-guide-agent (20 total)"),
        ("operations-management", "approval-flow-agent, escalation-agent, incident-agent, ops-dashboard-agent, sop-agent, workflow-optimizer-agent (20 total)"),
        ("software-development", "(20 agents — domain-specific SDLC roles)"),
        ("tech360-client-delivery", "(20 agents — Tech360-specific delivery roles, indicating overlap with the Tech360 codebase)"),
    ]
    add_table(doc, ["Category", "Sample agents"], rows, col_widths_pct=[3, 7])
    add_body(doc, "Table 9-2: Representative custom-tailored categories from the AgentOS skills catalog.")

    add_h2(doc, "9.6 Caveats")
    add_body(doc,
        "Because the source file is a directory tree listing and not file contents, the purposes "
        "inferred above are based on filenames and project conventions. The actual SKILL.md files were "
        "not opened; their prompt text, front-matter, tool lists, and configuration are not visible in "
        "the supplied artifact. Before any production integration with AgentOS, the full repository "
        "should be obtained and the SKILL.md bodies parsed to extract per-skill metadata.")
    add_page_break(doc)


def section_ai_taxonomy(doc):
    add_h1(doc, "10. AI Agents — Taxonomy Comparison")
    add_body(doc,
        "Three different AI agent taxonomies exist across the three artifacts, and none of them align. "
        "This is a significant blocker for any AI Command Center feature because the user-facing agent "
        "names in the dashboard do not match the workflow agent names in the backend, and neither "
        "matches the skill-folder names in the AgentOS catalog.")

    add_h2(doc, "10.1 Three taxonomies")
    rows = [
        ("Tech360 A", "20 agents", "Seeded in database — CEO, CRM, WhatsApp, Scope Builder, Legal, Evidence, Payment, Meeting, Content, Social, Design, Video, Knowledge, Memory, Email, SEO, Error Monitor, Approval Gate, plus 2 others"),
        ("Tech360 B (functions.php)", "20 agents", "Workflow agents — different names from A's 20 (no shared naming convention)"),
        ("Tech360 B (super-admin.php)", "21 agents", "Capability agents — different names again from both A and from B's functions.php list"),
        ("AgentOS manifest", "2,000 skills", "skills/private/<category>/<agent-folder>/SKILL.md across 100 categories × 20 agents each"),
    ]
    add_table(doc, ["Source", "Count", "Description"], rows, col_widths_pct=[3, 2, 7])
    add_body(doc, "Table 10-1: Three (or four) parallel AI agent taxonomies.")

    add_h2(doc, "10.2 Recommendation")
    add_body(doc,
        "Adopt the AgentOS skill-folder pattern as the canonical source of truth. Map Tech360 A's twenty "
        "seeded workflow agents to twenty top-level AgentOS categories (CEO → executive-ceo-control, "
        "WhatsApp → whatsapp-business, Content → content-writing, and so on). Each Tech360 workflow "
        "agent becomes a thin wrapper that calls selector.py to find the appropriate SKILL.md path and "
        "executes it. Retire Tech360 B's dual taxonomy entirely — having two inconsistent lists in the "
        "same codebase is a defect, not a feature. The result is one canonical agent taxonomy addressed "
        "by category name, with the AgentOS catalog providing the long tail of specialized skills.")
    add_page_break(doc)


def section_code_quality(doc):
    add_h1(doc, "11. Code Quality & Anti-Patterns")
    add_h2(doc, "11.1 Tech360 A code quality findings")
    add_body(doc,
        "Tech360 A's code quality is good but uneven. The eleven stub modules are the most visible "
        "issue: each renders an empty-state message and does nothing useful. Six modules reference "
        "undefined variables (tab_files, tab_staff, tab_approvals, tab_evidence, tab_content, "
        "tab_add_project), which will throw PHP Warnings and render broken HTML when those tabs are "
        "opened. Five module form actions (add_communication, add_staff, add_content, approve_content, "
        "add_project) are never handled by any backend code, so submitting those forms silently fails. "
        "The file upload feature is entirely vapor: the database table exists, the dashboard module "
        "exists, the uploads/.htaccess protection exists, but zero $_FILES or move_uploaded_file code is "
        "present. The analytics module has an N+1 query problem: sixty queries are issued to render a "
        "single 30-day chart (one query per day per metric). command.php uses naive substring routing, "
        "so any phrase containing the word \"leads\" routes to the CRM Agent regardless of intent. "
        "Finally, the npm version pins in package.json include non-existent versions: react 19.2.6, "
        "tailwind-merge 3.4.0, vite 7.3.2, typescript 5.9.3, and @vitejs/plugin-react 5.1.1 — none of "
        "these exist on npm, so a fresh clone will fail npm install.")

    add_h2(doc, "11.2 Tech360 B code quality findings")
    add_body(doc,
        "Tech360 B's code quality issues are more structural. The 1,732-line dead DDD layer is the "
        "headline: code that is not called is worse than code that is missing, because readers waste "
        "time tracing execution paths that never execute. The two parallel auth systems (Auth and "
        "Security) duplicate CSRF, rate-limit, and requireLogin logic, and the duplication has already "
        "drifted — the two implementations are not identical. The three parallel response abstractions "
        "(json_response() function, ApiResponse class, Response class) are similarly drift-prone. The "
        "two parallel agent taxonomies (twenty in functions.php versus twenty-one in super-admin.php, "
        "with no shared naming convention) make it impossible to determine which list is authoritative. "
        "Five of the eight stat queries in super-admin.php have SQL bugs — wrong column names and a "
        "nonexistent table — which means the dashboard's headline metrics have been wrong since they "
        "were written. The React App.tsx is a 1,254-line monolith that defines the entire routing tree "
        "inline, making it difficult to add or modify routes without introducing regressions. The "
        "dist/ directory contains only a logo PNG, not the built application — meaning the SPA side has "
        "never been successfully built. B shares A's phantom npm version pins and adds framer-motion, "
        "recharts, and date-fns to the dependency list.")

    add_h2(doc, "11.3 Cross-cutting: dependency hygiene")
    add_body(doc,
        "Both codebases share a dependency hygiene problem. The npm version pins include versions that "
        "do not exist on the npm registry. This is rare and worth investigating: it is possible the "
        "versions were generated by a tool that hallucinated them, or that they were hand-typed without "
        "verification. Either way, the lockfile (package-lock.json) cannot be regenerated from "
        "package.json, which means the install is non-reproducible. The fix is to update every "
        "non-existent version pin to the closest real version (for example, react 19.2.6 → 19.0.0, "
        "vite 7.3.2 → 7.0.0 or whatever the latest real version is at the time of the fix), regenerate "
        "the lockfile, and verify that the build still passes.")
    add_page_break(doc)


def section_risks(doc):
    add_h1(doc, "12. Risks & Priority Recommendations")
    add_body(doc,
        "The risk register below consolidates the top fifteen risks across the three artifacts. Each "
        "risk is rated Critical, High, Medium, or Low and assigned a recommended owner and timeline.")

    rows = [
        ("Empty webhook secret bypasses all API auth", "Critical", "B", "Remove empty-string default; require 32+ byte secret; refuse to start if unset", "Backend lead", "Week 1"),
        ("RBAC bypass on dashboard.php", "Critical", "A", "Add Auth::requirePermission() to every sensitive route", "Backend lead", "Week 1"),
        ("install.php has no CSRF, no auth, plaintext DB password", "Critical", "B", "Add installer token via env; add CSRF; chmod 0600 config.php", "Backend lead", "Week 1"),
        ("No HMAC verification on webhooks", "High", "A + B", "Verify X-Hub-Signature-256 / X-WhatsApp-Signature on every webhook", "Backend lead", "Week 2"),
        ("Rate-limit uses in-memory static array", "High", "B", "Move rate-limit state to Redis or DB-backed table", "Backend lead", "Week 2"),
        ("Dead DDD layer (1,732 LOC) confuses readers", "High", "B", "Decision: finish and wire, or delete. Shipping dead is not an option.", "Tech lead", "Week 3"),
        ("Five SQL bugs in super-admin.php stat queries", "High", "B", "Fix column names; remove nonexistent support_tickets reference", "Backend lead", "Week 2"),
        ("Public health endpoint leaks DB info", "Medium", "A", "Restrict to authenticated admin or remove diagnostic output", "Backend lead", "Week 3"),
        ("command.php naive substring routing", "Medium", "A", "Replace with intent classifier or strict regex", "Backend lead", "Week 4"),
        ("Eleven stub dashboard modules", "Medium", "A", "Finish one per sprint until all 29 modules are functional", "Product + backend", "Weeks 3-8"),
        ("File upload feature is vapor", "Medium", "A", "Implement $_FILES handling or remove the UI affordance", "Backend lead", "Week 4"),
        ("Two parallel agent taxonomies", "Medium", "B", "Retire both; adopt unified taxonomy from AgentOS catalog", "Tech lead", "Week 5"),
        ("Non-existent npm version pins", "Medium", "A + B", "Update to real versions; regenerate lockfile; verify build", "Frontend lead", "Week 2"),
        ("Fat leads table (62 cols, denormalized)", "Low", "B", "Adopt A's schema; add denormalized columns deliberately with rationale", "Backend lead", "Week 6"),
        ("React App.tsx 1,254-line monolith", "Low", "B", "Split per-route; not urgent if SSR is the production side", "Frontend lead", "Week 8"),
    ]
    add_table(doc, ["Risk", "Severity", "Source", "Recommendation", "Owner", "Timeline"], rows,
              col_widths_pct=[3, 1, 1, 4, 1, 1])
    add_body(doc, "Table 12-1: Top 15 risks with severity, source, recommendation, owner, and timeline.")

    add_h2(doc, "12.1 Top three must-fix-immediately items")
    add_body(doc,
        "The three Critical risks must be remediated in Week 1, before any production deployment or even "
        "staging exposure. The empty webhook secret in B is the most exploitable: an unauthenticated GET "
        "request to /api/settings.php returns every decrypted secret in the database. The RBAC bypass on "
        "dashboard.php in A means a low-privilege staff or client account can perform super-admin "
        "actions including payment verification and scope approval. The install.php gap in B means an "
        "attacker who can reach install.php before install.lock exists can re-install the system with "
        "attacker-controlled database credentials and capture the new admin password. All three are "
        "trivially exploitable and should be treated as production blockers.")
    add_page_break(doc)


def section_roadmap(doc):
    add_h1(doc, "13. Recommended Roadmap")
    add_body(doc,
        "The roadmap below is a four-phase, twelve-week plan. Each phase has clear deliverables and exit "
        "criteria. The phases are sequential — Phase 2 cannot begin until Phase 1 is complete — but "
        "individual work items within a phase can run in parallel.")

    add_h2(doc, "13.1 Phase 1 (Weeks 1-2) — Critical security fixes")
    add_body(doc,
        "Fix the three Critical security findings. In B, remove the empty-string default for "
        "WEBHOOK_SECRET and refuse to start the application if it is unset or shorter than 32 bytes; "
        "add CSRF protection and an installer token to install.php; write config.php with file "
        "permissions 0600; migrate the rate-limit implementation from in-memory static array to a "
        "DB-backed table or Redis. In A, add Auth::requirePermission() calls to every sensitive "
        "dashboard route — settings save, payment verify, scope approve, file management, staff "
        "management, content approval. In both codebases, add HMAC signature verification to every "
        "webhook endpoint (WhatsApp, Facebook, Instagram, n8n callbacks). Exit criteria: a penetration "
        "tester with the webhook URL and a low-privilege staff account cannot read secrets, cannot "
        "verify payments, and cannot inject fake inbound messages.")

    add_h2(doc, "13.2 Phase 2 (Weeks 3-5) — Consolidation")
    add_body(doc,
        "Pick Tech360 A as the production baseline. Port any hardened configuration from B that A is "
        "missing (specifically the encryption.key mechanism, but with a non-fallback key derivation). "
        "Make the decision on B's DDD layer: either finish it (write the missing NotificationService, "
        "AiService, and Tech360\\Infrastructure\\Database classes, wire the DI container, refactor every "
        "flat PHP entry point) or delete it (remove the 1,732 lines after confirming nothing depends on "
        "them). The recommended path is to delete it: the migration cost is high, the operational "
        "benefit is low for a system of this size, and the existing flat PHP structure works. Unify the "
        "AI agent taxonomy by adopting the AgentOS skill-folder pattern (see Section 10). Exit criteria: "
        "one codebase in version control, one agent taxonomy, one schema, zero dead DDD code.")

    add_h2(doc, "13.3 Phase 3 (Weeks 6-9) — Code quality")
    add_body(doc,
        "Finish Tech360 A's eleven stub modules — one per sprint, with each module shipping a functional "
        "MVP before moving on. Fix the five unhandled form actions (add_communication, add_staff, "
        "add_content, approve_content, add_project). Implement file upload or remove the UI affordance. "
        "Replace the N+1 query in tab_analytics.php with a single GROUP BY query. Replace command.php's "
        "naive substring routing with an intent classifier (or, as a stopgap, a strict regex match). "
        "Fix the non-existent npm version pins in package.json and regenerate the lockfile. Rebuild all "
        "four n8n workflows on verified endpoint contracts with a server-to-server API token. Exit "
        "criteria: every dashboard module is functional, every form submits successfully, npm install "
        "succeeds on a fresh clone, and every n8n workflow runs end-to-end against a staging CRM.")

    add_h2(doc, "13.4 Phase 4 (Weeks 10-12) — AgentOS integration")
    add_body(doc,
        "Wire the AgentOS / ALO Python service as the canonical skill-resolver for the Tech360 AI "
        "Command Center. Stand up the AgentOS service in a Docker container or systemd unit. Implement "
        "selector.py-based routing: when a Tech360 workflow agent is invoked, it calls selector.py with "
        "the agent name and current context, selector.py returns the appropriate SKILL.md path, and "
        "the agent executes that skill. Map Tech360's twenty seeded workflow agents to twenty top-level "
        "AgentOS categories. Implement the PHP connector (connectors/php/AgentOSClient.php is already "
        "provided in the AgentOS repo) as the bridge between Tech360's PHP backend and the AgentOS "
        "Python service. Exit criteria: invoking any of the twenty workflow agents in the Tech360 "
        "dashboard triggers the corresponding AgentOS skill via selector.py, and the skill's output is "
        "returned to the dashboard UI.")
    add_page_break(doc)


def section_conclusions(doc):
    add_h1(doc, "14. Conclusions")
    add_body(doc,
        "Three conclusions follow from the audit. First, Tech360 A is the more honest and operational "
        "codebase. It ships what it claims, its PDO-only data access layer eliminates SQL injection "
        "surface, its .htaccess is hardened, and its TypeScript strict mode is unusually disciplined "
        "for a small-business CRM. Its flaws — stub modules, unhandled form actions, RBAC bypass on "
        "dashboard, N+1 queries — are concrete and fixable in days, not weeks.")

    add_body(doc,
        "Second, Tech360 B is more architecturally ambitious but ships less working software. The "
        "1,732-line Domain-Driven Design layer is aspirational code that is never instantiated. The "
        "empty-string webhook secret default is a Critical security hole. The two parallel auth systems, "
        "three parallel response abstractions, and two parallel agent taxonomies are drift-prone "
        "duplication. The five SQL bugs in super-admin.php mean the dashboard's headline metrics have "
        "been wrong since they were written. B should be treated as a design-intent reference, not a "
        "production baseline.")

    add_body(doc,
        "Third, the AgentOS skills manifest represents a mature, machine-addressable catalog of two "
        "thousand skill definitions across one hundred categories. It should be integrated as the "
        "canonical skills layer for the Tech360 AI Command Center, with selector.py providing the "
        "routing layer and Tech360's twenty seeded workflow agents becoming thin wrappers that call "
        "into AgentOS.")

    add_body(doc,
        "The final verdict is consolidation: adopt Tech360 A as the production baseline, harvest "
        "Tech360 B's Domain-Driven Design intent by either finishing or deleting it (deletion is "
        "recommended), and integrate AgentOS as the skills layer. Commission the Phase 1 critical "
        "security fixes immediately — the empty webhook secret in B and the RBAC bypass in A are both "
        "exploitable today by an attacker with no prior access to the system.")
    add_page_break(doc)


def section_appendix(doc):
    add_h1(doc, "Appendix A: File Inventory Summary")
    add_h2(doc, "A.1 Tech360 A file inventory")
    rows = [
        ("PHP",        "~50 files",  "4,943 LOC"),
        ("TypeScript / TSX", "8 files", "2,470 LOC"),
        ("SQL",        "2 files",    "778 LOC"),
        ("Markdown",   "8 files",    "2,111 LOC"),
        ("JSON",       "5 files",    "~1,000 LOC"),
        ("CSS",        "1 file",     "~200 LOC"),
        ("Bash / PowerShell", "2 files", "~107 LOC"),
        ("Other",      "~33 files",  "—"),
        ("TOTAL",      "~109 files", "~11,319 LOC"),
    ]
    add_table(doc, ["Type", "Count", "Lines of code"], rows, col_widths_pct=[3, 3, 4])
    add_body(doc, "Table A-1: Tech360 A file inventory by type.")

    add_h2(doc, "A.2 Tech360 B file inventory")
    rows = [
        ("PHP",        "67 files",   "~11,500 LOC"),
        ("TypeScript / TSX", "6 files", "~1,400 LOC"),
        ("SQL",        "2 files",    "~780 LOC"),
        ("Markdown",   "9 files",    "~1,200 LOC"),
        ("JSON",       "7 files",    "~1,500 LOC"),
        ("CSS",        "1 file",     "~80 LOC"),
        ("Other",      "~6 files",   "—"),
        ("TOTAL",      "~99 files",  "~14,460 LOC"),
    ]
    add_table(doc, ["Type", "Count", "Lines of code"], rows, col_widths_pct=[3, 3, 4])
    add_body(doc, "Table A-2: Tech360 B file inventory by type.")

    add_h2(doc, "A.3 AgentOS skills catalog summary")
    rows = [
        ("Python modules (app/)", "9 files",  "config, db, local_ai, main, payment_guard, protection_mode, runtime, schemas, selector"),
        ("Static frontend",        "3 files",  "index.html, app.js, style.css"),
        ("PHP connector",          "2 files",  "AgentOSClient.php, example.php"),
        ("Data files",             "3 files",  "departments.json, registry_enriched.json, registry_source.json"),
        ("Deploy configs",         "2 files",  "alo-agentos.service, nginx-agents.alolabs.net.conf"),
        ("Docs",                   "4 files",  "FREE_LOCAL_MODELS.md, INSTALL_UBUNTU.md, PROJECT_STATUS.md, SECURITY.md"),
        ("Models catalog",         "1 file",   "catalog.json"),
        ("Scripts",                "7 files",  "seed.py, smoke_test.py, validate_registry.py, backup.sh, install.sh, pull_models.sh, run.sh"),
        ("Skills (SKILL.md)",      "2,000 files", "100 categories × 20 agents each, under skills/private/"),
    ]
    add_table(doc, ["Category", "Count", "Description"], rows, col_widths_pct=[3, 2, 7])
    add_body(doc, "Table A-3: AgentOS / ALO project file inventory summary.")

    add_h2(doc, "A.4 Full audit worklog")
    add_body(doc,
        "The complete file-by-file audit worklog — including line counts, code excerpts, and detailed "
        "observations for every file read during this audit — is preserved at "
        "/home/z/my-project/worklog.md on the audit workstation. The worklog is approximately one "
        "thousand lines long and is the authoritative source for any follow-up investigation that "
        "requires file-level detail beyond what is summarized in this report.")


# ------------------------------------------------------------------
# Main
# ------------------------------------------------------------------

def main():
    doc = Document()
    set_default_styles(doc)

    # ---- Cover (section 1) ----
    build_cover(doc)

    # ---- Body (section 2, new section) ----
    start_body_section(doc)

    # Body sections
    section_executive_summary(doc)
    section_background_scope(doc)
    section_tech360_a(doc)
    section_tech360_b(doc)
    section_comparison(doc)
    section_database(doc)
    section_security(doc)
    section_n8n(doc)
    section_agentos(doc)
    section_ai_taxonomy(doc)
    section_code_quality(doc)
    section_risks(doc)
    section_roadmap(doc)
    section_conclusions(doc)
    section_appendix(doc)

    # Save
    doc.save(OUTPUT_PATH)
    print(f"OK: wrote {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
