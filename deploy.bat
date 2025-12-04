@echo off
chcp 65001
echo.
echo === Vercel 배포 자동화 스크립트 ===
echo.

:: Check if Vercel CLI is installed
where vercel >nul 2>nul
if %errorlevel% neq 0 (
    echo [알림] Vercel CLI가 설치되어 있지 않습니다.
    echo [알림] 설치를 진행합니다... (npm install -g vercel)
    call npm install -g vercel
    if %errorlevel% neq 0 (
        echo [오류] Vercel CLI 설치에 실패했습니다. Node.js가 설치되어 있는지 확인해주세요.
        pause
        exit /b
    )
)

echo.
echo [1/2] Vercel 로그인 확인...
echo [알림] 한글 컴퓨터 이름/사용자명으로 인한 오류 방지를 위해 임시 환경변수를 설정합니다.
set "COMPUTERNAME=VercelUser"
set "USERNAME=User"
call vercel login
if %errorlevel% neq 0 (
    echo [오류] 로그인에 실패했거나 취소되었습니다.
    echo [팁] 계속 실패하면 'deployment_guide.md'의 '방법 2: 수동 배포'를 이용해주세요.
    pause
    exit /b
)

echo.
echo [2/2] 프로젝트 배포 시작...
echo.
echo * 주의: 'Set up and deploy?' 질문에는 'Y'를 입력하세요.
echo * 주의: 기존 프로젝트와 연결하려면 설정을 확인하세요.
echo.

call vercel

echo.
echo === 배포 작업이 완료되었습니다 ===
pause
