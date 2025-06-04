# Bundle Node - Cross-Platform Code Analysis Tool

A comprehensive code analysis and formatting tool that provides unified functionality across Visual Studio Code, JetBrains IDEs, and command-line interfaces. Built with Node.js/TypeScript core logic and packaged as standalone executables for cross-platform distribution.

## 🚀 Features

- **Code Analysis**: Analyze JavaScript/TypeScript code for potential issues and improvements
- **Code Formatting**: Format code according to standards with consistent style
- **SQLite3 Database Integration**: Persistent data storage with CRUD operations
- **Cross-Platform Support**: Works on Linux, macOS, and Windows
- **Multiple Interfaces**: CLI, HTTP API, and VS Code extension
- **Unified Solution**: Same core functionality across all platforms

## 📁 Project Structure

```
bundle-node/
├── core/                          # Core Node.js application
│   ├── src/
│   │   ├── cli.ts                # Main CLI entry point
│   │   ├── cli/
│   │   │   └── CLIApplication.ts # CLI application class
│   │   ├── commands/             # Command handlers
│   │   │   ├── AnalyzeCommand.ts # Code analysis command
│   │   │   ├── CommandRegistry.ts# Command registration system
│   │   │   ├── FormatCommand.ts  # Code formatting command
│   │   │   ├── HomeCommand.ts    # Database operations command
│   │   │   ├── ServerCommand.ts  # HTTP server command
│   │   │   └── index.ts          # Command exports
│   │   ├── database/             # Database operations
│   │   │   └── DatabaseManager.ts# SQLite database management
│   │   ├── server/               # HTTP server
│   │   │   └── HttpServer.ts     # HTTP server implementation
│   │   ├── types/                # TypeScript interfaces
│   │   │   └── index.ts          # Type definitions
│   │   └── utils/                # Utility functions
│   │       ├── code-actions.ts   # Code analysis/formatting functions
│   │       ├── DatabaseOperations.ts # Database utilities
│   │       ├── FileValidator.ts  # File validation utilities
│   │       └── index.ts          # Common utilities and native module loading
│   ├── esbuild.config.js         # Build configuration
│   ├── package.json              # Core dependencies and scripts
│   └── tsconfig.json             # TypeScript configuration
├── vscode-extension/              # VS Code extension
│   ├── src/
│   │   ├── extension.ts          # Main entry point
│   │   ├── config/
│   │   │   └── ConfigManager.ts  # Platform detection & configuration
│   │   ├── services/
│   │   │   └── DatabaseService.ts# Database operations & binary communication
│   │   ├── types/
│   │   │   └── index.ts          # Type definitions
│   │   ├── utils/
│   │   │   ├── Logger.ts         # Logging utilities
│   │   │   └── UIUtils.ts        # UI helper functions
│   │   └── webview/
│   │       └── WebviewManager.ts # Webview management
│   ├── bin/                      # Bundled executables (copied from root)
│   ├── media/                    # Extension assets
│   ├── esbuild.js                # Build script
│   ├── package.json              # Extension manifest
│   └── tsconfig.json             # TypeScript configuration
├── intellij-adapter/              # IntelliJ plugin adapter (Java/Kotlin)
│   ├── src/main/java/            # Java plugin implementation
│   ├── build.gradle              # Gradle build configuration
│   ├── gradlew                   # Gradle wrapper
│   └── build/                    # Build outputs
├── bin/                           # Compiled executables
│   ├── cross-platform-tool-linux # Linux executable
│   ├── cross-platform-tool-macos # macOS executable
│   ├── cross-platform-tool-win.exe # Windows executable
│   └── prebuilds/                # SQLite3 native bindings
│       ├── linux-x64/
│       │   └── sqlite3.node
│       └── win32-x64/
│           └── node_sqlite3_win.node
├── prebuilds/                     # Additional native bindings
├── samples/                       # Sample files for testing
├── build-all.sh                  # Build script for all components
├── package.json                  # Root package configuration
├── tsconfig.json                 # Root TypeScript configuration
└── README.md                     # This documentation
```

