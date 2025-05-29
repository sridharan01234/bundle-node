# Bundle Node - Cross-Platform Code Analysis Tool

## Overview

Bundle Node is a comprehensive code analysis and formatting tool that can be packaged as a standalone executable for cross-platform distribution. It provides code analysis, formatting capabilities, and includes SQLite3 database functionality for data persistence.

## Architecture

The application consists of several key components:

```
bundle-node/
├── core/                    # Core Node.js application
│   ├── src/
│   │   ├── cli.cjs         # CommonJS CLI interface (pkg-compatible)
│   │   ├── cli.ts          # TypeScript CLI interface
│   │   ├── index.ts        # Core analysis and formatting logic
│   │   └── index.test.ts   # Unit tests
│   ├── extract-bindings.js # SQLite3 native binding extraction
│   └── package.json        # Core dependencies and scripts
├── vscode-extension/        # VS Code extension
├── intellij-adapter/        # IntelliJ plugin adapter
├── bin/                     # Compiled executables
└── docs/                    # Documentation
```

## Features

### 1. Code Analysis

- Analyzes JavaScript/TypeScript code structure
- Identifies functions, classes, variables, and dependencies
- Provides complexity metrics and insights

### 2. Code Formatting

- Formats JavaScript/TypeScript code
- Maintains consistent code style
- Preserves semantic meaning

### 3. SQLite3 Database Integration

- Persistent data storage
- CRUD operations for application data
- Cross-platform database compatibility

### 4. Multiple Interface Options

- Command-line interface (CLI)
- HTTP server mode for API access
- VS Code extension integration
- IntelliJ plugin support

### 5. Cross-Platform Executables

- Linux (x64)
- macOS (x64)
- Windows (x64)

## Installation and Setup

### Prerequisites

- Node.js 16 or higher
- npm or yarn package manager

### Development Setup

1. **Clone and Install Dependencies**

```bash
git clone <repository-url>
cd bundle-node
npm install
cd core && npm install
```

2. **Build the Core Application**

```bash
npm run build
```

3. **Run Tests**

```bash
cd core
npm test
```

## Usage

### Command Line Interface

#### Basic Commands

```bash
# Analyze a file
./bin/cross-platform-tool-linux analyze <file-path>

# Format a file
./bin/cross-platform-tool-linux format <file-path>

# SQLite3 database operations
./bin/cross-platform-tool-linux home --init     # Initialize database
./bin/cross-platform-tool-linux home --list     # List items
./bin/cross-platform-tool-linux home --add "item"  # Add item

# Start HTTP server
./bin/cross-platform-tool-linux server --port 9229
```

#### Examples

```bash
# Analyze a JavaScript file
./bin/cross-platform-tool-linux analyze samples/sample.js

# Format a TypeScript file
./bin/cross-platform-tool-linux format src/index.ts

# Initialize the SQLite database
./bin/cross-platform-tool-linux home --init

# Add data to the database
./bin/cross-platform-tool-linux home --add "My Task"

# List all database items
./bin/cross-platform-tool-linux home --list
```

### HTTP Server Mode

Start the server:

```bash
./bin/cross-platform-tool-linux server --port 9229
```

API Endpoints:

**POST /analyze**

```json
{
  "securityToken": "vscode-client",
  "code": "function hello() { return 'world'; }",
  "filePath": "optional/path/to/file.js"
}
```

**POST /format**

```json
{
  "securityToken": "vscode-client",
  "code": "function hello(){return'world';}",
  "saveToFile": false
}
```

## Building Executables

### Prerequisites for Building

- pkg package installed: `npm install -g pkg`

### Build Commands

```bash
# Build for Linux
npm run build:linux

# Build for macOS
npm run build:macos

# Build for Windows
npm run build:win
```

### Build Process Details

The build process includes:

1. **SQLite3 Binding Extraction**

   - Locates native SQLite3 bindings in `node_modules`
   - Copies `node_sqlite3.node` to distribution directories
   - Ensures runtime availability of native modules

2. **Code Compilation**

   - Uses `pkg` to bundle Node.js application
   - Creates self-contained executables
   - Includes all dependencies and assets

3. **Asset Packaging**
   - Bundles SQLite3 native bindings
   - Includes configuration files
   - Optimizes for distribution

## SQLite3 Integration

### Problem Solved

The main challenge was packaging SQLite3 native bindings with pkg, as pkg's virtual filesystem couldn't locate the native `.node` files at runtime.

### Solution Implementation

1. **Binding Extraction Script** (`extract-bindings.js`)

