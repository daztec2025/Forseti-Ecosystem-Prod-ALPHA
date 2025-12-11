# Forseti Electron App Deployment Plan

## Overview
Deploy the Forseti Electron app for test users with a production-ready backend on Azure, PostgreSQL database, auto-updates via GitHub Releases, and CI/CD pipelines via Azure DevOps.

---

## Phase 0: Azure Environment Setup (From Scratch)

### 0.1 Azure Account & Subscription
1. **Create Azure Account** at https://azure.microsoft.com
   - Free tier includes $200 credit for 30 days
   - After that, pay-as-you-go pricing applies
2. **Create a Subscription** (if not already done)
   - Go to Azure Portal > Subscriptions > Add
   - Choose "Pay-As-You-Go" for flexibility
3. **Create a Resource Group** to organize all Forseti resources
   - Azure Portal > Resource Groups > Create
   - Name: `forseti-production` (or `forseti-test` for testing)
   - Region: Choose closest to your users (e.g., UK South, West Europe)

### 0.2 Recommended Tier & Pricing Summary

| Resource | Tier | Specs | Est. Monthly Cost |
|----------|------|-------|-------------------|
| **App Service (API)** | B1 Basic | 1 core, 1.75 GB RAM, 10 GB storage | ~$55/month |
| **PostgreSQL DB** | B1ms Burstable | 1 vCore, 2 GB RAM | ~$12/month |
| **PostgreSQL Storage** | Premium SSD | 32 GB (expandable) | ~$4/month |
| **Total** | | | **~$71/month** |

**For Testing Phase:** Start with these minimal tiers. You can scale up later.

**Cost-Saving Tips:**
- PostgreSQL can be stopped when not in use (only pay for storage)
- B1ms is burstable - fine for low traffic, upgrade to B2s (~$25/mo) if needed
- Consider Azure Dev/Test pricing if you have Visual Studio subscription

### 0.3 Step-by-Step Azure Resource Creation

#### Step 1: Create Resource Group
```
Azure Portal > Resource Groups > Create
- Subscription: [Your subscription]
- Resource group: forseti-production
- Region: UK South (or your preferred region)
```

#### Step 2: Create Azure Database for PostgreSQL Flexible Server
```
Azure Portal > Create a resource > "Azure Database for PostgreSQL"
- Select "Flexible Server"

Basics:
- Resource group: forseti-production
- Server name: forseti-db (will become forseti-db.postgres.database.azure.com)
- Region: Same as resource group
- PostgreSQL version: 16
- Workload type: Development (selects Burstable tier)
- Compute + storage: Click "Configure server"
  - Compute tier: Burstable
  - Compute size: Standard_B1ms (1 vCore, 2 GiB RAM) - ~$12/mo
  - Storage: 32 GiB (~$4/mo)

Authentication:
- Authentication method: PostgreSQL authentication only
- Admin username: forsetiadmin
- Password: [Generate strong password - SAVE THIS]

Networking:
- Connectivity method: Public access
- Allow public access: Yes
- Firewall rules:
  - Add current client IP (for development)
  - Check "Allow public access from any Azure service"

Review + Create > Create
```

#### Step 3: Create Azure App Service for API
```
Azure Portal > Create a resource > "Web App"

Basics:
- Resource group: forseti-production
- Name: forseti-api (will become forseti-api.azurewebsites.net)
- Publish: Code
- Runtime stack: Node 22 LTS
- Operating System: Linux (cheaper than Windows)
- Region: Same as database

Pricing:
- Linux Plan: Create new
- Sku and size: Basic B1 (~$55/mo for Linux)
  - 1 vCPU, 1.75 GB memory, 10 GB storage

Deployment:
- Enable basic authentication: Yes (for deployment)

Monitoring:
- Enable Application Insights: Yes (recommended for debugging)

Review + Create > Create
```

#### Step 4: Configure App Service Environment Variables
```
Azure Portal > App Service (forseti-api) > Settings > Configuration

Application settings (Add each):
- DATABASE_URL = postgresql://forsetiadmin:[password]@forseti-db.postgres.database.azure.com:5432/forseti?sslmode=require
- NODE_ENV = production
- JWT_SECRET = [generate 64-char random string]
- ALLOWED_ORIGINS = https://forseti.app,https://www.forseti.app
- PORT = 8080
- BCRYPT_ROUNDS = 12

Save > Restart app
```

#### Step 5: Create the Database
```
Connect to PostgreSQL and create database:
- Use Azure Cloud Shell or local psql:
  psql "host=forseti-db.postgres.database.azure.com port=5432 dbname=postgres user=forsetiadmin password=[password] sslmode=require"

- Run: CREATE DATABASE forseti;
```

### 0.4 Azure DevOps Setup
```
1. Go to https://dev.azure.com
2. Create new organization (or use existing)
3. Create new project: "Forseti"
4. Repos > Import your GitHub repository (or connect to GitHub)
5. Pipelines > Create pipeline (we'll configure in Phase 6)
```

### 0.5 Connect Azure DevOps to Azure Subscription
```
Azure DevOps > Project Settings > Service connections
- New service connection > Azure Resource Manager
- Service principal (automatic)
- Select your subscription and resource group
- Name: azure-forseti-connection
```

