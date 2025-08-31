#!/bin/bash

# VTON Web VPN Setup Script
# This script helps set up the application on a VPN machine

set -e

echo "🚀 VTON Web VPN Setup Script"
echo "=============================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   print_error "This script should not be run as root"
   exit 1
fi

# Check if required files exist
print_info "Checking required files..."

if [ ! -f "serviceAccountKey.template.json" ]; then
    print_error "serviceAccountKey.template.json not found!"
    exit 1
fi

if [ ! -f "ngrok.template.yml" ]; then
    print_error "ngrok.template.yml not found!"
    exit 1
fi

if [ ! -f "env.example" ]; then
    print_error "env.example not found!"
    exit 1
fi

print_success "All template files found"

# Create production configuration
print_info "Setting up production configuration..."

# Create serviceAccountKey.json from template
if [ ! -f "serviceAccountKey.json" ]; then
    print_warning "Creating serviceAccountKey.json from template..."
    cp serviceAccountKey.template.json serviceAccountKey.json
    print_warning "⚠️  IMPORTANT: Edit serviceAccountKey.json with your actual Firebase credentials!"
    print_warning "   This file contains sensitive information and should never be committed to git."
else
    print_success "serviceAccountKey.json already exists"
fi

# Create ngrok.yml from template
if [ ! -f "ngrok.yml" ]; then
    print_warning "Creating ngrok.yml from template..."
    cp ngrok.template.yml ngrok.yml
    print_warning "⚠️  IMPORTANT: Edit ngrok.yml with your actual ngrok authtoken!"
    print_warning "   This file contains sensitive information and should never be committed to git."
else
    print_success "ngrok.yml already exists"
fi

# Create .env from example
if [ ! -f ".env" ]; then
    print_warning "Creating .env from example..."
    cp env.example .env
    print_warning "⚠️  IMPORTANT: Edit .env with your production values!"
    print_warning "   This file contains sensitive information and should never be committed to git."
else
    print_success ".env already exists"
fi

# Create necessary directories
print_info "Creating necessary directories..."
mkdir -p logs/{server,errors,access,api}
mkdir -p static/{temp,logs}
mkdir -p static/uploads/{TryOn_Results,VirtualTryOn_UserPhotos,VirtualTryOn_Images}

# Set proper permissions
chmod 755 logs static
chmod 644 serviceAccountKey.json ngrok.yml .env 2>/dev/null || true

print_success "Directories created"

# Check Docker
print_info "Checking Docker installation..."
if command -v docker &> /dev/null; then
    print_success "Docker is installed"
    
    if command -v docker-compose &> /dev/null; then
        print_success "Docker Compose is installed"
    else
        print_warning "Docker Compose not found. Installing..."
        sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
        sudo chmod +x /usr/local/bin/docker-compose
        print_success "Docker Compose installed"
    fi
else
    print_error "Docker is not installed. Please install Docker first."
    print_info "Visit: https://docs.docker.com/get-docker/"
    exit 1
fi

# Install dependencies
print_info "Installing Node.js dependencies..."
npm install

print_success "Dependencies installed"

# Final instructions
echo ""
echo "🎉 Setup Complete!"
echo "=================="
echo ""
echo "📋 Next Steps:"
echo "1. Edit serviceAccountKey.json with your Firebase credentials"
echo "2. Edit ngrok.yml with your ngrok authtoken"
echo "3. Edit .env with your production environment variables"
echo "4. Run: docker-compose up -d"
echo ""
echo "🔒 Security Notes:"
echo "- serviceAccountKey.json contains Firebase credentials"
echo "- ngrok.yml contains your ngrok authtoken"
echo "- .env contains production environment variables"
echo "- These files are NOT committed to git"
echo ""
echo "📚 For more information, see DEPLOYMENT-CHECKLIST.md"
echo ""
