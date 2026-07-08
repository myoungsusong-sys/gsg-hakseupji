# 깊은생각 학습지 앱

## 학생앱 (1단계 코어)

- 해시 라우트 `#/student/*` — 학습 홈·학습지 목록·풀기(임시저장)·결과·보충학습(오답/심화).
- 학생 계정: 이메일 규약 `s-<loginId>@student.gsg.app` (loginId = 학생 loginId 또는 출결번호).
  로그인 화면 [학생] 탭에서 아이디(출결번호)+비밀번호로 로그인.
- **계정 일괄 생성**: `node scripts/create-student-accounts.mjs` — 사용법·환경변수(A: service key / B: signup-enabled)는
  스크립트 상단 주석 참고. `--dry-run`으로 먼저 대상 확인. 생성 시 학생 레코드에 `authEmail`이 기록된다.
- 로컬 모드(supabase 환경변수 없음): `#/student-login`에서 학생 이름+출결번호로 입장 (개발·검증용).
- 학생앱 공개 설정: hj_settings `studentAppConfig` = `{ showAnswer, showSolution, showVideo }` (기본 전부 true).

---

# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.
