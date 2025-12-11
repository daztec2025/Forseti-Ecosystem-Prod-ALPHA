@echo off
REM Forseti Production Deployment Script for Windows
REM This script handles the complete deployment process for production

setlocal enabledelayedexpansion

echo 🚀 Starting Forseti Production Deployment...

REM Configuration
set NODE_ENV=production
set BUILD_DIR=.\dist
set API_DIR=.\apps\api
set WEB_DIR=.\apps\web
set ELECTRON_DIR=.\apps\electron

REM Check if required environment variables are set
echo [INFO] Checking environment variables...

if "%JWT_SECRET%"=="" (
    echo [ERROR] JWT_SECRET environment variable is required
    exit /b 1
)

if "%DATABASE_URL%"=="" (
    echo [ERROR] DATABASE_URL environment variable is required
    exit /b 1
)

if "%ALLOWED_ORIGINS%"=="" (
    echo [WARNING] ALLOWED_ORIGINS not set, using default
    set ALLOWED_ORIGINS=https://forseti.app
)

echo [INFO] Environment variables validated ✓

REM Install dependencies
echo [INFO] Installing dependencies...
call npm ci --only=production
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install dependencies
    exit /b 1
)
echo [INFO] Dependencies installed ✓

REM Security check
echo [INFO] Running security checks...
if "%JWT_SECRET%"=="forseti-dev-secret-change-in-production" (
    echo [ERROR] Default JWT secret detected! Please change JWT_SECRET
    exit /b 1
)
echo [INFO] Security checks completed ✓

REM Build applications
echo [INFO] Building applications...

REM Build Web application
echo [INFO] Building web application...
cd %WEB_DIR%
call npm run build
if %errorlevel% neq 0 (
    echo [ERROR] Failed to build web application
    exit /b 1
)
cd ..\..
echo [INFO] Web application built ✓

REM Build Electron application
echo [INFO] Building Electron application...
cd %ELECTRON_DIR%
call npm run build
if %errorlevel% neq 0 (
    echo [ERROR] Failed to build Electron application
    exit /b 1
)
cd ..\..
echo [INFO] Electron application built ✓

REM Run database migrations
echo [INFO] Running database migrations...
cd %API_DIR%
call npx prisma migrate deploy
if %errorlevel% neq 0 (
    echo [ERROR] Failed to run database migrations
    exit /b 1
)
call npx prisma generate
if %errorlevel% neq 0 (
    echo [ERROR] Failed to generate Prisma client
    exit /b 1
)
cd ..\..
echo [INFO] Database migrations completed ✓

REM Create production directory structure
echo [INFO] Creating production directory structure...

if exist %BUILD_DIR% rmdir /s /q %BUILD_DIR%
mkdir %BUILD_DIR%
mkdir %BUILD_DIR%\api
mkdir %BUILD_DIR%\web
mkdir %BUILD_DIR%\electron

REM Copy API files
xcopy %API_DIR%\* %BUILD_DIR%\api\ /E /I /Q

REM Copy web build
if exist %WEB_DIR%\out (
    xcopy %WEB_DIR%\out\* %BUILD_DIR%\web\ /E /I /Q
) else if exist %WEB_DIR%\.next (
    xcopy %WEB_DIR%\.next\* %BUILD_DIR%\web\ /E /I /Q
)

REM Copy Electron build
if exist %ELECTRON_DIR%\dist (
    xcopy %ELECTRON_DIR%\dist\* %BUILD_DIR%\electron\ /E /I /Q
)

echo [INFO] Production structure created ✓

REM Create production package.json
echo [INFO] Creating production package.json...

(
echo {
echo   "name": "forseti-production",
echo   "version": "1.0.0",
echo   "description": "Forseti Esports Performance Analytics Platform",
echo   "main": "api/index.js",
echo   "scripts": {
echo     "start": "cd api && node index.js",
echo     "start:web": "cd web && npm start",
echo     "start:electron": "cd electron && npm start",
echo     "migrate": "cd api && npx prisma migrate deploy",
echo     "health": "curl -f http://localhost:4000/api/health || exit 1"
echo   },
echo   "engines": {
echo     "node": ">=18.0.0",
echo     "npm": ">=8.0.0"
echo   }
echo }
) > %BUILD_DIR%\package.json

echo [INFO] Production package.json created ✓

REM Create Docker configuration
echo [INFO] Creating Docker configuration...

