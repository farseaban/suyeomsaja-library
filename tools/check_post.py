#!/usr/bin/env python3
"""완성된 블로그 HTML의 각주·참고문헌·SVG·자리표시자를 검사한다.

사용법: python3 check_post.py post.html
종료 코드 0 = 오류 없음 (경고는 있을 수 있음), 1 = 오류 있음
"""
import re
import sys
from html.parser import HTMLParser

ALLOWED_COLORS = {c.lower() for c in """
#D9D3F7 #7466C2 #CDEBDD #3F8F6E #FBD9C6 #C06A45 #CFE3F6 #3E7DB0
#F8E8B0 #A9861F #F6CCD8 #B24E6E #33313F #6E6B7B #E4E0DA #FBF9F6
#E9E6F1 #9A96AA #ECE9F2 #C9C5D6 #FFFFFF #FFF #000000
""".split()}


class P(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids, self.hrefs, self.svgs = [], [], []
        self.in_svg = 0
        self.cur = None
        self.ref_backlinks = {}
        self.in_ref_li = None

    def handle_starttag(self, tag, a):
        a = dict(a)
        if "id" in a:
            self.ids.append(a["id"])
        if tag == "a" and "href" in a:
            self.hrefs.append((a["href"], a.get("id")))
            if self.in_ref_li and a.get("class") == "back":
                self.ref_backlinks.setdefault(self.in_ref_li, []).append(a["href"])
        if tag == "li" and a.get("id", "").startswith("ref-"):
            self.in_ref_li = a["id"]
        if tag == "svg":
            self.in_svg += 1
            if self.in_svg == 1:
                self.cur = {"title": False, "desc": False, "colors": set()}
        if self.in_svg:
            if tag == "title":
                self.cur["title"] = True
            if tag == "desc":
                self.cur["desc"] = True
            for k in ("fill", "stroke", "stop-color"):
                v = a.get(k)
                if v and v.startswith("#"):
                    self.cur["colors"].add(v.lower())

    def handle_endtag(self, tag):
        if tag == "li":
            self.in_ref_li = None
        if tag == "svg" and self.in_svg:
            self.in_svg -= 1
            if self.in_svg == 0:
                self.svgs.append(self.cur)


def main(path):
    html = open(path, encoding="utf-8").read()
    p = P()
    p.feed(html)
    err, warn = [], []

    # 자리표시자
    ph = re.findall(r"\{\{[^}]*\}\}", html)
    if ph:
        err.append(f"남은 자리표시자 {len(ph)}개: {ph[:5]}")

    # 중복 id
    seen, dup = set(), set()
    for i in p.ids:
        (dup if i in seen else seen).add(i)
    if dup:
        err.append(f"중복 id(여러 SVG의 title/desc/marker id 접미사 확인): {sorted(dup)}")

    # 각주
    cites = [(h, i) for h, i in p.hrefs if h.startswith("#ref-") and i and i.startswith("cite-")]
    refs = [i for i in p.ids if i.startswith("ref-")]
    order = []
    for h, _ in cites:
        n = h[5:]
        if n not in order:
            order.append(n)
    for h, _ in cites:
        if h[1:] not in refs:
            err.append(f"본문 각주 {h} 에 해당하는 참고문헌 항목 없음")
    used = {h[1:] for h, _ in cites}
    for r in refs:
        if r not in used:
            warn.append(f"참고문헌 {r} 이 본문에서 인용되지 않음")
    try:
        nums = [int(n) for n in order]
        if nums != list(range(1, len(nums) + 1)):
            err.append(f"각주 번호가 첫 등장 순서대로 1부터 이어지지 않음: {nums}")
    except ValueError:
        err.append(f"숫자가 아닌 각주 번호: {order}")
    cite_ids = {i for _, i in cites}
    for r, backs in p.ref_backlinks.items():
        for b in backs:
            if b[1:] not in cite_ids:
                err.append(f"{r} 의 ↩ 링크 {b} 가 가리키는 본문 각주 없음")
    for r in refs:
        if r not in p.ref_backlinks:
            warn.append(f"{r} 에 ↩ 되돌아가기 링크 없음")
    # 참고문헌에 외부 링크 존재?
    for m in re.finditer(r'<li id="(ref-\d+)">(.*?)</li>', html, re.S):
        if not re.search(r'href="https?://', m.group(2)):
            warn.append(f"{m.group(1)} 에 원문 URL 없음(인쇄본·법령이면 무시)")

    # SVG
    for k, s in enumerate(p.svgs, 1):
        if not s["title"]:
            err.append(f"SVG #{k}: <title> 없음")
        if not s["desc"]:
            err.append(f"SVG #{k}: <desc> 없음")
        bad = s["colors"] - ALLOWED_COLORS
        if bad:
            warn.append(f"SVG #{k}: 팔레트 밖 색상 {sorted(bad)}")
    n_fig = html.count("<figure")
    n_cap = html.count("<figcaption")
    if n_fig != n_cap:
        err.append(f"figure {n_fig}개 중 figcaption {n_cap}개 — 모든 그림에 캡션 필요")
    if len(p.svgs) < 2:
        warn.append(f"SVG가 {len(p.svgs)}개 — 2~5개 권장")

    # 면책·구성
    if "disclaimer" not in html:
        warn.append("면책 문구(class=disclaimer) 없음 — 고위험 주제면 필수")
    if len(refs) < 3:
        warn.append(f"참고문헌 {len(refs)}개 — 근거가 충분한지 확인")
    text = re.sub(r"<[^>]+>", "", re.sub(r"<(svg|style|script)[\s\S]*?</\1>", "", html))
    chars = len(re.sub(r"\s", "", text))
    minutes = round(chars / 600)

    print(f"[요약] 본문 약 {chars:,}자(공백 제외) ≈ {minutes}분 분량 · SVG {len(p.svgs)}개 · 참고문헌 {len(refs)}개 · 각주 {len(cites)}회")
    for e in err:
        print("  ✗ 오류:", e)
    for w in warn:
        print("  △ 경고:", w)
    if not err and not warn:
        print("  ✓ 문제 없음")
    return 1 if err else 0


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    sys.exit(main(sys.argv[1]))
