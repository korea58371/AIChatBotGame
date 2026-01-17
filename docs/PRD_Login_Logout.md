# Product Specification Document: Login & Account Management

## 1. 개요 (Overview)
본 문서는 "AIChatBotGame"의 사용자 인증(Login), 로그아웃(Logout), 그리고 계정 관리(Account Management) 기능에 대한 명세를 정의한다.  
시스템은 **게스트(Guest)** 모드와 **이메일/소셜 로그인(User)** 모드를 모두 지원하며, 게스트 유저가 데이터를 유실하지 않고 정식 계정으로 전환(Link)할 수 있는 기능을 포함한다.

## 2. 사용자 분류 (User Roles)

| 역할 (Role) | 설명 (Description) | 데이터 지속성 |
| :--- | :--- | :--- |
| **Guest (비회원)** | 로그인 절차 없이 게임을 시작한 사용자. `is_anonymous: true`. | 브라우저 쿠키/스토리지 삭제 시 데이터 유실 위험 있음. |
| **User (회원)** | 이메일 또는 소셜 계정으로 로그인한 사용자. `is_anonymous: false`. | DB에 영구 저장되며 기기 간 연동 가능. |

## 3. 기능 요구사항 (Functional Requirements)

### 3.1 게스트 로그인 (Guest Login)
- **진입점**: 메인 타이틀 화면.
- **동작**: 사용자가 로그인 없이 "게임 시작" 버튼 등을 누를 경우, 백그라운드에서 익명 인증(Anonymous Auth)이 수행되어야 한다.
- **식별**: `user.id`가 생성되지만 `email`은 없을 수 있으며, 시스템 내부적으로 `is_anonymous: true`로 식별한다.

### 3.2 소셜/이메일 로그인 (Social/Email Login)
- **진입점**: 메인 타이틀 화면 또는 설정(Settings) 메뉴의 "Login / Sign Up" 버튼.
- **동작**: Supabase Auth를 통해 Google, Kakao 등 OAuth 제공자 또는 이메일로 인증한다.
- **성공 처리**: 인증 성공 시 `auth/callback` 라우트를 거쳐 세션 쿠키가 발급되며, 이전 페이지(`next` 파라미터)로 리다이렉트된다.

### 3.3 로그아웃 (Logout)
- **대상**: 모든 로그인 된 사용자 (Guest 및 User).
- **진입점**: 설정(Settings) 메뉴 > 계정(Account) 탭 > "로그아웃" 버튼.
- **Guest 로그아웃**:
  - 버튼 명: "게스트 종료 (Logout)"
  - 동작: 현재 게스트 세션을 종료하고 메인 화면으로 이동한다. **주의**: 계정 연동을 하지 않은 경우 데이터가 유실될 수 있음을 고지해야 한다 (UI 텍스트 참조).
- **User 로그아웃**:
  - 버튼 명: "로그아웃 (Logout)"
  - 동작: 현재 세션을 종료하고 메인 화면으로 이동한다. 데이터는 보존된다.

### 3.4 계정 연동 (Account Linking / Upgrade)
- **대상**: 현재 Guest 상태인 사용자.
- **진입점**: 설정(Settings) 메뉴 > 계정(Account) 탭 > "계정 연동하기 (Link Account)" 버튼.
- **동작**:
  - 사용자가 버튼 클릭 시 로그인 페이지로 이동한다.
  - 로그인 성공 시, 현재 Guest 세션의 데이터를 유지한 채로 인증된 User 계정으로 전환되어야 한다.
  - **정책**: "게스트 계정은 브라우저 쿠키 삭제 시 정보가 유실될 수 있습니다."라는 경고 문구를 표시한다.

### 3.5 회원 탈퇴 (Withdrawal / Delete Account)
- **대상**: User (회원) 상태인 사용자.
- **진입점**: 설정(Settings) 메뉴 > 계정(Account) 탭 > "회원 탈퇴 (Withdrawal)" 버튼.
- **동작**:
  1. 사용자에게 "현재 진행 상황을 모두 초기화합니다" 등의 확인 팝업(Confirm)을 띄운다.
  2. 확인 시 서버 액션 `deleteAccount()`를 호출한다.
  3. **Backend Logic** (`deleteAccount`):
     - `profiles` 테이블에서 사용자 데이터 삭제 (Soft/Hard Delete).
     - `gameplay_logs`, `saves` 등 연관 데이터 Hard Delete.
     - `auth.admin.deleteUser`를 호출하여 인증 계정 영구 삭제.
     - 세션 로그아웃 처리.
  4. 완료 후 메인 화면으로 리다이렉트된다.

## 4. UI/UX 명세 (UI specifications)

### 4.1 설정 모달 (Settings Modal) - 계정 탭
- **경로**: `src/components/visual_novel/ui/SettingsModal.tsx`
- **상태 표시 (Status Display)**:
  - 로그인 안 됨: "Not Logged In"
  - Guest: "Guest ID" 라벨 및 "Guest#1234..." 형태의 ID 표시.
  - User: "Email" 라벨 및 유저 이메일 표시.
- **재화 표시 (Coins)**:
  - 로그인 상태(Guest 포함)일 때만 현재 보유 코인(Golden Coin)을 표시한다.
- **액션 버튼 분기**:
  - **Case 1: 로그인 안 됨** -> "Login / Sign Up" 버튼 노출.
  - **Case 2: Guest** -> "계정 연동하기" (강조됨) 및 "게스트 종료" 버튼 노출. 경고 문구 포함.
  - **Case 3: User** -> "로그아웃" 및 "회원 탈퇴" 버튼 노출 (회원 탈퇴는 붉은색 Danger style).

## 5. 기술적 제약 사항 (Technical Constraints)
- **Auth Provider**: Supabase Auth (SSR).
- **Environment**:
  - 개발 환경(`development`)에서는 쿠키의 `secure` 옵션을 `false`로 설정하여 `localhost` 동작을 보장해야 한다.
- **Server Action**: 회원 탈퇴와 같은 민감한 작업은 반드시 Server Action(`use server`)으로 처리하며, Service Role Key를 사용하여 RLS를 우회, 확실한 데이터 삭제를 보장해야 한다.
- **Client State**: `useGameStore` 및 `SettingsModal` 내부 로컬 상태를 통해 UI가 즉각적으로 반응해야 한다.

## 6. 테스트 시나리오 (Test Scenarios for TestSprite)
1. **게스트 로그인 테스트**: 비로그인 상태에서 게임 진입 시 게스트 ID 생성 및 세션 유지 확인.
2. **로그아웃 테스트 (User)**: 이메일 로그인 후 로그아웃 시 세션 파기 및 메인 리다이렉트 확인.
3. **로그아웃 테스트 (Guest)**: 게스트 상태에서 로그아웃 시 경고 문구 확인 및 세션 종료 확인.
4. **회원 탈퇴 테스트**: 회원 탈퇴 실행 시 DB 데이터 삭제 및 Auth User 삭제 확인.
5. **UI 상태 동기화**: 로그인/로그아웃 직후 설정 모달의 상태(Status, Coin)가 올바르게 갱신되는지 확인.
