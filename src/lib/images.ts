import { existsSync, statSync } from 'node:fs'
import { join, resolve, sep } from 'node:path'
import { parse } from 'node-html-parser'
import { IMG_SRC } from './post-safety'

// 글에 넣는 그림의 저작권 규칙. 안전(어디서 불러오나)은 post-safety가, 출처 표기는 여기서 본다.
// 쓸 수 있는 것: 저작권이 끝난 것(퍼블릭 도메인·CC0)과 출처를 밝히면 되는 것(CC BY·CC BY-SA).
// 비영리(NC)·변경 금지(ND) 조건은 자르기·크기 조정만으로도 어길 수 있어 받지 않는다.
const LICENCE = /퍼블릭 도메인|CC0|CC BY(-SA)? \d\.\d/
const RESTRICTED = /CC BY[^ ]*-(NC|ND)/

/** 글이 쓰는 그림 파일 이름(img/ 아래). */
export function localImages(articleHtml: string): string[] {
  return parse(articleHtml)
    .querySelectorAll('img')
    .map((img) => img.getAttribute('src') ?? '')
    // 안전 검사와 같은 규칙으로 한 번 더 거른다 — 두 파서가 다르게 읽어도 img/ 밖 파일 이름은 여기를 지나지 못한다
    .filter((src) => IMG_SRC.test(src))
    .map((src) => src.slice('img/'.length))
}

/** 그림마다 figure > figcaption > .credit에 라이선스와 https 출처 링크가 있는지 본다. 빈 목록이면 통과. */
export function findCreditProblems(articleHtml: string): string[] {
  const problems: string[] = []
  for (const img of parse(articleHtml).querySelectorAll('img')) {
    const name = img.getAttribute('src') ?? '?'
    let fig = img.parentNode
    while (fig && fig.rawTagName?.toLowerCase() !== 'figure') fig = fig.parentNode
    if (!fig) {
      problems.push(`${name}: figure 안에 있지 않다`)
      continue
    }
    const credit = fig.querySelector('figcaption .credit')
    if (!credit) {
      problems.push(`${name}: figcaption에 출처 줄(.credit)이 없다`)
      continue
    }
    const text = credit.text
    if (RESTRICTED.test(text)) problems.push(`${name}: 비영리·변경 금지 조건이 붙은 라이선스는 쓰지 않는다`)
    else if (!LICENCE.test(text)) problems.push(`${name}: 출처 줄에 라이선스(퍼블릭 도메인·CC0·CC BY·CC BY-SA)가 없다`)
    if (!credit.querySelectorAll('a').some((a) => (a.getAttribute('href') ?? '').startsWith('https://'))) {
      problems.push(`${name}: 출처 줄에 https 원 출처 링크가 없다`)
    }
  }
  return problems
}

// 휴대폰에서 글이 느려지지 않게 그림 한 장은 이보다 작게 줄여 넣는다(긴 변 1600px 안팎의 jpg·webp면 충분하다)
export const MAX_IMAGE_BYTES = 500 * 1024

/** 글 폴더의 그림 파일이 실제로 있고 가벼운지, 출처 줄이 있는지 본다. */
export function checkImages(postDir: string, articleHtml: string): { paths: string[]; problems: string[] } {
  const problems = findCreditProblems(articleHtml)
  const paths: string[] = []
  for (const name of localImages(articleHtml)) {
    const path = join(postDir, 'img', name)
    if (!insideImgDir(postDir, path)) {
      problems.push(`${name}: img/ 폴더 밖을 가리킨다`)
      continue
    }
    if (!existsSync(path)) problems.push(`${name}: img/ 폴더에 파일이 없다`)
    else if (statSync(path).size > MAX_IMAGE_BYTES) problems.push(`${name}: ${Math.round(statSync(path).size / 1024)}KB — ${MAX_IMAGE_BYTES / 1024}KB 아래로 줄인다`)
    else paths.push(path)
  }
  return { paths, problems }
}

/** 경로가 그 글의 img/ 폴더 바로 아래 파일인지(빌드가 내보내기 전에 다시 확인한다). */
export function insideImgDir(postDir: string, path: string): boolean {
  const dir = resolve(postDir, 'img') + sep
  const full = resolve(path)
  return full.startsWith(dir) && !full.slice(dir.length).includes(sep) && IMG_SRC.test(`img/${full.slice(dir.length)}`)
}
