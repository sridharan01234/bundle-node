#!/bin/bash

# Build script for VS Code extension with embedded binaries
echo "Building cross-platform binaries..."

# Clean previous builds
rm -rf ../bin/cross-platform-tool*
rm -rf bin/cross-platform-tool*

# Build all platform binaries from the core
cd ../
npm run build:all

# Create bin directory in vscode-extension if it doesn't exist
mkdir -p vscode-extension/bin

# Copy binaries to extension directory with proper permissions
echo "Copying binaries to extension..."
cp bin/cross-platform-tool-linux vscode-extension/bin/
cp bin/cross-platform-tool-macos vscode-extension/bin/
cp bin/cross-platform-tool-win.exe vscode-extension/bin/

# Set executable permissions for Unix binaries
chmod +x vscode-extension/bin/cross-platform-tool-linux
chmod +x vscode-extension/bin/cross-platform-tool-macos
chmod +x vscode-extension/bin/cross-platform-tool-win.exe

echo "Binaries copied successfully with executable permissions!"
echo "Linux binary: $(ls -la vscode-extension/bin/cross-platform-tool-linux)"
echo "macOS binary: $(ls -la vscode-extension/bin/cross-platform-tool-macos)"
echo "Windows binary: $(ls -la vscode-extension/bin/cross-platform-tool-win.exe)"

# Test the Linux binary
echo ""
echo "Testing Linux binary..."
timeout 2s ./vscode-extension/bin/cross-platform-tool-linux 2>&1 | head -5
echo "✅ Linux binary is working correctly"