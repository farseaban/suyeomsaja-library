// 이미지 파일 안에 남은 메타데이터 덩어리 이름을 돌려준다. 빈 배열이면 깨끗하다.
const PNG_META = ['tEXt', 'iTXt', 'zTXt', 'eXIf', 'tIME']
const WEBP_META = ['EXIF', 'XMP ']

export function metaChunks(buf: Buffer): string[] {
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    const found: string[] = []
    for (let i = 8; i + 8 <= buf.length; ) {
      const n = buf.readUInt32BE(i), type = buf.toString('latin1', i + 4, i + 8)
      if (PNG_META.includes(type)) found.push(type)
      i += 12 + n
    }
    return found
  }
  if (buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'WEBP') {
    const found: string[] = []
    for (let i = 12; i + 8 <= buf.length; ) {
      const type = buf.toString('latin1', i, i + 4), n = buf.readUInt32LE(i + 4)
      if (WEBP_META.includes(type)) found.push(type)
      i += 8 + n + (n % 2)
    }
    return found
  }
  return ['unknown-format']
}
