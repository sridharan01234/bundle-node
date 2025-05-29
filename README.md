# Cross-Platform Extension

This project demonstrates how to create a cross-platform extension that shares Node.js core logic across VS Code and JetBrains IDEs (IntelliJ IDEA, PhpStorm, etc.).

## Project Structure

- `core/` - Shared Node.js business logic
- `vscode-extension/` - VS Code extension wrapper
- `intellij-adapter/` - JetBrains IDE plugin adapter (Java/Kotlin)

## Features

- Code analysis - Analyze code for potential issues
- Code formatting - Format code according to standards

## How It Works

1. **Shared Core Logic**: Core functionality is written in Node.js/TypeScript and shared across platforms
2. **VS Code Extension**: Directly imports and uses the core functions
3. **IntelliJ Adapter**: Calls the packaged Node.js executable as a subprocess
4. **Standalone CLI**: Can be used independently of any IDE

## Building the Project

### Prerequisites

- Node.js 14+ and npm
- JDK 11+ (for IntelliJ plugin)
- Gradle (for IntelliJ plugin)

### Build Steps

1. **Build the core library:**

   ```bash
   npm install
   npm run build
   ```

2. **Build the CLI tool:**

   ```bash
   npm run package-cli
   ```

   This creates standalone executables in the `bin/` directory.

3. **Build the VS Code extension:**

   ```bash
   cd vscode-extension
   npm install
   npm run compile
   npm run package
   ```

   This creates a `.vsix` file that can be installed in VS Code.

4. **Build the IntelliJ adapter:**
   ```bash
   cd intellij-adapter
   ./gradlew buildPlugin
   ```
   This creates an IntelliJ plugin in the `build/distributions/` directory.

## Usage

### VS Code

1. Install the extension from the `.vsix` file
2. Right-click in an editor and select "Analyze File" or "Format File"

### IntelliJ IDEA / PhpStorm

1. Install the plugin from the `.zip` file in the plugin manager
2. Right-click in an editor and select "Analyze Code"

### CLI Tool

```bash
./bin/cross-platform-tool analyze path/to/file.js
./bin/cross-platform-tool format path/to/file.js
```

## Development Workflow

1. Make changes to the core library
2. Run `npm run build` to compile changes
3. Test in VS Code by running the extension in debug mode
4. Test in IntelliJ by packaging the CLI and running the plugin

## Limitations

- The IntelliJ adapter requires a working Node.js installation or bundling Node.js with the plugin
- UI integration is different for each platform and requires separate maintenance
- Plugin distribution processes differ for VS Code and JetBrains marketplaces
