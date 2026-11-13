@echo off
rem Yaguachi Weather - desarrollo sin Docker para la API y los frontends (Windows).
rem Requisitos: Docker Desktop (solo para PostgreSQL), Python 3.10+ y Node 22+.
rem Antes, una sola vez: copy .env.example .env  y pon una clave larga en POSTGRES_PASSWORD (solo letras y números).
cd /d "%~dp0"
chcp 65001 >nul
for /f "usebackq tokens=1,* delims==" %%a in (".env") do set "%%a=%%b"
if "%PUERTO_DB%"=="" set PUERTO_DB=5433
docker compose up -d --wait db
python -c "import psycopg, psycopg_pool" 2>nul || python -m pip install -r api\requirements.txt
set "DATABASE_URL=postgresql://yaguachi:%POSTGRES_PASSWORD%@127.0.0.1:%PUERTO_DB%/yaguachi"
echo Iniciando la API (8095), la app (5173) y el panel (5174)...
start "API" cmd /k python api\servidor.py --puerto 8095
start "App" cmd /k "cd cliente && npm run dev"
start "Panel" cmd /k "cd admin && npm run dev"
timeout /t 5 >nul
start "" "http://localhost:5173"
start "" "http://localhost:5174"
