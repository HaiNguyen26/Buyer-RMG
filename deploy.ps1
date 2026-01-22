# Deploy script for Buyer RMG Web App (PowerShell)
# Usage: .\deploy.ps1 [environment] [branch]
# Environment: dev, staging, production

param(
    [string]$Environment = "production",
    [string]$Branch = "main"
)

$ErrorActionPreference = "Stop"

Write-Host "🚀 Starting deployment for environment: $Environment" -ForegroundColor Cyan

# Step 1: Pull latest code
Write-Host "Step 1: Pulling latest code from branch $Branch" -ForegroundColor Yellow
git fetch origin
git checkout $Branch
git pull origin $Branch
Write-Host "✅ Code updated" -ForegroundColor Green

# Step 2: Install dependencies
Write-Host "Step 2: Installing dependencies" -ForegroundColor Yellow

# Backend dependencies
Write-Host "Installing backend dependencies..." -ForegroundColor Yellow
Set-Location server
npm ci
Write-Host "✅ Backend dependencies installed" -ForegroundColor Green

# Frontend dependencies
Write-Host "Installing frontend dependencies..." -ForegroundColor Yellow
Set-Location ../client
npm ci
Write-Host "✅ Frontend dependencies installed" -ForegroundColor Green

Set-Location ..

# Step 3: Run database migrations
Write-Host "Step 3: Running database migrations" -ForegroundColor Yellow
Set-Location server
npx prisma generate
npx prisma migrate deploy
Write-Host "✅ Database migrations completed" -ForegroundColor Green

Set-Location ..

# Step 4: Build application
Write-Host "Step 4: Building application" -ForegroundColor Yellow

# Build backend
Write-Host "Building backend..." -ForegroundColor Yellow
Set-Location server
npm run build
Write-Host "✅ Backend built" -ForegroundColor Green

# Build frontend
Write-Host "Building frontend..." -ForegroundColor Yellow
Set-Location ../client
npm run build
Write-Host "✅ Frontend built" -ForegroundColor Green

Set-Location ..

# Step 5: Restart services
Write-Host "Step 5: Restarting services" -ForegroundColor Yellow

if ($Environment -eq "production") {
    docker-compose down
    docker-compose up -d --build
    Write-Host "✅ Services restarted" -ForegroundColor Green
} else {
    docker-compose -f docker-compose.dev.yml down
    docker-compose -f docker-compose.dev.yml up -d --build
    Write-Host "✅ Development services restarted" -ForegroundColor Green
}

# Step 6: Health check
Write-Host "Step 6: Checking service health" -ForegroundColor Yellow
Start-Sleep -Seconds 5

try {
    $response = Invoke-WebRequest -Uri "http://localhost:5000/health" -UseBasicParsing -TimeoutSec 5
    if ($response.StatusCode -eq 200) {
        Write-Host "✅ Backend is healthy" -ForegroundColor Green
    } else {
        Write-Host "❌ Backend health check failed" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Backend health check failed: $_" -ForegroundColor Red
    exit 1
}

# Step 7: Show status
Write-Host "Step 7: Deployment status" -ForegroundColor Yellow
docker-compose ps

Write-Host "✅ Deployment completed successfully! 🎉" -ForegroundColor Green
Write-Host "Backend: http://localhost:5000" -ForegroundColor Cyan
Write-Host "Frontend: http://localhost:80" -ForegroundColor Cyan