```javascript
// Locates SQLite3 native bindings
const bindingPath = path.join(
  nodeModulesPath,
  "sqlite3",
  "build",
  "Release",
  "node_sqlite3.node",
);

// Copies to accessible locations
fs.copyFileSync(bindingPath, targetPath);
```

2. **Runtime Binding Discovery** (`cli.cjs`)

```javascript
// Searches multiple paths for native bindings
const possiblePaths = [
  path.join(process.cwd(), "node_sqlite3.node"),
  path.join(path.dirname(process.execPath), "node_sqlite3.node"),
  path.join(__dirname, "node_sqlite3.node"),
];
```

3. **Improved Database Handling**
   - Proper connection lifecycle management
   - Error handling for database operations
   - Callback-based operation completion tracking

### Database Schema

```sql
CREATE TABLE items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Development

### Project Structure

```
core/src/
├── cli.cjs          # Main CLI interface (CommonJS for pkg compatibility)
├── cli.ts           # TypeScript version of CLI
├── index.ts         # Core analysis and formatting logic
└── index.test.ts    # Unit tests
```

### Key Technologies

- **TypeScript**: Primary development language
- **Node.js**: Runtime environment
- **SQLite3**: Database engine
- **pkg**: Executable packaging tool

### Code Organization

**Core Logic** (`index.ts`)

- `analyzeCode()`: Code analysis functionality
- `formatCode()`: Code formatting functionality
- Exports for use by CLI and extensions

**CLI Interface** (`cli.cjs`)

- Command-line argument parsing
- Database operations
- HTTP server implementation
- Error handling and logging

### Testing

Run the test suite:

```bash
cd core
npm test
```

Test coverage includes:

- Code analysis functionality
- Formatting operations
- Database operations
- Error handling scenarios

## Troubleshooting

### Common Issues

1. **SQLite3 Binding Not Found**

   - Ensure `extract-bindings` script runs before pkg
   - Check that `node_sqlite3.node` exists in bin/ directory
   - Verify file permissions on the native binding

2. **Module Import Errors**

   - Use CommonJS version (`cli.cjs`) for pkg builds
   - Ensure all dependencies are included in pkg assets

3. **Database Connection Issues**
   - Check file permissions for database directory
   - Ensure SQLite3 native bindings are accessible
   - Verify database path exists and is writable

### Debug Commands

```bash
# Check if SQLite3 binding exists
ls -la bin/node_sqlite3.node

# Test database functionality
./bin/cross-platform-tool-linux home --init

# Verbose pkg build
pkg core/src/cli.cjs --targets node16-linux-x64 --output bin/test-build --debug
```

## VS Code Extension

The VS Code extension (`vscode-extension/`) provides:

- Integration with the core analysis engine
- Real-time code analysis
- Formatting commands
- Server communication

## IntelliJ Plugin

The IntelliJ adapter (`intellij-adapter/`) offers:

- Java-based plugin architecture
- Integration with IntelliJ IDEA
- Code analysis within the IDE
- Communication with the Node.js core

## Configuration

### Environment Variables

- `PLUGIN_SECURITY_TOKEN`: Security token for API access
- `SQLITE3_BINARY_FILE`: Override path for SQLite3 binding

### Package Configuration

**pkg Configuration** (in `core/package.json`):

```json
{
  "pkg": {
    "assets": [
      "node_modules/sqlite3/lib/binding/**/*",
      "node_modules/sqlite3/lib/sqlite3.js",
      "node_modules/sqlite3/lib/sqlite3-binding.js"
    ],
    "scripts": ["src/**/*.js"]
  }
}
```

## Performance Considerations

- **Server Mode**: Use HTTP server for frequent operations
- **Caching**: Analysis results can be cached for repeated files
- **Memory**: SQLite3 operations are memory-efficient
- **Startup**: Binary startup time optimized for single operations

## Security

- **Token-based Authentication**: API endpoints require security tokens
- **File System Access**: Limited to specified directories
- **Input Validation**: All user inputs are validated
- **SQL Injection Prevention**: Parameterized queries used

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes with tests
4. Submit a pull request

### Development Guidelines

- Use TypeScript for new features
- Include unit tests for all functionality
- Follow existing code style
- Update documentation for API changes

## License

[Specify your license here]

## Changelog

### v1.0.0 - Current

- Initial release with code analysis and formatting
- SQLite3 database integration
- Cross-platform executable support
- VS Code and IntelliJ extensions
- HTTP server API
- Comprehensive error handling

## Support

For issues and questions:

1. Check the troubleshooting section
2. Review existing GitHub issues
3. Create a new issue with detailed reproduction steps

---

_Last updated: May 23, 2025_
