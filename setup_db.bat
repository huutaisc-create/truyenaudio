@echo off
echo =================================
echo DANG CAI DAT DATABASE...
echo =================================

echo 0. Cai dat lai phien ban Prisma on dinh...
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] Loi khi chay npm install
    pause
    exit /b %errorlevel%
)

echo 1. Generate Prisma Client
call npx prisma generate
if %errorlevel% neq 0 (
    echo [ERROR] Loi khi chay prisma generate
    pause
    exit /b %errorlevel%
)

echo.
echo 2. Nạp dữ liệu mẫu (Seeding)
call npx prisma db seed
if %errorlevel% neq 0 (
    echo [ERROR] Loi khi chay prisma db seed
    pause
    exit /b %errorlevel%
)

echo.
echo =================================
echo THANH CONG! DATABASE DA SAN SANG.
echo Ban co the quay lai trinh duyet va F5 trang web.
echo =================================
pause