---

## Phase 1: Database Migration (SQLite to PostgreSQL)

### 1.1 Azure Database Already Created Above
- Connection string format: `postgresql://forsetiadmin:[password]@forseti-db.postgres.database.azure.com:5432/forseti?sslmode=require`

### 1.2 Update Prisma Configuration
**File: `/apps/api/prisma/schema.prisma`**
```prisma
datasource db {
  provider = "postgresql"  // Change from "sqlite"
  url      = env("DATABASE_URL")
}
```

### 1.3 Migrate Data
- Create new migration: `npx prisma migrate dev --name postgresql_migration`
- Test locally with a local PostgreSQL instance first
- Export existing SQLite data if needed (users, activities, etc.)
- Run `npx prisma migrate deploy` against Azure PostgreSQL

### 1.4 Update Environment Configuration
**File: `/apps/api/.env.production`** (new file)
```
DATABASE_URL="postgresql://user:password@forseti-db.postgres.database.azure.com:5432/forseti?sslmode=require"
```

---

## Phase 2: API Production Readiness

### 2.1 Security Configuration
**File: `/apps/api/config.js`** - Update for production:
- Generate secure JWT_SECRET (32+ character random string)
- Set ALLOWED_ORIGINS to production domains
- Configure rate limiting values

**File: `/apps/api/.env.production`**
```
NODE_ENV=production
JWT_SECRET=<generate-secure-random-string>
ALLOWED_ORIGINS=https://forseti.app,https://www.forseti.app
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
AUTH_RATE_LIMIT_MAX_REQUESTS=5
BCRYPT_ROUNDS=12
```

### 2.2 Rate Limiting Enhancement
Rate limiting is already implemented in `/apps/api/index.js` (lines 178-198) but only activates in production. Verify configuration:
- Global: 100 requests per 15 minutes
- Auth endpoints: 5 requests per 15 minutes

### 2.3 Production Logging
Add structured logging for Azure App Service monitoring:
- Install: `npm install winston`
- Configure log levels and Azure integration

---

## Phase 3: Deploy API to Azure App Service

### 3.1 Create Azure Resources
1. Create Azure App Service (Node.js 18 LTS)
2. Configure deployment slots (staging + production)
3. Set up Application Insights for monitoring

### 3.2 Configure App Service Settings
In Azure Portal > App Service > Configuration:
```
DATABASE_URL=<postgresql-connection-string>
NODE_ENV=production
JWT_SECRET=<secure-secret>
ALLOWED_ORIGINS=https://forseti.app
PORT=8080
```

### 3.3 Update Frontend API Configuration
**File: `/apps/web/app/lib/api.ts`** (line 59) - Already uses env var:
```typescript
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'
```

**File: `/apps/web/.env.production`** (new file)
```
NEXT_PUBLIC_API_URL=https://forseti-api.azurewebsites.net
```

### 3.4 Update Electron Hardcoded URLs
**File: `/apps/electron/main.js`**
- Line 128: Change production URL to your domain
- Line 630, 706, 782, 1119: Replace hardcoded `localhost:4000` with environment-aware configuration

Create config module for Electron:
**File: `/apps/electron/config.js`** (new file)
```javascript
const isDev = process.env.NODE_ENV === 'development'

module.exports = {
  API_URL: isDev ? 'http://localhost:4000' : 'https://forseti-api.azurewebsites.net',
  WEB_URL: isDev ? 'http://localhost:3000' : 'https://forseti.app'
}
```

---

## Phase 4: Electron Auto-Update System

### 4.1 Install electron-updater
```bash
cd apps/electron
npm install electron-updater
```

### 4.2 Configure electron-builder for GitHub Releases
**File: `/apps/electron/package.json`** - Add publish config:
```json
{
  "build": {
    "publish": {
      "provider": "github",
      "owner": "your-github-username",
      "repo": "forseti-app"
    }
  }
}
```

### 4.3 Implement Auto-Update in Main Process
**File: `/apps/electron/main.js`** - Add at top:
```javascript
const { autoUpdater } = require('electron-updater')

// Configure auto-updater
autoUpdater.autoDownload = true
autoUpdater.autoInstallOnAppQuit = true

// Check for updates on app ready
app.whenReady().then(() => {
  if (!isDev) {
    autoUpdater.checkForUpdatesAndNotify()
  }
})

// Auto-updater events
autoUpdater.on('update-available', () => {
  mainWindow?.webContents.send('update-available')
})

autoUpdater.on('update-downloaded', () => {
  mainWindow?.webContents.send('update-downloaded')
})
```

### 4.4 Add Update UI Notification
Expose update events via preload.js and show notification in the web app when update is ready.

---

## Phase 5: Build Electron Executable

### 5.1 Fix Hardcoded Paths
**File: `/apps/electron/main.js`** (line 555)
- Remove hardcoded Python path
- Bundle Python bridge with the app OR detect system Python

