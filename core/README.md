# Core Module

A well-structured TypeScript CLI application with SQLite integration and HTTP server capabilities.

## Project Structure

```
core/
├── src/
│   ├── cli.ts                 # Main CLI entry point
│   ├── index.ts              # Core module exports
│   ├── sqlite-utils.ts       # SQLite utilities for pkg bundling
│   ├── commands/             # Command handlers
│   │   └── index.ts          # Analyze, Format, Home, Server commands
│   ├── database/             # Database operations
│   │   └── DatabaseManager.ts # SQLite database management
│   ├── server/               # HTTP server
│   │   └── HttpServer.ts     # HTTP server for API endpoints
│   ├── types/                # Type definitions
│   │   └── index.ts          # Interfaces and types
│   └── utils/                # Utility functions
│       └── index.ts          # Common utilities
├── package.json              # Dependencies and scripts
├── tsconfig.json            # TypeScript configuration
└── esbuild.config.js        # Build configuration
```

## Architecture Overview

### Separation of Concerns

1. **CLI Layer** (`cli.ts`): Main entry point that orchestrates commands
2. **Commands Layer** (`commands/`): Individual command handlers with single responsibilities
3. **Database Layer** (`database/`): Encapsulates all SQLite operations
4. **Server Layer** (`server/`): HTTP server for API endpoints
5. **Types Layer** (`types/`): Centralized type definitions
6. **Utils Layer** (`utils/`): Common utilities and helpers

### Key Features

- **Modular Design**: Each component has a single responsibility
- **Type Safety**: Full TypeScript support with proper interfaces
- **SQLite Integration**: Robust database operations with pkg bundling support
- **HTTP API**: RESTful endpoints for analyze/format operations
- **Command Pattern**: Extensible command system
- **Error Handling**: Comprehensive error handling throughout

## Available Commands

```bash
# Analyze a code file
node dist/cli.js analyze <file-path>

# Format a code file
node dist/cli.js format <file-path>

# Database operations
node dist/cli.js home --init        # Initialize database
node dist/cli.js home --list        # List items
node dist/cli.js home --add "item"  # Add item

# Start HTTP server
node dist/cli.js server --port 9229
```

## API Endpoints

When running in server mode:

- `POST /analyze` - Analyze code
- `POST /format` - Format code

Both endpoints accept JSON with:

```json
{
  "securityToken": "vscode-client",
  "code": "code string",
  "filePath": "optional file path"
}
```

## Development

The modular structure makes it easy to:

- **Add new commands**: Create a new command class in `commands/`
- **Extend database operations**: Add methods to `DatabaseManager`
- **Add new API endpoints**: Extend `HttpServer`
- **Add new types**: Define in `types/index.ts`
- **Add utilities**: Extend `utils/index.ts`

## Build

```bash
npm run build
```

This will compile TypeScript and bundle with esbuild for optimal performance and pkg compatibility.
