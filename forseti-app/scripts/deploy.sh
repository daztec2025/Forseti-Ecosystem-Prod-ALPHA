#!/bin/bash

# Forseti Production Deployment Script
# This script handles the complete deployment process for production

set -e  # Exit on any error

echo "🚀 Starting Forseti Production Deployment..."

# Configuration
NODE_ENV="production"
BUILD_DIR="./dist"
API_DIR="./apps/api"
WEB_DIR="./apps/web"
ELECTRON_DIR="./apps/electron"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if required environment variables are set
check_env() {
    print_status "Checking environment variables..."
    
    if [ -z "$JWT_SECRET" ]; then
        print_error "JWT_SECRET environment variable is required"
        exit 1
    fi
    
    if [ -z "$DATABASE_URL" ]; then
        print_error "DATABASE_URL environment variable is required"
        exit 1
    fi
    
    if [ -z "$ALLOWED_ORIGINS" ]; then
        print_warning "ALLOWED_ORIGINS not set, using default"
        export ALLOWED_ORIGINS="https://forseti.app"
    fi
    
    print_status "Environment variables validated ✓"
}

# Install dependencies
install_deps() {
    print_status "Installing dependencies..."
    npm ci --only=production
    print_status "Dependencies installed ✓"
}

# Build applications
build_apps() {
    print_status "Building applications..."
    
    # Build API (no build step needed for Node.js)
    print_status "API ready for deployment ✓"
    
    # Build Web application
    print_status "Building web application..."
    cd $WEB_DIR
    npm run build
    cd - > /dev/null
    print_status "Web application built ✓"
    
    # Build Electron application
    print_status "Building Electron application..."
    cd $ELECTRON_DIR
    npm run build
    cd - > /dev/null
    print_status "Electron application built ✓"
}

# Run database migrations
migrate_db() {
    print_status "Running database migrations..."
    cd $API_DIR
    npx prisma migrate deploy
    npx prisma generate
    cd - > /dev/null
    print_status "Database migrations completed ✓"
}

# Run security checks
security_check() {
    print_status "Running security checks..."
    
    # Check for common security issues
    if grep -r "password.*=" . --include="*.js" --include="*.ts" | grep -v "process.env"; then
        print_warning "Potential hardcoded passwords found"
    fi
    
    if [ "$JWT_SECRET" = "forseti-dev-secret-change-in-production" ]; then
        print_error "Default JWT secret detected! Please change JWT_SECRET"
        exit 1
    fi
    
    print_status "Security checks completed ✓"
}

