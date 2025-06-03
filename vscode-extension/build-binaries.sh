#!/bin/bash

# Build script for VS Code extension with embedded binaries
echo "Building cross-platform binaries..."

# Clean previous builds
rm -rf ../bin/cross-platform-tool*
rm -rf bin/cross-platform-tool*
rm -rf bin/prebuilds

# Build all platform binaries from the core with platform-specific native modules
cd ../
npm run build:all

# Create bin directory in vscode-extension if it doesn't exist
mkdir -p vscode-extension/bin

# Copy binaries to extension directory with proper permissions
echo "Copying platform-specific binaries to extension..."
cp bin/cross-platform-tool-linux vscode-extension/bin/
# cp bin/cross-platform-tool-macos vscode-extension/bin/
cp bin/cross-platform-tool-win.exe vscode-extension/bin/

# Copy prebuilds directory to extension for fallback (VS Code extension environment)
echo "Copying native modules for VS Code extension fallback..."
cp -r prebuilds vscode-extension/bin/
echo "Native modules copied to: vscode-extension/bin/prebuilds/"

# Set executable permissions for Unix binaries
chmod +x vscode-extension/bin/cross-platform-tool-linux
chmod +x vscode-extension/bin/cross-platform-tool-macos
chmod +x vscode-extension/bin/cross-platform-tool-win.exe

echo "Platform-specific binaries copied successfully!"
echo "Linux binary: $(ls -la vscode-extension/bin/cross-platform-tool-linux)"
echo "macOS binary: $(ls -la vscode-extension/bin/cross-platform-tool-macos)"
echo "Windows binary: $(ls -la vscode-extension/bin/cross-platform-tool-win.exe)"
echo "Native modules: $(ls -la vscode-extension/bin/prebuilds/)"

# Test the Linux binary
echo ""
echo "Testing Linux binary with platform-specific native modules..."
timeout 5s ./vscode-extension/bin/cross-platform-tool-linux home 2>&1 | head -10
echo "✅ Platform-specific build completed successfully!"