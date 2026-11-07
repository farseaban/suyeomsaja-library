# 수염사자의 서재 — 글 올리기와 공개 날 순서

## 글 한 편 올리기

1. `posts/<slug>/` 폴더를 만든다. slug는 영문 소문자·숫자·하이픈만 쓴다(예: `anthropic-fair-value-loss`).
2. `expert-explainer-blog` 스킬이 만든 완성 HTML을 **그대로** `post.html`로 넣는다. 내용은 고치지 않는다.
3. `meta.json`을 쓴다. 분야 이름은 `src/config/site.ts` 목록에 있는 그대로 쓰고, `featured`는 1면 대표로 세울 때만 넣는다.
   ```json
   { "category": "경제", "date": "2026-11-01" }
   ```
4. `npm run check:post -- posts/<slug>`를 실행한다. ✗ 오류가 0이어야 한다. △ 경고는 읽고 판단한다.
   - 이 명령은 스크립트·이벤트 속성·바깥 파일 호출 같은 위험 요소도 함께 본다(`src/lib/post-safety.ts`). 같은 검사가 빌드에서도 돌아, 걸리면 빌드가 멈춘다.
   - `npm run cards -- <slug>`로 공유 카드(`card.png`·`card.txt`)를 그린다. 이 맥의 크롬이 그린다(빌드 서버엔 한글 글꼴이 없다). **제목이나 분야를 고친 뒤에도 다시 돌린다** — 안 돌리면 테스트가 카드와 제목이 다르다고 막는다.
   - 문장을 손보려면 `npm run edit` → `http://localhost:4322`에서 글의 ✎ 편집. 고친 칸만 `post.html`에 저장된다(공개 빌드에는 편집 기능이 실리지 않는다).
5. `npm test`를 실행해 전부 통과하는지 확인한다.
6. `npm run build && npm run preview`로 미리 본다.
7. **사용자가 읽고 "올려"라고 승인한다.** 승인 없이는 커밋·푸시하지 않는다.
8. 커밋한다. 공개 뒤라면 푸시하면 자동 배포된다.

## 공개 날 순서 — 단계마다 사용자 승인 필요

1. **[승인]** 설계 문서(`docs/superpowers/`)와 작업 기록은 올리지 않는다. 그 문서에는 필자를 짐작할 수 있는 내용과 로컬 경로가 있고, 기존 커밋 이력에도 남아 있다. 그래서 이력을 새로 시작한 브랜치로 공개한다.
   ```bash
   git switch --orphan publish &&
   git checkout main -- . &&
   git rm -r --cached -q docs/superpowers && rm -rf docs/superpowers &&
   node_modules/.bin/vitest run .superpowers/publish-scope.test.ts &&
   npm test &&
   git commit -m "수염사자의 서재 첫 공개" &&
   gh repo create farseaban/suyeomsaja-library --public --source . --remote origin &&
   git push -u origin publish:main
   ```
   명령을 `&&`로 이어 두었다. 앞 단계가 실패하면 뒤 단계, 특히 저장소 생성과 푸시가 돌지 않는다. 공개 범위 검사는 이 맥의 `.superpowers/`에만 있어 자동 빌드에서는 돌지 않는다. 그래서 파일을 직접 지목해 돌린다. 파일이 없으면 이 명령이 실패한다.
   설계 문서는 로컬 `main`에만 남는다. 이후 글은 `publish` 브랜치에 커밋하고 이렇게 푸시한다.
   ```bash
   node_modules/.bin/vitest run .superpowers/publish-scope.test.ts && git push origin publish:main
   ```
   로컬 `publish`가 원격 `main`으로 올라가므로 브랜치 이름을 둘 다 적는다.
   푸시 직전 관문도 있다(`tools/git-hooks/pre-push`). `publish` 브랜치의 현재 커밋만 통과시키고, 나갈 이력 전체의 파일·이름·메시지·작성자를 금칙어와 대조하며, 설계 문서가 든 커밋을 거부한다. `publish`에서 `git checkout main -- .`로 코드를 맞췄다면 `docs/superpowers`를 지운 뒤 커밋한다. 이 맥의 `.git/hooks/`에 복사해 설치한다. 새로 내려받은 저장소에는 없으니 그때는 다시 설치한다. 훅을 고치면 다시 복사한다.
2. **[승인]** 저장소 Settings → Pages → Source를 "GitHub Actions"로 바꾼다.
3. **[승인]** 저장소 변수(Settings → Secrets and variables → Actions → Variables)를 넣는다.
   - `SITE_URL=https://farseaban.github.io`
   - `BASE_PATH=/suyeomsaja-library/`
4. **[승인]** Settings → Features에서 Discussions를 켜고, "Announcements" 카테고리를 확인한다.
5. **[승인]** giscus.app에서 저장소를 넣고 받은 값을 변수로 넣는다: `PUBLIC_GISCUS_REPO=farseaban/suyeomsaja-library`, `PUBLIC_GISCUS_REPO_ID`, `PUBLIC_GISCUS_CATEGORY_ID`.
6. **[승인]** Actions 탭에서 `deploy`를 수동 실행하고, `https://farseaban.github.io/suyeomsaja-library/`를 확인한다.
7. **[승인]** `.github/workflows/deploy.yml`의 `on:`에 `push: { branches: [main] }`를 추가한다.
8. **[승인]** 도메인을 샀다면: `public/CNAME`에 도메인 한 줄, 변수 `SITE_URL=https://<도메인>`·`BASE_PATH=/`, DNS에 GitHub Pages 레코드를 넣는다. 댓글은 글 이름에 묶여 있어 주소가 바뀌어도 그 글에 남는다.
9. **[승인]** 정식으로 공개할 때: 변수 `PUBLIC_ALLOW_INDEXING=true`를 넣고 다시 배포한다. 이 변수가 없으면 모든 쪽에 `noindex`가 붙어 검색에 나오지 않는다. 다만 주소를 아는 사람은 볼 수 있고, 저장소도 공개 상태다.

계정 이름 `farseaban`은 Pages 기본 주소·저장소 URL·댓글 화면에 드러난다(설계서 7절).
