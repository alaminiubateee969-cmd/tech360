#!/usr/bin/env python3
"""
Render the /work "concept motion preview" videos.

Every frame is drawn with Pillow from repository assets (cover artwork, stage
titles from src/data, brand mark) and piped to ffmpeg as raw RGB, so the output
is fully reproducible and contains no third-party footage.

Each video (1280x720, 25 fps, H.264, silent, ~12 s):
  0.0 – 4.6 s  cover artwork with a slow push-in, title lower-third
  4.6 – 9.8 s  the four workflow stages revealed one by one
  9.8 – 12  s  TECH360 end card
A "CONCEPT PREVIEW" label is burned in for the full duration so the clip stays
honest if it is ever shared out of context.

Requirements: python3, Pillow, an ffmpeg binary with libx264 (FFMPEG env var
or on PATH) and a TrueType sans font (FONT_DIR env var, default DejaVu).

Usage:
  npx tsx scripts/media/export-portfolio-manifest.ts > /tmp/portfolio-manifest.json
  python3 scripts/media/build_portfolio_videos.py /tmp/portfolio-manifest.json [slug ...]
"""
from __future__ import annotations

import json
import math
import os
import shutil
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[2]
PUBLIC = ROOT / "public"
W, H, FPS = 1280, 720, 25
DURATION = 12.0

NAVY = (6, 21, 40)
NAVY_2 = (11, 33, 56)
BLUE = (0, 159, 227)
DEEP_BLUE = (6, 59, 143)
GREEN = (24, 184, 58)
WHITE = (255, 255, 255)
MUTED = (169, 190, 210)


def find_ffmpeg() -> str:
    env = os.environ.get("FFMPEG")
    if env:
        return env
    found = shutil.which("ffmpeg")
    if found:
        return found
    try:
        import imageio_ffmpeg  # type: ignore

        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception as exc:  # pragma: no cover
        raise SystemExit("ffmpeg not found: set FFMPEG or install imageio-ffmpeg") from exc


def font_dir() -> Path:
    env = os.environ.get("FONT_DIR")
    if env:
        return Path(env)
    import matplotlib  # type: ignore

    return Path(matplotlib.__file__).parent / "mpl-data" / "fonts" / "ttf"


FONTS = font_dir()


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(FONTS / ("DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf")), size)


def ease(t: float) -> float:
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


def cover_fit(img: Image.Image, w: int, h: int) -> Image.Image:
    scale = max(w / img.width, h / img.height)
    resized = img.resize((math.ceil(img.width * scale), math.ceil(img.height * scale)), Image.LANCZOS)
    left = (resized.width - w) // 2
    top = (resized.height - h) // 2
    return resized.crop((left, top, left + w, top + h))


def wrap(draw: ImageDraw.ImageDraw, text: str, fnt: ImageFont.FreeTypeFont, max_width: int) -> list[str]:
    words, lines, line = text.split(), [], ""
    for word in words:
        trial = f"{line} {word}".strip()
        if draw.textlength(trial, font=fnt) <= max_width:
            line = trial
        else:
            if line:
                lines.append(line)
            line = word
    if line:
        lines.append(line)
    return lines


def concept_badge(frame: Image.Image) -> None:
    draw = ImageDraw.Draw(frame, "RGBA")
    label = "CONCEPT PREVIEW · NOT A PRODUCT RECORDING"
    fnt = font(15, bold=True)
    tw = draw.textlength(label, font=fnt)
    x, y = 28, 26
    draw.rounded_rectangle((x, y, x + tw + 36, y + 34), radius=17, fill=(6, 21, 40, 210), outline=(155, 235, 255, 110))
    draw.ellipse((x + 13, y + 13, x + 21, y + 21), fill=(245, 179, 1, 255))
    draw.text((x + 28, y + 8), label, font=fnt, fill=(220, 240, 255))


def text_a(frame: Image.Image, xy: tuple[float, float], text: str, fnt: ImageFont.FreeTypeFont, fill: tuple) -> None:
    """Draw text with real opacity.

    Pillow ignores the alpha component of ``fill`` for text (shapes honour it),
    so faded text drawn straight onto the frame shows at full strength and
    "ghosts" through crossfades. Render onto a transparent layer instead and
    composite only the text's bounding box back onto the RGB frame.
    """
    alpha = fill[3] if len(fill) == 4 else 255
    if alpha <= 0:
        return
    if alpha >= 255:
        ImageDraw.Draw(frame).text(xy, text, font=fnt, fill=tuple(fill[:3]))
        return
    layer = Image.new("RGBA", frame.size, (0, 0, 0, 0))
    ImageDraw.Draw(layer).text(xy, text, font=fnt, fill=tuple(fill))
    box = layer.getbbox()
    if not box:
        return
    region = frame.crop(box).convert("RGBA")
    frame.paste(Image.alpha_composite(region, layer.crop(box)).convert("RGB"), box[:2])


# ---------------------------------------------------------------- scenes


