# 업무 관리 자동화 시스템

개인 업무를 등록·관리하고, 매일 아침 Claude AI가 정리한 TDL(To-Do List)을 이메일로 받는 시스템입니다.

## 기능

- **웹 UI** — 업무 등록/수정/삭제, 프로젝트별 분류, 필터/검색
- **업무 필드** — 제목, 상위 프로젝트, 카테고리, 우선순위, 진행 상태, 마감일, 메모
- **TDL 이메일** — 매일 아침 Claude AI가 이번 주 업무 + 오늘 할 일을 정리해서 발송
- **CLI** — 터미널에서 업무 빠르게 추가/조회

## 설치 방법

### 사전 요구사항
- Node.js 18 이상
- Gmail 계정 (앱 비밀번호 필요)
- Anthropic API Key

### 1. 클론 및 설치

```bash
git clone https://github.com/YOUR_USERNAME/task-manager.git
cd task-manager
npm run setup
```

### 2. 환경 변수 설정

```bash
cp .env.example .env
```

`.env` 파일을 열고 아래 값을 입력합니다:

```
ANTHROPIC_API_KEY=sk-ant-...   # Anthropic 콘솔에서 발급
GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx   # Gmail 앱 비밀번호 (16자리)
```

#### Gmail 앱 비밀번호 발급 방법
1. [Google 계정 보안](https://myaccount.google.com/security) → 2단계 인증 활성화
2. [앱 비밀번호](https://myaccount.google.com/apppasswords) → 앱: 메일 → 기기: 기타
3. 발급된 16자리 비밀번호를 `.env`에 입력

### 3. 실행

```bash
# 웹 UI + 서버 동시 실행
npm run dev
```

브라우저에서 http://localhost:3000 접속 후 **설정** 탭에서 이메일 주소와 API 키를 입력합니다.

## CLI 사용법

```bash
# 전역 설치 (선택)
npm link

# 업무 추가
node cli/task.js add "기획서 작성" --project "샌프란시스코 도시관리" --due 2025-05-20 --priority high

# 오늘 할 일
node cli/task.js today

# 전체 목록
node cli/task.js list

# 프로젝트별 조회
node cli/task.js list --project "샌프란시스코"

# 상태 변경
node cli/task.js status 1 in_progress

# 완료 처리
node cli/task.js done 1

# 삭제
node cli/task.js delete 1

# 프로젝트 목록
node cli/task.js projects
```

## TDL 메일 자동 발송 설정

### macOS / Linux (cron)

```bash
crontab -e
```

아래 줄 추가 (매일 오전 8시):
```
0 8 * * * cd /경로/task-manager && node scripts/sendDailyTDL.js >> logs/mail.log 2>&1
```

### Windows (작업 스케줄러)

1. 작업 스케줄러 열기 → 기본 작업 만들기
2. 트리거: 매일 오전 08:00
3. 동작: 프로그램 시작 → `node`, 인수: `scripts/sendDailyTDL.js`, 시작 위치: 프로젝트 폴더

### 앱 내 스케줄러 사용 (서버 상시 실행 시)

```bash
node scripts/scheduler.js
```

## 폴더 구조

```
task-manager/
├── server/          # Express API 서버
│   ├── index.js
│   └── db.js        # SQLite DB 초기화
├── client/          # React 웹 UI
│   └── src/
│       ├── pages/   # Dashboard, TaskList, Projects, Settings
│       └── components/
├── cli/
│   └── task.js      # CLI 인터페이스
├── scripts/
│   ├── sendDailyTDL.js   # 메일 발송 스크립트
│   └── scheduler.js      # cron 스케줄러
├── data/
│   └── tasks.db     # SQLite DB (자동 생성, git 제외)
└── .env             # 환경 변수 (git 제외)
```

## 문의 / 개선

이슈나 개선 아이디어는 Issues 탭에 남겨주세요.
