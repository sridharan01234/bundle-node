#!/bin/bash

# Comprehensive build script for SQLite Database Manager
# Builds everything: core, binaries for all OS, and VS Code extension

set -e  # Exit on any error

echo "🏗️  Starting comprehensive build for SQLite Database Manager..."
echo "================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if required tools are installed
check_dependencies() {
    print_status "Checking dependencies..."
    
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed"
        exit 1
    fi
    
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed"
        exit 1
    fi
    
    print_success "All dependencies are available"
}

# Install npm dependencies
install_dependencies() {
    print_status "Installing dependencies..."
    
    # Install root dependencies
    print_status "Installing root dependencies..."
    npm install
    
    # Install core dependencies
    print_status "Installing core dependencies..."
    cd core
    npm install
    cd ..
    
    # Install vscode-extension dependencies
    print_status "Installing VS Code extension dependencies..."
    cd vscode-extension
    npm install
    cd ..
    
    print_success "All dependencies installed"
}

# Clean previous builds
clean_builds() {
    print_status "Cleaning previous builds..."
    
    # Clean root bin directory
    rm -rf bin/cross-platform-tool*
    
    # Clean core dist
    cd core
    npm run clean 2>/dev/null || true
    cd ..
    
    # Clean vscode-extension builds
    cd vscode-extension
    rm -rf out/
    rm -rf bin/
    rm -rf *.vsix
    cd ..
    
    print_success "Previous builds cleaned"
}

# Build core TypeScript to JavaScript
build_core() {
    print_status "Building core TypeScript..."
    
    cd core
    npm run build
    cd ..
    
    if [ ! -f "core/dist/cli.cjs" ]; then
        print_error "Core build failed - cli.cjs not found"
        exit 1
    fi
    
    print_success "Core built successfully"
}

# Build platform-specific binaries
build_binaries() {
    print_status "Building platform-specific binaries..."
    
    # Create bin directory
    mkdir -p bin
    
    # Check if pkg is installed
    if ! npm list pkg &> /dev/null; then
        print_status "Installing pkg globally..."
        npm install -g pkg
    fi
    
    print_status "Building Linux binary..."
    npm run build:linux
    
    print_status "Building macOS binary..."
    npm run build:macos
    
    print_status "Building Windows binary..."
    npm run build:win
    
    # Verify binaries were created
    if [ -f "bin/cross-platform-tool-linux" ]; then
        chmod +x bin/cross-platform-tool-linux
        print_success "Linux binary created"
    else
        print_error "Linux binary build failed"
        exit 1
    fi
    
    if [ -f "bin/cross-platform-tool-macos" ]; then
        chmod +x bin/cross-platform-tool-macos
        print_success "macOS binary created"
    else
        print_warning "macOS binary not found (may be expected on non-macOS systems)"
    fi
    
    if [ -f "bin/cross-platform-tool-win.exe" ]; then
        print_success "Windows binary created"
    else
        print_error "Windows binary build failed"
        exit 1
    fi
    
    print_success "Platform binaries built successfully"
}

# Prepare VS Code extension
prepare_vscode_extension() {
    print_status "Preparing VS Code extension..."
    
    cd vscode-extension
    
    # Create bin directory in extension
    mkdir -p bin
    
    # Copy binaries to extension directory
    print_status "Copying binaries to extension..."
    cp ../bin/cross-platform-tool-linux bin/ 2>/dev/null || print_warning "Linux binary not found"
    cp ../bin/cross-platform-tool-macos bin/ 2>/dev/null || print_warning "macOS binary not found"
    cp ../bin/cross-platform-tool-win.exe bin/ 2>/dev/null || print_warning "Windows binary not found"
    
    # Copy prebuilds directory for fallback
    print_status "Copying native modules..."
    cp -r ../prebuilds bin/
    
    # Set executable permissions
    chmod +x bin/cross-platform-tool-* 2>/dev/null || true
    
    cd ..
    
    print_success "VS Code extension prepared"
}