def scene_cover(entry: dict, cover: Image.Image, t: float) -> Image.Image:
    """t in [0, 1] across the cover scene."""
    zoom = 1.0 + 0.07 * ease(t)
    cw, ch = int(W * zoom), int(H * zoom)
    big = cover_fit(cover, cw, ch)
    ox = (cw - W) // 2
    oy = int((ch - H) * 0.45)
    frame = big.crop((ox, oy, ox + W, oy + H)).convert("RGB")

    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    for i in range(300):
        alpha = int(235 * (i / 300) ** 1.6)
        od.line([(0, H - 300 + i), (W, H - 300 + i)], fill=(4, 14, 28, alpha))
    # Draw on an RGB frame through an RGBA context so ink alpha is blended
    # (Pillow overwrites, rather than blends, when drawing onto RGBA images).
    frame = Image.alpha_composite(frame.convert("RGBA"), overlay).convert("RGB")

    draw = ImageDraw.Draw(frame, "RGBA")
    appear = ease((t - 0.08) / 0.25)
    shift = int((1 - appear) * 24)
    kicker = f"{entry['kindLabel'].upper()}  ·  {entry['industry'].upper()}"
    text_a(frame, (56, H - 178 + shift), kicker, font(18, bold=True), (143, 211, 244, int(255 * appear)))
    title_font = font(44, bold=True)
    lines = wrap(draw, entry["title"], title_font, W - 160)[:2]
    y = H - 146 + shift
    for line in lines:
        text_a(frame, (56, y), line, title_font, (255, 255, 255, int(255 * appear)))
        y += 54
    draw.rectangle((56, H - 190 + shift, 56 + int(90 * appear), H - 186 + shift), fill=BLUE + (255,))
    return frame


def scene_stages(entry: dict, backdrop: Image.Image, t: float) -> Image.Image:
    """t in [0, 1] across the stage scene."""
    frame = backdrop.copy()
    draw = ImageDraw.Draw(frame, "RGBA")
    draw.text((56, 92), "HOW IT WORKS", font=font(18, bold=True), fill=(143, 211, 244))
    draw.text((56, 120), entry["title"], font=font(30, bold=True), fill=WHITE)

    stages = entry["stages"][:4] or ["Capture", "Process", "Review", "Deliver"]
    n = len(stages)
    gap = 22
    card_w = (W - 112 - gap * (n - 1)) // n
    card_h = 300
    top = 236
    per = 0.78 / n
    for i, title in enumerate(stages):
        local = ease((t - 0.04 - i * per) / (per * 0.9))
        if local <= 0:
            alpha_card = 40
        else:
            alpha_card = int(40 + 215 * local)
        x = 56 + i * (card_w + gap)
        y = top + int((1 - local) * 18)
        active = local > 0.98 and (i == n - 1 or ease((t - 0.04 - (i + 1) * per) / (per * 0.9)) <= 0)
        outline = (GREEN if i == n - 1 and local > 0.98 else BLUE) + (int(200 * max(local, 0.25)),)
        draw.rounded_rectangle((x, y, x + card_w, y + card_h), radius=22, fill=(11, 33, 56, alpha_card), outline=outline, width=3 if active else 2)
        badge_fill = (GREEN if i == n - 1 else BLUE) + (int(255 * max(local, 0.3)),)
        draw.ellipse((x + 24, y + 26, x + 72, y + 74), fill=badge_fill)
        num = f"{i + 1:02d}"
        nf = font(19, bold=True)
        text_a(frame, (x + 48 - draw.textlength(num, font=nf) / 2, y + 38), num, nf, (255, 255, 255, int(255 * max(local, 0.3))))
        tf = font(23, bold=True)
        ty = y + 104
        for line in wrap(draw, title, tf, card_w - 48)[:3]:
            text_a(frame, (x + 24, ty), line, tf, (255, 255, 255, int(255 * max(local, 0.25))))
            ty += 32
        # abstract data lines, explicitly placeholders
        bar_alpha = int(160 * max(local, 0.15))
        draw.rounded_rectangle((x + 24, y + card_h - 92, x + 24 + int((card_w - 48) * local), y + card_h - 82), radius=5, fill=(0, 159, 227, bar_alpha))
        draw.rounded_rectangle((x + 24, y + card_h - 64, x + 24 + int((card_w - 48) * 0.62), y + card_h - 56), radius=4, fill=(60, 90, 120, bar_alpha))
        draw.rounded_rectangle((x + 24, y + card_h - 44, x + 24 + int((card_w - 48) * 0.44), y + card_h - 36), radius=4, fill=(60, 90, 120, bar_alpha))
        if i < n - 1:
            cx = x + card_w + 2
            draw.line((cx, y + card_h // 2, cx + gap - 4, y + card_h // 2), fill=(0, 159, 227, int(220 * local)), width=3)

    draw.text((56, H - 70), "Stages from the published TECH360 specification. Bars are illustrative placeholders, not data.", font=font(16), fill=MUTED)
    return frame


def scene_end(logo: Image.Image, backdrop: Image.Image, t: float) -> Image.Image:
    frame = backdrop.copy()
    draw = ImageDraw.Draw(frame, "RGBA")
    a = ease(t / 0.35)
    size = 190
    lx, ly = W // 2 - size // 2, 150 + int((1 - a) * 16)
    draw.ellipse((lx - 8, ly - 8, lx + size + 8, ly + size + 8), fill=(255, 255, 255, int(255 * a)))
    lg = logo.resize((size, size), Image.LANCZOS)
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, size, size), fill=int(255 * a))
    frame.paste(lg, (lx, ly), mask)
    head = "Scope a similar system with TECH360"
    hf = font(36, bold=True)
    text_a(frame, (W / 2 - draw.textlength(head, font=hf) / 2, 386), head, hf, (255, 255, 255, int(255 * a)))
    sub = "Written scope · HTML preview before build · Source-code handover"
    sf = font(20)
    text_a(frame, (W / 2 - draw.textlength(sub, font=sf) / 2, 444), sub, sf, MUTED + (int(255 * a),))
    url = "bdtech360.com/contact"
    uf = font(24, bold=True)
    uw = draw.textlength(url, font=uf)
    draw.rounded_rectangle((W / 2 - uw / 2 - 26, 500, W / 2 + uw / 2 + 26, 552), radius=26, fill=(0, 159, 227, int(255 * a)))
    text_a(frame, (W / 2 - uw / 2, 512), url, uf, (4, 18, 31, int(255 * a)))
    return frame