## 🏗️ Architecture

### Modern Command Pattern Architecture

The project uses a sophisticated command pattern with dependency injection:

```
┌─────────────────────────────────────────────────┐
│                CLI Application                  │
│  ┌─────────────────┐    ┌─────────────────────┐ │
│  │ CLIApplication  │────│ CommandRegistry     │ │
│  └─────────────────┘    └─────────────────────┘ │
│                              │                  │
│  ┌───────────────────────────┼─────────────────┐│
│  │                           ▼                 ││
│  │  ┌──────────────┐  ┌──────────────┐        ││
│  │  │AnalyzeCommand│  │FormatCommand │        ││
│  │  └──────────────┘  └──────────────┘        ││
│  │  ┌──────────────┐  ┌──────────────┐        ││
│  │  │ HomeCommand  │  │ServerCommand │        ││
│  │  └──────────────┘  └──────────────┘        ││
│  └─────────────────────────────────────────────┘│
└─────────────────────────────────────────────────┘
         │                        │
         ▼                        ▼
┌─────────────────┐    ┌─────────────────┐
│ DatabaseManager │    │   HttpServer    │
└─────────────────┘    └─────────────────┘
         │                        │
         ▼                        ▼
┌─────────────────┐    ┌─────────────────┐
│ SQLite3 Native  │    │   REST API      │
│   Bindings      │    │   Endpoints     │
└─────────────────┘    └─────────────────┘
```

### Core Components

1. **CLIApplication** (`/core/src/cli/CLIApplication.ts`)

   - Main application orchestrator
   - Handles command parsing and execution
   - Provides unified help system

2. **CommandRegistry** (`/core/src/commands/CommandRegistry.ts`)

   - Manages command registration and execution
   - Provides extensible command system
   - Handles dependency injection for commands

3. **Individual Commands** (`/core/src/commands/`)

   - `AnalyzeCommand.ts` - Code analysis functionality
   - `FormatCommand.ts` - Code formatting functionality
   - `HomeCommand.ts` - Database operations
   - `ServerCommand.ts` - HTTP server mode

4. **DatabaseManager** (`/core/src/database/DatabaseManager.ts`)

   - Handles all SQLite operations
   - Manages database connections and lifecycle
   - Provides CRUD operations for items

5. **HttpServer** (`/core/src/server/HttpServer.ts`)

   - REST API server implementation
   - Handles analyze, format, and database endpoints
   - Provides CORS support for development

6. **Utils** (`/core/src/utils/index.ts`)
   - Native module loading with platform detection
   - Code processor loading with fallbacks
   - Command-line argument parsing

## 🛠️ Installation and Setup

### Prerequisites

- Node.js 20 or higher (updated requirement based on package.json)
- npm or yarn package manager
- JDK 11+ (for IntelliJ plugin development)
- Gradle (for IntelliJ plugin)
- pkg (for building executables): `npm install -g pkg`

### Development Setup

1. **Clone and Install Dependencies**

```bash
git clone <repository-url>
cd bundle-node
npm install
cd core && npm install
cd ../vscode-extension && npm install
```

2. **Build the Core Application**

```bash
cd core
npm run build
```

3. **Run Tests**

```bash
cd core
npm test
```

## 🔧 Building the Project

### Build Core Library

```bash
cd core
npm run build
```

### Build Executables

The build process uses pkg with platform-specific SQLite3 native bindings:

```bash
# Build for specific platforms (from root directory)
npm run build:linux    # Linux x64
npm run build:macos    # macOS x64
npm run build:win      # Windows x64

# Build all platforms
npm run build:all       # Uses build-all.sh script
```

### Build VS Code Extension

```bash
cd vscode-extension
npm run compile
npm run package  # Creates sqlite-database-manager-0.1.7.vsix
```

