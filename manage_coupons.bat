@echo off
setlocal
chcp 65001 > nul

echo ========================================================
echo       [Visual VN] Beta Key Generator (Coupon Manager)
echo ========================================================
echo.
echo Use this tool to generate coupons for Tumblbug or Friends.
echo.
echo 1. Generate Tumblbug Keys (Batch)
echo 2. Generate Friend/VIP Keys (Custom)
echo 3. Exit
echo.
set /p choice="Select an option (1-3): "

if "%choice%"=="1" goto TUMBLBUG
if "%choice%"=="2" goto FRIEND
if "%choice%"=="3" goto END

:TUMBLBUG
echo.
echo --- Tumblbug Reward Generation ---
echo Enter the Tier Prefix (e.g., ADVENTURER, NOBLE, LORD)
set /p prefix="Prefix: "
echo Enter Quantity (e.g., 100)
set /p count="Quantity: "
echo.
echo Select Reward Type:
echo 1. Adventurer (1500 Tokens + 500 FP)
echo 2. Noble (6000 Tokens + 2000 FP)
echo 3. Custom JSON
set /p rewardType="Selection: "

if "%rewardType%"=="1" set json='{\"tokens\":1500,\"fate_points\":500}'
if "%rewardType%"=="2" set json='{\"tokens\":6000,\"fate_points\":2000}'
if "%rewardType%"=="3" goto CUSTOM_JSON

goto RUN_SCRIPT

:CUSTOM_JSON
echo Enter JSON (e.g., {'tokens':100, 'fate_points':10}): 
set /p json="JSON: "
goto RUN_SCRIPT

:FRIEND
echo.
echo --- Friend/VIP Key Generation ---
echo Enter Name/Prefix (e.g., FRIEND_CHOLSOO)
set /p prefix="Prefix: "
echo Enter Quantity (default 1)
set /p count="Quantity: "
if "%count%"=="" set count=1
echo.
echo Enter Tokens (e.g., 10000)
set /p tokens="Tokens: "
echo Enter Fate Points (e.g., 5000)
set /p fp="Fate Points: "
set json='{\"tokens\":%tokens%,\"fate_points\":%fp%}'
goto RUN_SCRIPT

:RUN_SCRIPT
echo.
echo Running generation script...
echo Command: npx tsx scripts/generate_coupons.ts %prefix% %count% fixed_reward %json%
echo.
call npx tsx scripts/generate_coupons.ts %prefix% %count% fixed_reward %json%

echo.
echo [Done] Check the current directory for the CSV file.
pause
goto END

:END
endlocal