def make_backdrop(cover: Image.Image) -> Image.Image:
    base = cover_fit(cover, W, H).filter(ImageFilter.GaussianBlur(28))
    shade = Image.new("RGB", (W, H), NAVY)
    out = Image.blend(base, shade, 0.82)
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse((-300, -380, 700, 420), fill=(0, 159, 227, 38))
    gd.ellipse((780, 320, 1600, 1100), fill=(24, 184, 58, 22))
    glow = glow.filter(ImageFilter.GaussianBlur(90))
    return Image.alpha_composite(out.convert("RGBA"), glow).convert("RGB")


def render(entry: dict, ffmpeg: str, logo: Image.Image) -> None:
    cover = Image.open(PUBLIC / entry["cover"].lstrip("/")).convert("RGB")
    backdrop = make_backdrop(cover)
    out = PUBLIC / entry["video"].lstrip("/")
    out.parent.mkdir(parents=True, exist_ok=True)
    poster = PUBLIC / entry["poster"].lstrip("/")
    poster.parent.mkdir(parents=True, exist_ok=True)

    cmd = [
        ffmpeg, "-y", "-loglevel", "error",
        "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
        "-an", "-c:v", "libx264", "-preset", "slow", "-crf", "27", "-tune", "stillimage",
        "-pix_fmt", "yuv420p", "-profile:v", "high", "-level", "4.0", "-movflags", "+faststart",
        str(out),
    ]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    total = int(DURATION * FPS)
    a_end, b_end = 4.6, 9.8
    fade = 0.5
    poster_written = False
    for f in range(total):
        s = f / FPS
        if s < a_end:
            frame = scene_cover(entry, cover, s / a_end)
            if s > a_end - fade:
                nxt = scene_stages(entry, backdrop, 0)
                frame = Image.blend(frame, nxt, (s - (a_end - fade)) / fade)
        elif s < b_end:
            frame = scene_stages(entry, backdrop, (s - a_end) / (b_end - a_end))
            if s > b_end - fade:
                nxt = scene_end(logo, backdrop, 0)
                frame = Image.blend(frame, nxt, (s - (b_end - fade)) / fade)
        else:
            frame = scene_end(logo, backdrop, (s - b_end) / (DURATION - b_end))
        # gentle fade in / out
        if s < 0.4:
            frame = Image.blend(Image.new("RGB", (W, H), NAVY), frame, s / 0.4)
        concept_badge(frame)
        if not poster_written and s >= 1.6:
            # WebP poster (~45% smaller than the previous JPEG at PSNR >= 37 dB).
            frame.save(poster, "WEBP", quality=80, method=6)
            poster_written = True
        proc.stdin.write(frame.tobytes())  # type: ignore[union-attr]
    proc.stdin.close()  # type: ignore[union-attr]
    if proc.wait() != 0:
        raise SystemExit(f"ffmpeg failed for {entry['slug']}")
    print(f"✓ {entry['slug']}: {out.relative_to(ROOT)} ({out.stat().st_size // 1024} KB)")


def main() -> None:
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    manifest = json.loads(Path(sys.argv[1]).read_text())
    only = set(sys.argv[2:])
    ffmpeg = find_ffmpeg()
    logo = Image.open(PUBLIC / "images" / "tech360-logo.png").convert("RGB")
    for entry in manifest:
        if only and entry["slug"] not in only:
            continue
        if entry.get("video"):
            render(entry, ffmpeg, logo)


if __name__ == "__main__":
    main()
