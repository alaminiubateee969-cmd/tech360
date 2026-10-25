#!/usr/bin/env python3
"""Generate public/official/TECH360-Official-Info.pdf on the company pad.

Mirrors OFFICIAL_INFO in src/lib/constants.ts and the HTML sheet at
/api/official-info (src/lib/letterhead.ts). Passwords are never printed.
Requires: pymupdf  (pip install pymupdf)
"""
import pathlib

import pymupdf

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "official" / "TECH360-Official-Info.pdf"
LOGO = ROOT / "public" / "brand" / "tech360-logo-original.jpg"

NAVY = (6 / 255, 59 / 255, 143 / 255)
BLUE = (0, 159 / 255, 227 / 255)
GREEN = (24 / 255, 184 / 255, 58 / 255)
INK = (11 / 255, 31 / 255, 51 / 255)
GREY = (82 / 255, 97 / 255, 115 / 255)
LIGHT = (246 / 255, 249 / 255, 252 / 255)
BORDER = (226 / 255, 232 / 255, 240 / 255)

W, H = 595, 842  # A4 pt
M = 42


def text(page, x, y, s, size=10, color=INK, bold=False, align=0, width=None):
    font = "hebo" if bold else "helv"
    if width:
        page.insert_textbox(pymupdf.Rect(x, y, x + width, y + size * 4), s, fontsize=size, fontname=font, color=color, align=align)
    else:
        page.insert_text((x, y), s, fontsize=size, fontname=font, color=color)
    return y + size * 1.45


def wrap(page, x, y, s, size=9.5, color=GREY, width=W - 2 * M - 24, leading=13):
    words, lines, cur = s.split(), [], ""
    for w_ in words:
        t = (cur + " " + w_).strip()
        if pymupdf.get_text_length(t, fontname="helv", fontsize=size) > width and cur:
            lines.append(cur)
            cur = w_
        else:
            cur = t
    if cur:
        lines.append(cur)
    for ln in lines:
        page.insert_text((x, y), ln, fontsize=size, fontname="helv", color=color)
        y += leading
    return y