# Create production directory structure
create_prod_structure() {
    print_status "Creating production directory structure..."
    
    mkdir -p $BUILD_DIR/api
    mkdir -p $BUILD_DIR/web
    mkdir -p $BUILD_DIR/electron
    
    # Copy API files
    cp -r $API_DIR/* $BUILD_DIR/api/
    
    # Copy web build
    cp -r $WEB_DIR/out/* $BUILD_DIR/web/ 2>/dev/null || cp -r $WEB_DIR/.next $BUILD_DIR/web/
    
    # Copy Electron build
    cp -r $ELECTRON_DIR/dist/* $BUILD_DIR/electron/ 2>/dev/null || true
    
    print_status "Production structure created ✓"
}

# Create production package.json
create_prod_package() {
    print_status "Creating production package.json..."
    
    cat > $BUILD_DIR/package.json << EOF
{
  "name": "forseti-production",
  "version": "1.0.0",
  "description": "Forseti Esports Performance Analytics Platform",
  "main": "api/index.js",
  "scripts": {
    "start": "cd api && node index.js",
    "start:web": "cd web && npm start",
    "start:electron": "cd electron && npm start",
    "migrate": "cd api && npx prisma migrate deploy",
    "health": "curl -f http://localhost:4000/api/health || exit 1"
  },
  "engines": {
    "node": ">=18.0.0",
    "npm": ">=8.0.0"
  },
  "dependencies": {
    "@prisma/client": "^6.16.3",
    "bcrypt": "^5.1.1",
    "cors": "^2.8.5",
    "dotenv": "^16.4.7",
    "express": "^4.21.2",
    "express-rate-limit": "^7.4.1",
    "helmet": "^8.0.0",
    "jsonwebtoken": "^9.0.2",
    "validator": "^13.12.0"
  }
}
EOF
    
    print_status "Production package.json created ✓"
}

# Create systemd service file
create_systemd_service() {
    print_status "Creating systemd service file..."
    
    cat > $BUILD_DIR/forseti.service << EOF
[Unit]
Description=Forseti API Server
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=$(pwd)/$BUILD_DIR
Environment=NODE_ENV=production
Environment=JWT_SECRET=$JWT_SECRET
Environment=DATABASE_URL=$DATABASE_URL
Environment=ALLOWED_ORIGINS=$ALLOWED_ORIGINS
Environment=PORT=4000
ExecStart=/usr/bin/node api/index.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF
    
    print_status "Systemd service file created ✓"
}

# Create Docker configuration
create_docker_config() {
    print_status "Creating Docker configuration..."
    
    cat > $BUILD_DIR/Dockerfile << EOF
FROM node:18-alpine

# Install Python for iRacing bridge
RUN apk add --no-cache python3 py3-pip

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY apps/api/package*.json ./api/

# Install dependencies
RUN npm ci --only=production

# Copy application files
COPY . .

# Build applications
RUN cd apps/web && npm run build
RUN cd apps/electron && npm run build

# Copy built applications
RUN cp -r apps/web/out ./web/ || cp -r apps/web/.next ./web/
RUN cp -r apps/electron/dist ./electron/ || true

# Set up database
RUN cd api && npx prisma generate

EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
  CMD curl -f http://localhost:4000/api/health || exit 1

CMD ["npm", "start"]
EOF

    cat > $BUILD_DIR/docker-compose.yml << EOF
version: '3.8'

services:
  forseti-api:
    build: .
    ports:
      - "4000:4000"
    environment:
      - NODE_ENV=production
      - JWT_SECRET=${JWT_SECRET}
      - DATABASE_URL=file:./data/dev.db
      - ALLOWED_ORIGINS=${ALLOWED_ORIGINS}
    volumes:
      - ./data:/app/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:4000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./web:/usr/share/nginx/html
    depends_on:
      - forseti-api
    restart: unless-stopped
EOF

    print_status "Docker configuration created ✓"
}

# Create nginx configuration
create_nginx_config() {
    print_status "Creating nginx configuration..."
    
    cat > $BUILD_DIR/nginx.conf << EOF
events {
    worker_connections 1024;
}

http {
    upstream api {
        server forseti-api:4000;
    }

    server {
        listen 80;
        server_name _;

        # Web application
        location / {
            root /usr/share/nginx/html;
            try_files \$uri \$uri/ /index.html;
        }

        # API proxy
        location /api/ {
            proxy_pass http://api;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
        }

        # Security headers
        add_header X-Frame-Options DENY;
        add_header X-Content-Type-Options nosniff;
        add_header X-XSS-Protection "1; mode=block";
    }
}
EOF

    print_status "Nginx configuration created ✓"
}

# Main deployment function
main() {
    print_status "Starting Forseti production deployment..."
    
    check_env
    install_deps
    security_check
    build_apps
    migrate_db
    create_prod_structure
    create_prod_package
    create_systemd_service
    create_docker_config
    create_nginx_config
    
    print_status "Deployment preparation completed! 🎉"
    print_status "Build directory: $BUILD_DIR"
    print_status ""
    print_status "Next steps:"
    print_status "1. Copy the $BUILD_DIR directory to your production server"
    print_status "2. Install dependencies: cd $BUILD_DIR && npm install"
    print_status "3. Run migrations: npm run migrate"
    print_status "4. Start the service: npm start"
    print_status "5. Or use Docker: docker-compose up -d"
    print_status ""
    print_status "Health check: curl http://localhost:4000/api/health"
}

# Run main function
main "$@"
