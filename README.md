# Tennis Mate

테니스 일정을 정리하고, 모임에서 대화하고, Sepolia 테스트 토큰으로 경기 결과와 잔액 순위를 확인하는 모바일 중심 웹 애플리케이션입니다.

## 1. 프로젝트 소개

로그인한 사용자만 대시보드, 모임 채팅, 출석 보상, 경기 토큰 전송, 랭킹, 주변 코트 검색을 사용합니다. 계정마다 Sepolia 지갑 주소가 만들어지고, 개인키는 서버에만 둡니다. TNS는 테스트넷 명예 토큰이며 상업적 가치가 없습니다.

외부 설정이 없으면 해당 기능은 Demo Mode로 두고, 없는 잔액이나 장소를 만들어 보여 주지 않습니다.

## 2. 프로젝트 목적

React와 TypeScript로 인증, 폼 검증, 서버 상태, 실시간 채팅, 지갑 트랜잭션을 한 애플리케이션에서 나누어 구현하는 포트폴리오입니다. 화면은 모바일에서 먼저 쓰고, 태블릿과 데스크톱에서도 같은 정보 구조가 유지됩니다.

## 3. 주요 기능

| 경로 | 기능 |
| --- | --- |
| `/login` | 이메일 8자리 OTP 로그인 |
| `/dashboard` | 프로필, 월간 달력, 일정, 장비, Sepolia 지갑과 ETH/TNS 잔액 |
| `/community` | 모임 생성·참여·나가기, 참여자 채팅 |
| `/rewards` | 서울 날짜 기준 하루 한 번 10 TNS 출석 보상 |
| `/matches` | 패자 지갑에서 승자 지갑으로 TNS 전송 |
| `/ranking` | 등록 사용자의 TNS 잔액 순위 |
| `/courts` | 현재 위치 주변 테니스장 지도와 목록 |

로그인하지 않으면 보호된 경로는 `/login`으로 이동합니다.

## 4. 기술 스택

- React, Vite, TypeScript strict
- React Router, Tailwind CSS
- TanStack Query, Zustand
- Supabase Auth, PostgreSQL, Realtime, Edge Functions
- React Hook Form, Zod
- viem, Sepolia ERC-20
- Google Maps JavaScript API, Places API (New)
- Vitest, React Testing Library
- Vercel 정적 배포 설정

## 5. 아키텍처

브라우저는 anon key로 Supabase에 로그인하고, 본인 행만 RLS로 읽고 씁니다. 다른 사용자의 닉네임이나 랭킹처럼 제한된 공개 정보가 필요하면 security definer 함수가 필요한 컬럼만 돌려줍니다.

지갑 생성, 출석 발행, 경기 전송, 랭킹 잔액 조회는 Edge Function에서 처리합니다. 함수는 JWT로 사용자를 확인한 뒤 service role로 데이터베이스를 갱신합니다. 사용자 개인키와 토큰 발행 키는 함수 비밀과 `wallet_secrets` 밖에 두지 않습니다.

경기 전송은 요청 본문의 지갑 주소를 쓰지 않습니다. 서버가 `matches`와 `profiles`에서 승자 주소를 읽고, 로그인한 사용자가 패자일 때만 그 지갑으로 ERC-20 `transfer`를 보냅니다. 랭킹은 브라우저가 사용자마다 `balanceOf`를 반복 호출하지 않습니다. 서버가 multicall로 잔액을 읽어 스냅샷을 저장하고, 화면은 그 스냅샷을 20명씩 가져옵니다.

## 6. 폴더 구조

```text
src/
  app/                 라우터, Provider, Error Boundary
  components/ui/       Button, Input, Loading, EmptyState, ErrorMessage, Toast
  components/layout/   헤더, 모바일 하단 메뉴, 데스크톱 사이드바
  features/            auth, dashboard, community, rewards, matches, ranking, courts
  hooks/               토스트
  lib/                 Supabase, TanStack Query, viem, 환경 변수
  types/
supabase/migrations/  RLS와 데이터베이스 함수
supabase/functions/   create-wallet, claim-attendance, settle-match, refresh-ranking
contracts/            Tennis Token
tests/
```

