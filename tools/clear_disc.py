#!/usr/bin/env python3
"""주인공 그림(full-lead.png)에서 뒤의 하늘색 원반만 투명하게 지운 판(full-night.png)을 만든다.

밤 구역에 서는 그림에 쓴다. 인물·로봇·흰 회로선·'AI' 상자·말풍선은 건드리지 않는다.
원반 색 영역(색상 0.50~0.60, 채도 0.10~0.52, 명도 0.25 초과)의 알파를 채도에 따라 줄인다 —
흰 선과 섞인 가장자리(채도가 낮다)는 덜 지운다. 결과에서 메타데이터 청크도 걷어 낸다.

사용법: python3 tools/clear_disc.py [원본.png] [결과.png]
        (인자가 없으면 src/assets/character/full-lead.png → full-night.png)
"""
import colorsys
import os
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from strip_png_meta import strip  # noqa: E402

SRC = 'src/assets/character/full-lead.png'
DST = 'src/assets/character/full-night.png'


def clear_disc(src: str, dst: str) -> None:
    im = Image.open(src).convert('RGBA')
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            hh, ss, vv = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            if 0.50 <= hh <= 0.60 and 0.10 <= ss <= 0.52 and vv > 0.25:
                k = min(1, (ss - 0.10) / 0.18)  # 흰 선과 섞인 가장자리는 덜 지운다
                px[x, y] = (r, g, b, int(a * (1 - k)))
    im.save(dst)
    strip(dst, dst)


if __name__ == '__main__':
    if len(sys.argv) not in (1, 3):
        sys.exit(__doc__)
    clear_disc(*(sys.argv[1:3] if len(sys.argv) == 3 else (SRC, DST)))
