#!/bin/bash

# Deploy script for Buyer RMG Web App
# Usage: ./deploy.sh [environment]
# Environment: dev, staging, production

set -e

ENVIRONMENT=${1:-production}
BRANCH=${2:-main}

echo "🚀 Starting deployment for environment: $ENVIRONMENT"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ️  $1${NC}"
}

# Check if git is available
if ! command -v git &> /dev/null; then
    print_error "Git is not installed"
    exit 1
fi

# Check if docker is available
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed"
    exit 1
fi

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null; then
    print_error "Docker Compose is not installed"
    exit 1
fi

# Step 1: Pull latest code
print_info "Step 1: Pulling latest code from branch $BRANCH"
git fetch origin
git checkout $BRANCH
git pull origin $BRANCH
print_success "Code updated"

# Step 2: Install dependencies
print_info "Step 2: Installing dependencies"

# Backend dependencies
print_info "Installing backend dependencies..."
cd server
npm ci
print_success "Backend dependencies installed"

# Frontend dependencies
print_info "Installing frontend dependencies..."
cd ../client
npm ci
print_success "Frontend dependencies installed"

cd ..

# Step 3: Run database migrations
print_info "Step 3: Running database migrations"
cd server
npx prisma generate
npx prisma migrate deploy
print_success "Database migrations completed"

cd ..

# Step 4: Build application
print_info "Step 4: Building application"

# Build backend
print_info "Building backend..."
cd server
npm run build
print_success "Backend built"

# Build frontend
print_info "Building frontend..."
cd ../client
npm run build
print_success "Frontend built"

cd ..

# Step 5: Restart services
print_info "Step 5: Restarting services"

if [ "$ENVIRONMENT" = "production" ]; then
    docker-compose down
    docker-compose up -d --build
    print_success "Services restarted"
else
    docker-compose -f docker-compose.dev.yml down
    docker-compose -f docker-compose.dev.yml up -d --build
    print_success "Development services restarted"
fi

# Step 6: Health check
print_info "Step 6: Checking service health"
sleep 5

if curl -f http://localhost:5000/health > /dev/null 2>&1; then
    print_success "Backend is healthy"
else
    print_error "Backend health check failed"
    exit 1
fi

# Step 7: Show status
print_info "Step 7: Deployment status"
docker-compose ps

print_success "Deployment completed successfully! 🎉"
print_info "Backend: http://localhost:5000"
print_info "Frontend: http://localhost:80"



