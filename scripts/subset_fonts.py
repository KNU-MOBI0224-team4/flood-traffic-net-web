#!/usr/bin/env python3
"""Subset IBM Plex Sans KR + IBM Plex Mono to exactly the glyphs this app renders
and emit small self-hosted .woff2 files into src/fonts/.

Why: the full IBM Plex Sans KR is ~2.7MB/weight (Korean has ~11k syllables). This
app's Korean text is static and small, so subsetting to the characters actually
used shrinks each weight to a few tens of KB — fully self-hosted, no Google Fonts
dependency, identical typeface for every viewer.

Requires: fonttools, brotli   ->   pip install fonttools brotli
Run:       python scripts/subset_fonts.py
Re-run whenever the UI text changes (it re-derives the charset from source).

Source fonts: the complete TTFs from the google/fonts repo (OFL licensed),
cached under .font-cache/ (git-ignored).
"""
import glob
import os
import urllib.request

from fontTools.subset import Options, Subsetter
from fontTools.ttLib import TTFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, ".font-cache")
OUT = os.path.join(ROOT, "src", "fonts")
BASE = "https://raw.githubusercontent.com/google/fonts/main/ofl"

# (url suffix, css family name, weight, output filename)
FONTS = [
    ("ibmplexsanskr/IBMPlexSansKR-Regular.ttf",  "IBM Plex Sans KR", 400, "ibm-plex-sans-kr-400.woff2"),
    ("ibmplexsanskr/IBMPlexSansKR-Medium.ttf",   "IBM Plex Sans KR", 500, "ibm-plex-sans-kr-500.woff2"),
    ("ibmplexsanskr/IBMPlexSansKR-SemiBold.ttf", "IBM Plex Sans KR", 600, "ibm-plex-sans-kr-600.woff2"),
    ("ibmplexsanskr/IBMPlexSansKR-Bold.ttf",     "IBM Plex Sans KR", 700, "ibm-plex-sans-kr-700.woff2"),
    ("ibmplexmono/IBMPlexMono-Regular.ttf",      "IBM Plex Mono",    400, "ibm-plex-mono-400.woff2"),
    ("ibmplexmono/IBMPlexMono-Medium.ttf",       "IBM Plex Mono",    500, "ibm-plex-mono-500.woff2"),
]


def collect_chars():
    """Every character the app can render: all printable ASCII (covers dynamic
    data — route numbers, segment IDs, dates, model labels) plus every character
    that appears in source (captures the static Korean UI text + symbols like
    · — × τ ◎ ● ○) and any non-ASCII that sneaked into the data file."""
    chars = set(chr(cp) for cp in range(0x20, 0x7F))  # printable ASCII

    src_files = []
    for pat in ("src/**/*.jsx", "src/**/*.js", "src/**/*.css", "index.html"):
        src_files += glob.glob(os.path.join(ROOT, pat), recursive=True)
    for fp in src_files:
        with open(fp, encoding="utf-8") as fh:
            chars.update(fh.read())

    data = os.path.join(ROOT, "src", "data", "flood-all.json")
    if os.path.exists(data):
        with open(data, encoding="utf-8") as fh:
            chars.update(ch for ch in fh.read() if ord(ch) > 0x7E)

    return {c for c in chars if c == " " or c.isprintable()}


def main():
    os.makedirs(CACHE, exist_ok=True)
    os.makedirs(OUT, exist_ok=True)

    chars = collect_chars()
    print(f"charset: {len(chars)} unique characters "
          f"({sum(1 for c in chars if ord(c) > 0x7E)} non-ASCII)")

    total = 0
    missing_all = set()
    for suffix, family, weight, outname in FONTS:
        src = os.path.join(CACHE, os.path.basename(suffix))
        if not os.path.exists(src):
            print(f"  downloading {os.path.basename(suffix)} ...")
            urllib.request.urlretrieve(f"{BASE}/{suffix}", src)

        font = TTFont(src)
        cmap = font.getBestCmap()
        present = sorted(ord(c) for c in chars if ord(c) in cmap)
        # Track chars we wanted but the font lacks (they'd fall back at render —
        # same as the old Google Fonts setup). Mono legitimately lacks Korean.
        if family != "IBM Plex Mono":
            missing_all.update(c for c in chars if ord(c) not in cmap and (c.isalnum() or ord(c) > 0x2000))

        opts = Options()
        opts.flavor = "woff2"
        opts.with_zopfli = True
        # keep hinting (better Windows rendering) and sensible OT features (default)
        ss = Subsetter(options=opts)
        ss.populate(unicodes=present)
        ss.subset(font)

        outpath = os.path.join(OUT, outname)
        font.save(outpath)
        sz = os.path.getsize(outpath)
        total += sz
        print(f"  {outname:30s} {family} {weight:3d}: "
              f"{len(present):4d} glyphs -> {sz/1024:6.1f} KB")

    print(f"total self-hosted: {total/1024:.1f} KB ({len(FONTS)} files)")
    if missing_all:
        print("note: requested but absent from Sans KR (will fall back, as before): "
              + " ".join(sorted(missing_all)))


if __name__ == "__main__":
    main()
