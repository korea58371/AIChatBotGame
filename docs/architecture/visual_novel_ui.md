# 비주얼 노벨 UI 아키텍처 (Visual Novel UI Architecture)

이 문서는 `VisualNovelUI.tsx`의 리팩토링된 구조와 각 모듈의 역할을 설명합니다.

## 1. 개요 (Overview)
기존의 `VisualNovelUI.tsx`는 4500줄 이상의 거대 컴포넌트로, 로직/상태/UI 렌더링이 혼재되어 유지보수가 어려웠습니다.
이를 개선하기 위해 **관심사 분리(Separation of Concerns)** 원칙을 적용하여 다음과 같이 구조를 변경했습니다.

- **상태 관리 분리**: UI 관련 로컬 상태들은 `useVNState` 훅으로 이관
- **오디오 로직 분리**: BGM 및 효과음 처리는 `useVNAudio` 훅으로 이관
- **UI 컴포넌트 분리**: 게임 모드별 HUD와 복잡한 모달(프로필 등)을 별도 컴포넌트로 분리

## 2. 폴더 구조 (Directory Structure)

`src/components/visual_novel/` 디렉토리 하위에 관련 파일들이 정리되어 있습니다.

```text
src/components/visual_novel/
├── hooks/
│   ├── useVNState.ts       # UI 상태 관리 (모달 표시 여부 등)
│   └── useVNAudio.ts       # 오디오/BGM 재생 로직
└── ui/
    ├── common/
    │   ├── ResponseTimer.tsx  # 응답 대기 타이머
    │   └── AdButton.tsx       # 광고/보상 버튼
    ├── ModernHUD.tsx         # 'God Bless You' (현대물) 전용 HUD
    ├── WuxiaHUD.tsx          # 'Cheonha Jeil' (무협물) 전용 HUD
    └── CharacterProfile.tsx  # 캐릭터 상세 정보 모달 (공용)
```

## 3. 핵심 모듈 설명 (Core Modules)

### 3.1. VisualNovelUI.tsx (Orchestrator)
- **역할**: 게임의 메인 오케스트레이터입니다.
- **기능**:
  - `useGameStore`(Zustand)와 연동하여 게임 핵심 데이터 로드
  - 사용자 입력 처리 (`handleSend`)
  - AI 응답에 따른 스크립트 파싱 및 실행
  - 하위 UI 컴포넌트 배치 및 조건부 렌더링

### 3.2. 커스텀 훅 (Custom Hooks)

#### `useVNState`
- **목적**: `VisualNovelUI`의 수많은 `useState`를 캡슐화하여 메인 컴포넌트의 코드를 간결하게 만듭니다.
- **관리하는 상태**:
  - 모달 가시성 (`showInventory`, `showCharacterInfo`, `settingsOpen` 등)
  - UI 상태 (`isPhoneOpen`, `statusMessage` 등)
  - 로딩 상태 (`isProcessing`)

#### `useVNAudio`
- **목적**: 오디오 엘리먼트(`ref`) 관리와 재생 로직을 추상화합니다.
- **기능**:
  - BGM 크로스페이드 (Cross-fade) 지원 (예정/구조적 기반)
  - 절대 경로/상대 경로 BGM 파일 처리
  - 효과음(`playSfx`) 재생 함수 제공

### 3.3. UI 컴포넌트 (UI Components)

#### HUD (Head-Up Display)
게임 장르(Game Mode)에 따라 다른 HUD를 렌더링합니다.

- **ModernHUD**: 현대적인 글래스모피즘(Glassmorphism) 디자인. HP/MP 바가 심플하며 스마트폰 아이콘 등이 포함됨.
- **WuxiaHUD**: 동양적인 텍스처와 폰트 사용. 내공(Neigong), 경지(Realm), 기(Chi) 구슬 등 무협 특화 정보 표시.

#### CharacterProfile
- 기존에 `VisualNovelUI` 내부에 하드코딩 되어있던 500줄 이상의 모달 코드입니다.
- 탭(Tab) 기반 네비게이션을 제공하며, '기본 정보', '무공', '인물 관계'를 표시합니다.
- Framer Motion을 사용하여 부드러운 진입/퇴장 애니메이션을 제공합니다.

## 4. 데이터 흐름 (Data Flow)

```mermaid
graph TD
    Store[Game Store (Zustand)] -->|Core Stats| VN[VisualNovelUI]
    
    subgraph Hooks
        VN -->|Calls| HookState[useVNState]
        VN -->|Calls| HookAudio[useVNAudio]
    end
    
    subgraph UI_Layer
        VN -->|Props: Stats, Name| HUD[ModernHUD / WuxiaHUD]
        VN -->|Props: Data, Affinity| Profile[CharacterProfile]
    end
    
    User[User Input] -->|Action| VN
```

이 구조를 통해 새로운 테마나 기능을 추가할 때 `VisualNovelUI.tsx` 전체를 수정하지 않고, 해당 기능을 담당하는 훅이나 하위 컴포넌트만 수정하면 되므로 확장성이 크게 향상되었습니다.