# Build VS Code extension
build_vscode_extension() {
    print_status "Building VS Code extension..."
    
    cd vscode-extension
    
    # Compile TypeScript
    print_status "Compiling VS Code extension TypeScript..."
    npm run compile
    
    # Check if vsce is available
    if ! npm list vsce &> /dev/null; then
        print_status "Installing vsce..."
        npm install
    fi
    
    # Package the extension
    print_status "Packaging VS Code extension..."
    npm run package
    
    # Find the generated .vsix file
    VSIX_FILE=$(find . -name "*.vsix" -type f | head -n 1)
    if [ -n "$VSIX_FILE" ]; then
        print_success "VS Code extension packaged: $VSIX_FILE"
        
        # Copy to root for easy access
        cp "$VSIX_FILE" ../
        print_success "Extension copied to root directory"
    else
        print_error "VS Code extension packaging failed"
        exit 1
    fi
    
    cd ..
}

# Test binaries
test_binaries() {
    print_status "Testing built binaries..."
    
    if [ -f "bin/cross-platform-tool-linux" ]; then
        print_status "Testing Linux binary..."
        timeout 5s ./bin/cross-platform-tool-linux home 2>&1 | head -5 || true
    fi
    
    if [ -f "bin/cross-platform-tool-win.exe" ]; then
        print_status "Windows binary available (cannot test on Linux)"
    fi
    
    print_success "Binary testing completed"
}

# Display build summary
show_summary() {
    echo ""
    echo "================================================="
    echo "🎉 Build Summary"
    echo "================================================="
    
    echo "📁 Generated files:"
    
    if [ -f "bin/cross-platform-tool-linux" ]; then
        echo "  ✅ Linux binary: bin/cross-platform-tool-linux"
        echo "     Size: $(du -h bin/cross-platform-tool-linux | cut -f1)"
    fi
    
    if [ -f "bin/cross-platform-tool-macos" ]; then
        echo "  ✅ macOS binary: bin/cross-platform-tool-macos"
        echo "     Size: $(du -h bin/cross-platform-tool-macos | cut -f1)"
    fi
    
    if [ -f "bin/cross-platform-tool-win.exe" ]; then
        echo "  ✅ Windows binary: bin/cross-platform-tool-win.exe"
        echo "     Size: $(du -h bin/cross-platform-tool-win.exe | cut -f1)"
    fi
    
    VSIX_FILE=$(find . -maxdepth 1 -name "*.vsix" -type f | head -n 1)
    if [ -n "$VSIX_FILE" ]; then
        echo "  ✅ VS Code extension: $VSIX_FILE"
        echo "     Size: $(du -h "$VSIX_FILE" | cut -f1)"
    fi
    
    echo ""
    echo "🚀 Usage:"
    echo "  - Install VS Code extension: code --install-extension $VSIX_FILE"
    echo "  - Run Linux binary: ./bin/cross-platform-tool-linux"
    echo "  - Run Windows binary: ./bin/cross-platform-tool-win.exe"
    echo ""
    echo "✨ Build completed successfully!"
}

# Main build process
main() {
    echo "Starting build process..."
    
    check_dependencies
    install_dependencies
    clean_builds
    build_core
    build_binaries
    prepare_vscode_extension
    build_vscode_extension
    test_binaries
    show_summary
}

# Handle script arguments
case "${1:-build}" in
    "clean")
        clean_builds
        ;;
    "deps"|"dependencies")
        install_dependencies
        ;;
    "core")
        build_core
        ;;
    "binaries")
        build_core
        build_binaries
        ;;
    "extension")
        prepare_vscode_extension
        build_vscode_extension
        ;;
    "test")
        test_binaries
        ;;
    "build"|"all"|"")
        main
        ;;
    *)
        echo "Usage: $0 [clean|deps|core|binaries|extension|test|build]"
        echo ""
        echo "Commands:"
        echo "  clean      - Clean previous builds"
        echo "  deps       - Install dependencies only"
        echo "  core       - Build core only"
        echo "  binaries   - Build core and binaries only"
        echo "  extension  - Build VS Code extension only"
        echo "  test       - Test built binaries"
        echo "  build|all  - Full build (default)"
        exit 1
        ;;
esac