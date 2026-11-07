#!/usr/bin/env python3
"""PNG에서 그림에 필요한 청크만 남기고 나머지(글·시각·EXIF·색 프로필 등)를 버린다.

사용법: python3 strip_png_meta.py 원본.png 결과.png
"""
import struct
import sys

KEEP = {b'IHDR', b'PLTE', b'tRNS', b'sRGB', b'gAMA', b'IDAT', b'IEND'}
SIG = b'\x89PNG\r\n\x1a\n'


def strip(src: str, dst: str) -> None:
    data = open(src, 'rb').read()
    if data[:8] != SIG:
        sys.exit(f'PNG가 아니다: {src}')
    out, i = [SIG], 8
    while i < len(data):
        (n,) = struct.unpack('>I', data[i:i + 4])
        if data[i + 4:i + 8] in KEEP:
            out.append(data[i:i + 12 + n])
        i += 12 + n
    open(dst, 'wb').write(b''.join(out))


if __name__ == '__main__':
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    strip(sys.argv[1], sys.argv[2])