화면 컴포넌트는 라우트 페이지, 입력 폼, 목록으로 나눕니다. 페이지는 데이터 조회와 상태 배치를 맡고, 폼은 입력 검증과 제출을 맡습니다. 금액 변환, 채팅 페이지 병합, 랭킹 정렬처럼 화면 없이 검증할 수 있는 규칙은 순수 함수로 분리합니다.

## 7. 실행 방법

Node.js 20 이상이 필요합니다.

```bash
npm install
npm run dev
```

개발 서버는 `http://localhost:5173` 입니다.

| 명령 | 설명 |
| --- | --- |
| `npm run dev` | 개발 서버 |
| `npm run typecheck` | TypeScript 검사 |
| `npm run lint` | oxlint |
| `npm run test` | Vitest |
| `npm run build` | 타입 검사 후 프로덕션 빌드 |
| `npm run preview` | 빌드 결과 미리보기 |

Supabase SQL은 `supabase/migrations` 파일 이름 순서대로 적용합니다. Edge Function은 `create-wallet`, `claim-attendance`, `settle-match`, `refresh-ranking`을 배포합니다. 출석과 전송이 동작하려면 Sepolia에 Tennis Token이 배포되어 있어야 합니다.

```bash
npm run token:compile
MINTER_PRIVATE_KEY='0x...' SEPOLIA_RPC_URL='https://...' npm run token:deploy
```

`MINTER_PRIVATE_KEY`는 현재 셸과 Supabase 비밀에만 둡니다. `VITE_` 변수에 넣지 않습니다.

## 8. 환경 변수

`.env.example`을 `.env` 또는 `.env.local`로 복사합니다. `VITE_` 값은 브라우저 번들에 포함됩니다.

| 변수 | 위치 | 용도 |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | 브라우저 | 프로젝트 URL. `/rest/v1`을 붙이지 않습니다. |
| `VITE_SUPABASE_ANON_KEY` | 브라우저 | anon key |
| `VITE_TOKEN_CONTRACT_ADDRESS` | 브라우저 | 배포된 TNS 계약 주소 |
| `VITE_SEPOLIA_RPC_URL` | 브라우저 | 선택. 비어 있으면 viem 기본 Sepolia RPC |
| `VITE_GOOGLE_MAPS_API_KEY` | 브라우저 | 리퍼러 제한이 있는 Maps 키 |
| `WALLET_ENCRYPTION_KEY` | Edge Function 비밀 | 사용자 개인키 AES-GCM 키 |
| `TOKEN_CONTRACT_ADDRESS` | Edge Function 비밀 | 서버가 사용하는 같은 계약 주소 |
| `MINTER_PRIVATE_KEY` | Edge Function 비밀 | 출석 발행 Owner 키 |
| `SEPOLIA_RPC_URL` | Edge Function 비밀 | 서버 전송과 잔액 조회 |

service role 키는 클라이언트가 설정하지 않습니다. Supabase가 Edge Function에 주입합니다.

## 9. 기술적 의사결정

TanStack Query는 사용자, 일정, 채팅, 잔액, 랭킹처럼 서버에서 오고 무효화가 필요한 데이터를 다룹니다. Zustand는 몇 초 뒤 사라지는 토스트만 다룹니다. 서버 데이터를 전역 저장소에 복사하지 않아서 캐시 무효화와 화면 갱신이 한곳에 남습니다.

채팅은 Supabase Realtime의 `chat_messages` INSERT를 구독합니다. 별도의 소켓 서버 없이, 참여자만 읽을 수 있는 RLS와 같은 권한 경계를 씁니다. 방을 바꾸거나 화면을 닫으면 구독을 해제합니다.

지갑은 서버 관리형입니다. 사용자는 시드 문구를 보관하지 않고, 이메일 로그인만으로 테스트넷 전송을 할 수 있습니다. 개인키는 생성 직후 AES-GCM으로 암호화해 `wallet_secrets`에 저장하고, 브라우저 응답에는 공개 주소만 넣습니다. 전송과 발행은 그 키를 복호화하는 Edge Function에서만 일어납니다.

트랜잭션은 데이터베이스 행의 `pending`, `confirming`, `completed`, `failed`와 화면의 입력, 전송 요청, 처리 중, 블록 확인 중, 성공, 실패로 이어집니다. 해시를 저장한 뒤에 영수증을 기다리고, 아직 확정되지 않은 같은 출석이나 같은 경기는 다시 보내지 않습니다. 성공하면 Etherscan 링크를 보여주고 잔액과 랭킹 쿼리를 갱신합니다.