(
echo FROM node:18-alpine
echo.
echo # Install Python for iRacing bridge
echo RUN apk add --no-cache python3 py3-pip
echo.
echo WORKDIR /app
echo.
echo # Copy package files
echo COPY package*.json ./
echo COPY apps/api/package*.json ./api/
echo.
echo # Install dependencies
echo RUN npm ci --only=production
echo.
echo # Copy application files
echo COPY . .
echo.
echo # Build applications
echo RUN cd apps/web && npm run build
echo RUN cd apps/electron && npm run build
echo.
echo # Copy built applications
echo RUN cp -r apps/web/out ./web/ || cp -r apps/web/.next ./web/
echo RUN cp -r apps/electron/dist ./electron/ || true
echo.
echo # Set up database
echo RUN cd api && npx prisma generate
echo.
echo EXPOSE 4000
echo.
echo # Health check
echo HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
echo   CMD curl -f http://localhost:4000/api/health || exit 1
echo.
echo CMD ["npm", "start"]
) > %BUILD_DIR%\Dockerfile

echo [INFO] Docker configuration created ✓

REM Create docker-compose.yml
(
echo version: '3.8'
echo.
echo services:
echo   forseti-api:
echo     build: .
echo     ports:
echo       - "4000:4000"
echo     environment:
echo       - NODE_ENV=production
echo       - JWT_SECRET=%JWT_SECRET%
echo       - DATABASE_URL=file:./data/dev.db
echo       - ALLOWED_ORIGINS=%ALLOWED_ORIGINS%
echo     volumes:
echo       - ./data:/app/data
echo     restart: unless-stopped
echo     healthcheck:
echo       test: ["CMD", "curl", "-f", "http://localhost:4000/api/health"]
echo       interval: 30s
echo       timeout: 10s
echo       retries: 3
echo.
echo   nginx:
echo     image: nginx:alpine
echo     ports:
echo       - "80:80"
echo       - "443:443"
echo     volumes:
echo       - ./nginx.conf:/etc/nginx/nginx.conf
echo       - ./web:/usr/share/nginx/html
echo     depends_on:
echo       - forseti-api
echo     restart: unless-stopped
) > %BUILD_DIR%\docker-compose.yml

echo [INFO] Docker Compose configuration created ✓

REM Create nginx configuration
(
echo events {
echo     worker_connections 1024;
echo }
echo.
echo http {
echo     upstream api {
echo         server forseti-api:4000;
echo     }
echo.
echo     server {
echo         listen 80;
echo         server_name _;
echo.
echo         # Web application
echo         location / {
echo             root /usr/share/nginx/html;
echo             try_files $uri $uri/ /index.html;
echo         }
echo.
echo         # API proxy
echo         location /api/ {
echo             proxy_pass http://api;
echo             proxy_set_header Host $host;
echo             proxy_set_header X-Real-IP $remote_addr;
echo             proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
echo             proxy_set_header X-Forwarded-Proto $scheme;
echo         }
echo.
echo         # Security headers
echo         add_header X-Frame-Options DENY;
echo         add_header X-Content-Type-Options nosniff;
echo         add_header X-XSS-Protection "1; mode=block";
echo     }
echo }
) > %BUILD_DIR%\nginx.conf

echo [INFO] Nginx configuration created ✓

REM Create Windows service script
(
echo @echo off
echo REM Forseti API Windows Service Script
echo set NODE_ENV=production
echo set JWT_SECRET=%JWT_SECRET%
echo set DATABASE_URL=%DATABASE_URL%
echo set ALLOWED_ORIGINS=%ALLOWED_ORIGINS%
echo set PORT=4000
echo cd /d "%~dp0"
echo node api/index.js
) > %BUILD_DIR%\start-service.bat

echo [INFO] Windows service script created ✓

echo.
echo [INFO] Deployment preparation completed! 🎉
echo [INFO] Build directory: %BUILD_DIR%
echo.
echo [INFO] Next steps:
echo [INFO] 1. Copy the %BUILD_DIR% directory to your production server
echo [INFO] 2. Install dependencies: cd %BUILD_DIR% && npm install
echo [INFO] 3. Run migrations: npm run migrate
echo [INFO] 4. Start the service: npm start
echo [INFO] 5. Or use Docker: docker-compose up -d
echo.
echo [INFO] Health check: curl http://localhost:4000/api/health
echo.

pause