### Build IntelliJ Plugin

```bash
cd intellij-adapter
./gradlew buildPlugin  # Creates plugin in build/distributions/
```

## 📖 Usage

### Command Line Interface

#### Available Commands

```bash
# Code analysis
./bin/cross-platform-tool-linux analyze <file-path>

# Code formatting
./bin/cross-platform-tool-linux format <file-path>

# Database operations
./bin/cross-platform-tool-linux home --init         # Initialize database
./bin/cross-platform-tool-linux home --list         # List items
./bin/cross-platform-tool-linux home --add "item"   # Add item

# HTTP server mode
./bin/cross-platform-tool-linux server --port 9229  # Default port changed to 9229
```

#### Examples

```bash
# Analyze a JavaScript file
./bin/cross-platform-tool-linux analyze samples/sample.js

# Format a TypeScript file
./bin/cross-platform-tool-linux format test-file.js

# Initialize the SQLite database
./bin/cross-platform-tool-linux home --init

# Add data to the database
./bin/cross-platform-tool-linux home --add "My Task"

# List all database items
./bin/cross-platform-tool-linux home --list

# Start server on custom port
./bin/cross-platform-tool-linux server --port 8080
```

### HTTP Server Mode

Start the server:

```bash
./bin/cross-platform-tool-linux server --port 9229
```

The server provides REST API endpoints without authentication for simplified multi-instance support.

### VS Code Extension

The VS Code extension is named "SQLite Database Manager" (not "Cross-Platform Extension"):

1. **Install the extension**:

   ```bash
   code --install-extension sqlite-database-manager-0.1.7.vsix
   ```

2. **Available commands**:

   - `SQLite: Open Database Manager` - Opens the main database management panel
   - `SQLite: Show Logs` - Shows extension logs for debugging

3. **Features**:
   - Database Management: Initialize, view, and manage SQLite databases
   - Item Operations: Add new items and view item details
   - Export Functionality: Export database contents to JSON
   - Real-time Updates: Live refresh of database contents
   - Content Security Policy compliant webview

### IntelliJ Plugin

1. Install the plugin from `intellij-adapter-0.1.0.zip` in the plugin manager
2. Right-click in an editor and select "Analyze Code"
3. Access database operations through the plugin menu

## 🌐 HTTP API Documentation

### Server Information

- **Base URL**: `http://localhost:{port}` (default port: 9229, not 9090)
- **Protocol**: HTTP/1.1
- **Content-Type**: `application/json`
- **Authentication**: None required (optimized for multiple IDE instances)

### Health Check Endpoints

#### GET /ping

Health check endpoint to verify server availability.

**Response:**

```
Status: 200 OK
Content-Type: text/plain

pong
```

#### GET /

Server status and available endpoints.

**Response:**

```json
{
  "status": "running",
  "endpoints": [
    "/ping",
    "/analyze",
    "/format",
    "/database/init",
    "/database/items",
    "/database/clear"
  ]
}
```

### Code Analysis Endpoints

#### POST /analyze

Analyze JavaScript/TypeScript code for issues and improvements.

**Request Body:**

```json
{
  "filePath": "/path/to/file.js", // Optional: path to file
  "code": "console.log('hello');" // Optional: direct code string
}
```

**Response:**

```json
{
  "fileName": "file.js",
  "functions": [],
  "classes": [],
  "variables": [],
  "dependencies": [],
  "complexity": 1,
  "lines": 1
}
```

#### POST /format

Format JavaScript/TypeScript code according to standards.

**Request Body:**

```json
{
  "filePath": "/path/to/file.js", // Optional: path to file
  "code": "function test(){return 1}", // Optional: direct code string
  "saveToFile": true // Optional: save formatted code to file
}
```

**Response:**

```json
{
  "formatted": "function test() {\n  return 1;\n}",
  "changed": true
}
```

### Database Endpoints

#### POST /database/init

Initialize the SQLite database with required tables.