## 10. 구현하면서 해결한 문제

Supabase 인증 코드가 8자리라서 로그인 검증을 8자리에 맞췄습니다. 일정 시각은 화면에서 기기 시간대로 받고 데이터베이스에는 UTC로 저장합니다. 종료 시각이 시작보다 빠르면 폼과 데이터베이스 제약이 같이 거절합니다.

출석 보상은 사용자가 주소나 수량을 고르지 못합니다. 서울 날짜와 10 TNS는 서버 상수이고, 같은 날의 동시 요청은 행 잠금으로 한 건만 발행합니다. 영수증 확인 전에 실패로 지우면 다시 발행될 수 있어서, 해시가 있는 동안은 확인 중으로 남깁니다.

경기 전송은 패자 본인만 요청할 수 있습니다. 금액은 문자열로 검증한 뒤 `bigint` wei로 바꿉니다. 잔액이 부족하면 오류를 보여주고, 패자의 Sepolia ETH가 없으면 Faucet 링크를 보여 줍니다.

채팅은 최신 20개 뒤에 이전 20개를 붙입니다. 이전 메시지를 불러올 때는 늘어난 높이만큼 스크롤을 보정해 읽던 위치를 유지하고, 실시간으로 도착한 같은 메시지는 한 번만 표시합니다.

랭킹은 조회 시점의 스냅샷을 20명씩 이어 받습니다. 다음 페이지를 불러오는 동안 같은 요청을 다시 보내지 않고, 잔액이 같으면 닉네임과 사용자 ID로 순서를 고정합니다.

## 11. 테스트 방법

```bash
npm run test
npm run typecheck
npm run lint
npm run build
```

Vitest는 외부 API를 호출하지 않습니다. 테스트 모드에서는 Supabase 설정과 토큰 주소를 비워서 로컬 환경 변수로 실제 프로젝트에 접속하지 않습니다. 로그인 폼, 일정 폼과 빈 목록, 채팅 렌더링과 20개 페이지, 출석 버튼 상태, 토큰 전송 실패 화면, 랭킹 정렬과 무한 스크롤, 위치 권한 거부 시 서울시청 안내, 검색 반경 저장을 검증합니다.

## 12. 프로젝트 한계

상대방이 경기 결과에 동의했는지는 확인하지 않습니다. 세트 점수나 경기 기록 검증도 없습니다. 랭킹은 승리 수가 아니라 조회 시점의 TNS 잔액이고, 대규모 인덱서는 만들지 않았습니다. 지갑 키를 서버가 보관하므로 사용자는 키를 직접 내보내거나 외부 지갑으로 바꿀 수 없습니다. 토큰은 Sepolia 전용입니다.

코트 검색은 Google Maps 키와 위치 권한이 필요합니다. 권한을 거부하면 서울시청을 중심으로 보여 주고, 현재 위치가 아님을 표시합니다. 키의 리퍼러 제한에 없는 도메인에서는 지도가 열리지 않습니다.

## 배포 전 확인

`vercel.json`은 모든 경로를 `index.html`로 보내서 새로고침해도 클라이언트 라우트가 유지됩니다. 이 저장소에서 Vercel 프로덕션 배포는 실행하지 않았습니다. 배포할 때는 아래를 직접 설정합니다.

1. Vercel 환경 변수에는 `.env.example`의 `VITE_` 값만 넣습니다. 발행 키, 지갑 암호 키, service role 키는 넣지 않습니다.
2. Supabase Authentication의 Site URL과 Redirect URLs에 배포 도메인과 `http://localhost:5173`을 넣습니다.
3. Google Maps 키의 HTTP 리퍼러에 배포 도메인과 로컬 개발 주소를 넣고, API는 Maps JavaScript API와 Places API (New)만 허용합니다.
4. `supabase/migrations`가 모두 적용되었는지, 네 개의 Edge Function이 배포되었는지 확인합니다. `wallet_secrets`는 클라이언트 권한이 없고, 일정과 장비와 채팅은 본인 또는 참여자만 접근합니다.

빌드 결과물에서 `MINTER_PRIVATE_KEY`, `WALLET_ENCRYPTION_KEY`, `service_role` 문자열이 없어야 합니다.