def card(page, y, title, body):
    h = 34 + max(1, len(body) // 95 + body.count("\n") + 1) * 13
    page.draw_rect(pymupdf.Rect(M, y, W - M, y + h), color=BORDER, fill=(1, 1, 1), width=0.7)
    yy = text(page, M + 12, y + 18, title, size=11, bold=True)
    for line in body.split("\n"):
        yy = wrap(page, M + 12, yy + 2, line)
    return y + h + 10


def heading(page, y, s):
    page.draw_rect(pymupdf.Rect(M, y - 9, M + 9, y), color=BLUE, fill=BLUE)
    return text(page, M + 16, y, s, size=14, bold=True) + 4


def main():
    doc = pymupdf.open()
    page = doc.new_page(width=W, height=H)

    # faint watermark like the pad
    page.insert_text((105, 500), "TECH360", fontsize=72, fontname="hebo", color=(0.96, 0.97, 0.99), morph=(pymupdf.Point(300, 430), pymupdf.Matrix(24)))

    y = 52
    if LOGO.exists():
        page.insert_image(pymupdf.Rect(M, y - 24, M + 132, y + 16), filename=str(LOGO))

    def right(txt, yy, size=9, color=INK, bold=False):
        font = "hebo" if bold else "helv"
        tw = pymupdf.get_text_length(txt, fontname=font, fontsize=size)
        page.insert_text((W - M - tw, yy), txt, fontsize=size, fontname=font, color=color)

    right("TECH360", y - 10, size=18, bold=True)
    right("CONNECT - INNOVATE - GROW", y + 4, size=8, color=BLUE, bold=True)
    right("Web | Cloud | AI | Data | Tech", y + 17, size=8, color=GREY)
    right("TECH360 LLC - Missouri LLC LC014737249 - EIN 98-1940053", y + 32, size=8.5, color=GREY)
    right("117 S Lexington St Ste 100, Harrisonville, MO 64701, USA", y + 44, size=8.5, color=GREY)
    y += 56

    # brand rule
    seg = (W - 2 * M) / 3
    for i, c in enumerate([NAVY, BLUE, GREEN]):
        page.draw_rect(pymupdf.Rect(M + i * seg, y, M + (i + 1) * seg, y + 5), color=c, fill=c)
    y += 17
    text(page, M, y, "OFFICIAL COMPANY DOCUMENT", size=7.5, color=GREY, bold=True)
    right("OFFICIAL INFORMATION SHEET", y, size=7.5, color=GREY, bold=True)
    y += 14

    # meta bar
    meta = [("DOCUMENT", "Official Info"), ("ENTITY", "TECH360 LLC"), ("STATUS", "Public")]
    mw = (W - 2 * M - 20) / 3
    for i, (k, v) in enumerate(meta):
        x = M + i * (mw + 10)
        page.draw_rect(pymupdf.Rect(x, y, x + mw, y + 38), color=BORDER, fill=LIGHT, width=0.7)
        text(page, x + 10, y + 15, k, size=7, color=GREY, bold=True)
        text(page, x + 10, y + 30, v, size=10.5, bold=True, color=NAVY if i == 0 else INK)
    y += 52

    y = heading(page, y, "Company identity")
    y = card(page, y, "TECH360 LLC - CONNECT - INNOVATE - GROW",
             "Entity: Missouri Limited Liability Company (Sole Member) - Missouri LLC No. LC014737249 - EIN 98-1940053\n"
             "Registered address: 117 S Lexington St Ste 100, Harrisonville, MO 64701, USA\n"
             "Brand promise: Smart Solutions for a Digital Tomorrow - Future-Ready Solutions, Smarter Processes,\n"
             "Better Results. Digital Transformation for Growth, built with Security & Reliability.\n"
             "Services line: Web | Cloud | AI | Data | Tech")

    y = heading(page, y, "Official contacts")
    y = card(page, y, "As printed on the official company pad",
             "Phone: +1 (347) 433 1200  -  Website: www.tech360.com  -  Email: info@tech360.com\n"
             "Address: 117 S Lexington St Ste 100, Harrisonville, MO 64701, USA")
    y = card(page, y, "Platform contacts (in live use)",
             "Website: www.bdtech360.com  -  Email: info@bdtech360.com  -  Phone: +1 (816) 380-8660\n"
             "WhatsApp: +880 1327-100297 (wa.me/8801327100297)  -  Live site: tech360.space-z.ai")

    y = heading(page, y, "What we do (official pad)")
    y = card(page, y, "Digital Solutions - Website Design - SEO Optimization",
             "Tech Integration - Global Connectivity - Cloud Services\n"
             "Plus: eCommerce, Custom CRM, Client Portals, Dashboards, WhatsApp & n8n Automation,\n"
             "AI Agent Systems, API Integrations, Maintenance & Support.")

    if y > 540:
        page = doc.new_page(width=W, height=H)
        page.insert_text((105, 500), "TECH360", fontsize=72, fontname="hebo", color=(0.96, 0.97, 0.99), morph=(pymupdf.Point(300, 430), pymupdf.Matrix(24)))
        y = 56
    y = heading(page, y, "Console logins - Super Admin & Admin")
    y = card(page, y, "One login for both roles:  /#/admin   -   Client portal: /#/portal",
             "Sign in with your console email + password. Your role - assigned to your account, never chosen\n"
             "on the login screen - decides access. Forced password change on first login, optional 2FA,\n"
             "lockout after failed attempts, full audit log. Passwords are never printed on official documents.")
    y = card(page, y, "Super Admin  |  Admin",
             "SUPER ADMIN: full control - team & roles, settings, feature/payment switches, internal ops,\n"
             "final approvals, official documents, audit logs.\n"
             "ADMIN: operations - clients, projects, content studio, software factory, reports, media & feeds.\n"
             "Cannot change roles, governance switches, or gateway credentials.\n"
             "Need access? A Super Admin creates accounts in Team > Create user (one-time temporary password).")

    # signatures
    y += 8
    for i, (who, role) in enumerate([("TECH360 LLC", "Project Authorization - on behalf of the company"),
                                      ("Recipient", "Acknowledgement of official information")]):
        x = M + i * ((W - 2 * M - 20) / 2 + 20)
        w2 = (W - 2 * M - 20) / 2
        page.draw_line(pymupdf.Point(x, y + 26), pymupdf.Point(x + w2, y + 26), color=INK, width=1.2)
        text(page, x, y + 40, who, size=10, bold=True)
        text(page, x, y + 52, role, size=8, color=GREY)
        text(page, x, y + 64, "Date: ______________", size=8, color=GREY)
    y += 84

    # pad footer blocks
    page.draw_rect(pymupdf.Rect(M, y, W - M, y + 4), color=GREEN, fill=GREEN)
    y += 18
    blocks = [("ADDRESS", "117 S Lexington St Ste 100\nHarrisonville, MO 64701, USA"),
              ("PHONE", "+1 (347) 433 1200"), ("WEBSITE", "www.tech360.com\nwww.bdtech360.com"),
              ("EMAIL", "info@tech360.com\ninfo@bdtech360.com")]
    bw = (W - 2 * M) / 4
    for i, (k, v) in enumerate(blocks):
        x = M + i * bw
        text(page, x, y, k, size=7, color=BLUE, bold=True)
        yy = y + 11
        for line in v.split("\n"):
            yy = text(page, x, yy, line, size=8, color=GREY)
    y += 42
    text(page, M, y, "Official information sheet - verify the latest version at www.bdtech360.com", size=7.5, color=GREY)
    text(page, M, y, "Issued electronically by the Tech360 platform - TECH360 LLC - EIN 98-1940053", size=7.5, color=GREY, width=W - 2 * M, align=2)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    doc.save(str(OUT), garbage=3, deflate=True)
    print(f"Wrote {OUT} ({OUT.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