### 5.2 Bundle iRacing Bridge
Option A: Bundle with PyInstaller
```bash
cd forseti-iracing-bridge
pyinstaller --onefile main.py -n forseti-bridge
```
Then include the .exe in electron-builder extraFiles.

Option B: Detect system Python (less reliable)

### 5.3 Build Commands
```bash
# Windows NSIS installer
npm run build:win

# Output: apps/electron/dist/Forseti Setup x.x.x.exe
```

### 5.4 Code Signing (When Certificate Available)
**File: `/apps/electron/package.json`**
```json
{
  "build": {
    "win": {
      "certificateFile": "./certs/certificate.pfx",
      "certificatePassword": "${WIN_CSC_KEY_PASSWORD}"
    }
  }
}
```

---

## Phase 6: Azure DevOps CI/CD Pipeline

### 6.1 Create Azure DevOps Project
- Create new project in Azure DevOps
- Connect to your GitHub repository

### 6.2 API Deployment Pipeline
**File: `/azure-pipelines-api.yml`** (new file)
```yaml
trigger:
  branches:
    include:
      - main
  paths:
    include:
      - apps/api/**

pool:
  vmImage: 'ubuntu-latest'

stages:
  - stage: Build
    jobs:
      - job: BuildAPI
        steps:
          - task: NodeTool@0
            inputs:
              versionSpec: '22.x'
          - script: |
              cd apps/api
              npm ci
              npx prisma generate
            displayName: 'Install dependencies'
          - task: ArchiveFiles@2
            inputs:
              rootFolderOrFile: 'apps/api'
              archiveFile: '$(Build.ArtifactStagingDirectory)/api.zip'
          - publish: $(Build.ArtifactStagingDirectory)/api.zip
            artifact: api

  - stage: Deploy
    dependsOn: Build
    jobs:
      - deployment: DeployAPI
        environment: 'production'
        strategy:
          runOnce:
            deploy:
              steps:
                - task: AzureWebApp@1
                  inputs:
                    azureSubscription: '<your-subscription>'
                    appName: 'forseti-api'
                    package: '$(Pipeline.Workspace)/api/api.zip'
```

### 6.3 Electron Build Pipeline
**File: `/azure-pipelines-electron.yml`** (new file)
```yaml
trigger:
  tags:
    include:
      - 'v*'

pool:
  vmImage: 'windows-latest'

steps:
  - task: NodeTool@0
    inputs:
      versionSpec: '22.x'

  - script: |
      cd apps/electron
      npm ci
    displayName: 'Install dependencies'

  - script: |
      cd apps/electron
      npm run build:win
    displayName: 'Build Electron app'
    env:
      GH_TOKEN: $(GITHUB_TOKEN)

  - task: GitHubRelease@1
    inputs:
      gitHubConnection: '<github-connection>'
      repositoryName: '$(Build.Repository.Name)'
      action: 'edit'
      target: '$(Build.SourceVersion)'
      tag: '$(Build.SourceBranchName)'
      assets: 'apps/electron/dist/*.exe'
      addChangeLog: false
```

### 6.4 Pipeline Variables (Secrets)
Configure in Azure DevOps > Pipelines > Library:
- `GITHUB_TOKEN` - For publishing releases
- `WIN_CSC_KEY_PASSWORD` - Code signing password (when available)
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Production JWT secret

---

## Phase 7: Release Workflow

### 7.1 Version Bumping
```bash
cd apps/electron
npm version patch  # or minor/major
git push && git push --tags
```

### 7.2 Release Process
1. Bump version in `apps/electron/package.json`
2. Create git tag: `git tag v1.0.0`
3. Push tag: `git push --tags`
4. Azure DevOps pipeline triggers automatically
5. Builds Windows executable
6. Publishes to GitHub Releases
7. Users receive auto-update notification

---

## Critical Files to Modify

| File | Changes Required |
|------|-----------------|
| `/apps/api/prisma/schema.prisma` | Change provider to postgresql |
| `/apps/api/.env.production` | New file - production environment vars |
| `/apps/api/config.js` | Verify production validation |
| `/apps/web/.env.production` | New file - NEXT_PUBLIC_API_URL |
| `/apps/electron/main.js` | Add auto-updater, fix hardcoded URLs/paths |
| `/apps/electron/package.json` | Add publish config, electron-updater |
| `/apps/electron/preload.js` | Expose update events |
| `/apps/electron/config.js` | New file - centralized config |
| `/azure-pipelines-api.yml` | New file - API deployment |
| `/azure-pipelines-electron.yml` | New file - Electron build |

---

## Estimated Order of Implementation

1. **Phase 0: Azure Setup** - Create Azure account, resource group, PostgreSQL, App Service
2. **Phase 1: Database Migration** - PostgreSQL setup and Prisma migration
3. **Phase 2: API Security** - Environment config, rate limiting verification
4. **Phase 3: Azure Deployment** - App Service setup, deploy API
5. **Phase 4: Auto-Update** - Install electron-updater, implement update flow
6. **Phase 5: Build Executable** - Bundle Python bridge, create installer
7. **Phase 6: CI/CD Pipelines** - Set up Azure DevOps automation
8. **Phase 7: Test Release** - Full end-to-end test with test users
