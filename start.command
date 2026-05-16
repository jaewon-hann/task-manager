#!/bin/bash
cd "$(dirname "$0")"
mkdir -p data

# node 경로 설정 (nvm 사용 시)
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# 서버 백그라운드 실행
node server/index.js &
SERVER_PID=$!

# 클라이언트 실행
cd client
npm run dev &
CLIENT_PID=$!

# 3초 후 브라우저 자동 오픈
sleep 3
open http://localhost:3000

echo "✅ 업무 관리 시스템 실행 중"
echo "종료하려면 이 창을 닫으세요"

# 창 닫으면 서버/클라이언트도 같이 종료
trap "kill $SERVER_PID $CLIENT_PID 2>/dev/null" EXIT
wait