**Request Body:**

```json
{}
```

**Response:**

```json
{
  "success": true,
  "message": "Database initialized"
}
```

#### POST /database/items

Perform CRUD operations on database items.

**Actions:**

- `list` - List all items
- `add` - Add new item (requires `name` parameter)
- `update` - Update existing item (requires `id` and `name` parameters)
- `delete` - Delete item (requires `id` parameter)

**List Items Request:**

```json
{
  "action": "list"
}
```

**Add Item Request:**

```json
{
  "action": "add",
  "name": "New Item Name"
}
```

#### POST /database/clear

Clear all items from the database.

**Request Body:**

```json
{}
```

**Response:**

```json
{
  "success": true,
  "message": "Database cleared"
}
```

## 🗄️ SQLite3 Integration

### Database Schema

```sql
CREATE TABLE items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Native Module Loading System

The project includes a sophisticated native module loading system in `/core/src/utils/index.ts`:

#### Platform Detection

- **Linux**: Uses `sqlite3.node`
- **Windows**: Uses `node_sqlite3_win.node`
- **macOS**: Uses `sqlite3.node`

#### Loading Strategy

1. **PKG Bundle Detection**: Automatically detects if running in a pkg bundled environment
2. **Asset Extraction**: For pkg bundles, extracts native modules to temporary locations
3. **Multiple Path Search**: Tries multiple possible locations for native modules
4. **Graceful Fallbacks**: Provides stub implementations if native modules fail to load

#### Code Processor Loading

The system loads code processors with fallback mechanisms:

```javascript
// Loads native SQLite3 module with OS detection
const nativeModule = loadNativeModule();

// Loads analyze and format functions with fallback
const { analyzeCode, formatCode } = loadCodeProcessors();
```

## 🎯 Unified Solution: Pros and Cons

### Pros

1. **Code Reusability**

   - Single core implementation shared across all platforms
   - Consistent behavior and results
   - Reduced development and maintenance overhead

2. **Maintainability**

   - Bug fixes only need to be implemented once
   - Centralized testing of business logic
   - Version consistency across platforms

3. **Development Efficiency**

   - Command pattern allows easy extension
   - TypeScript provides type safety
   - Modular architecture supports team development

4. **User Experience**
   - Same functionality regardless of IDE choice
   - Consistent results across platforms
   - Teams with mixed IDE preferences can use same tooling

### Cons

1. **Performance Overhead**

   - Subprocess execution overhead for non-VS Code integrations
   - Node.js runtime memory footprint
   - File I/O operations for communication

2. **Development Complexity**

   - Multiple platform expertise required
   - Cross-platform testing challenges
   - Native dependency management complexity

3. **Deployment Challenges**
   - Different packaging for each platform
   - Multiple distribution channels
   - Platform-specific binary management

## 🧪 Testing

### Run Tests

```bash
cd core
npm test
```

Test coverage includes:

- Code analysis functionality
- Formatting operations
- Database operations
- Error handling scenarios
- Command registration and execution

### Debug Commands

```bash
# Check if SQLite3 binding exists
ls -la bin/prebuilds/linux-x64/sqlite3.node

# Test database functionality
./bin/cross-platform-tool-linux home --init

# Test server mode
./bin/cross-platform-tool-linux server --port 9229

# Test analysis
./bin/cross-platform-tool-linux analyze samples/sample.js
```

## 🔧 Troubleshooting

### Common Issues

1. **SQLite3 Binding Not Found**

   - Ensure prebuilds directory contains platform-specific bindings
   - Check file permissions on native bindings
   - Verify pkg assets configuration includes correct binding paths

2. **Module Import Errors**

   - Ensure esbuild compilation completed successfully
   - Check TypeScript compilation output in dist/ directory
   - Verify all dependencies are installed

3. **Database Connection Issues**

   - Check write permissions in application directory
   - Ensure SQLite3 native bindings are accessible
   - Verify database initialization completed successfully

4. **VS Code Extension Issues**

   - Use `SQLite: Show Logs` command for detailed logs
   - Check binary path configuration in ConfigManager
   - Verify extension activation events

5. **Server Connection Issues**

   ```bash
   # Check if port is in use (default 9229, not 9090)
   lsof -i :9229

   # Test server health
   curl -X GET http://localhost:9229/ping

   # Check available endpoints
   curl -X GET http://localhost:9229/
   ```

## ⚡ Performance Considerations

- **Server Mode**: Persistent HTTP server for frequent operations
- **Command Pattern**: Efficient command dispatch and execution
- **Native Modules**: Platform-optimized SQLite3 bindings
- **Memory**: Efficient memory usage with proper cleanup
- **Startup**: Optimized executable startup time

### Performance Metrics

- **Server Startup**: ~500ms initial startup time
- **Command Execution**: <100ms for most operations
- **Database Operations**: <50ms for typical CRUD operations
- **Memory Usage**: ~20MB base memory footprint

## 🔒 Security

- **No Authentication**: Simplified for local development and multi-instance support
- **Input Validation**: All user inputs validated and sanitized
- **Subprocess Isolation**: Binary runs in separate process
- **SQL Injection Prevention**: Parameterized queries throughout
- **File System Access**: Limited to specified directories
- **Content Security Policy**: Strict CSP in VS Code webviews

## 🚀 Development Workflow

1. Make changes to core library (`/core/src/`)
2. Build core: `cd core && npm run build`
3. Test locally: `npm test`
4. Build executables: `npm run build:all`
5. Test VS Code extension in debug mode
6. Package extension: `cd vscode-extension && npm run package`

## 📦 Configuration

### Environment Variables

- `NODE_ENV`: Environment mode (development/production)
- Custom paths for native bindings (automatically detected)

### Package Configuration

**esbuild Configuration** (in `core/esbuild.config.js`):

- Bundles TypeScript to CommonJS for pkg compatibility
- Excludes native modules from bundling
- Optimizes for Node.js 16+ target

**pkg Configuration** (in root `package.json`):

```json
{
  "scripts": {
    "build:linux": "pkg core/dist/cli.cjs --targets node16-linux-x64 --output bin/cross-platform-tool-linux --assets prebuilds/linux-x64/sqlite3.node",
    "build:win": "pkg core/dist/cli.cjs --targets node16-win-x64 --output bin/cross-platform-tool-win.exe --assets prebuilds/win32-x64/node_sqlite3_win.node"
  }
}
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes with tests
4. Build and test all components
5. Submit a pull request

### Development Guidelines

- Use TypeScript for all new features
- Follow the command pattern for new CLI commands
- Include unit tests for functionality
- Update documentation for API changes
- Test across supported platforms

### Adding New Commands

1. Create command class in `/core/src/commands/`
2. Implement the command interface
3. Register in `CommandRegistry.ts`
4. Add tests and documentation

### Best Practices

1. **Core Library Development**

   - Keep platform-agnostic
   - Use dependency injection
   - Implement proper error handling

2. **Platform Integration**
   - Minimize platform-specific code
   - Use the command pattern
   - Test integration thoroughly

## 📋 Changelog

### v1.0.0 - Current

- Modern command pattern architecture with dependency injection
- SQLite3 database integration with sophisticated native module loading
- Cross-platform executable support (Linux, macOS, Windows)
- VS Code extension with Content Security Policy compliant webview
- IntelliJ plugin adapter
- HTTP server API without authentication for multi-instance support
- Comprehensive error handling and logging
- esbuild-based compilation pipeline

## 📄 License

[Specify your license here]

## 🆘 Support

For issues and questions:

1. Check the troubleshooting section above
2. Review existing GitHub issues
3. Create a new issue with detailed reproduction steps
4. Use debug commands to gather diagnostic information

---

_Last updated: June 3, 2025_
