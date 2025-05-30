# SQLite Database Manager - VS Code Extension

A lightweight SQLite database manager extension for Visual Studio Code, featuring a clean webview interface and integration with a bundled SQLite binary.

## ✨ Features

- **Database Management**: Initialize, view, and manage SQLite databases
- **Item Operations**: Add new items and view item details
- **Export Functionality**: Export database contents to JSON
- **Real-time Updates**: Live refresh of database contents
- **Cross-Platform**: Works on Windows, macOS, and Linux
- **Security**: Content Security Policy compliant webview

## 🚀 Quick Start

1. **Install the Extension**: Load the extension in VS Code
2. **Open Database Manager**: Use `Ctrl+Shift+P` → "SQLite: Open Database Manager"
3. **Initialize Database**: Click "Initialize" to create a new database
4. **Add Items**: Enter item names and click "Add Item"
5. **View Data**: Browse your database items in the table view

## 📋 Commands

| Command                         | Description                              |
| ------------------------------- | ---------------------------------------- |
| `SQLite: Open Database Manager` | Opens the main database management panel |
| `SQLite: Show Logs`             | Shows extension logs for debugging       |

## 🏗️ Project Structure

```
src/
├── extension.ts              # Main entry point
├── config/
│   └── ConfigManager.ts      # Platform detection & configuration
├── services/
│   └── DatabaseService.ts    # Database operations & binary communication
├── types/
│   └── index.ts             # TypeScript interfaces & types
├── utils/
│   ├── Logger.ts            # Centralized logging
│   └── UIUtils.ts           # VS Code UI utilities
└── webview/
    └── WebviewManager.ts    # Complete webview with jQuery
```

## 🔧 Architecture

### Service Layer Pattern

- **ConfigManager**: Handles platform-specific binary detection
- **DatabaseService**: Manages all database operations via binary subprocess
- **WebviewManager**: Handles UI rendering and message passing
- **Logger**: Centralized logging with VS Code output channel

### Technology Stack

- **Backend**: TypeScript + Node.js child processes
- **Frontend**: HTML + CSS + jQuery (no React overhead)
- **Security**: Strict Content Security Policy with nonces
- **Binary**: Cross-platform SQLite tool integration

## 🛠️ Development

### Prerequisites

- Node.js 16+
- TypeScript 4.5+
- VS Code 1.60+

### Build & Test

```bash
# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Watch mode for development
npm run watch

# Package extension
npm run package
```

### Binary Commands

The extension communicates with the bundled binary using these commands:

- `home --init`: Initialize database
- `home --list`: List all items
- `home --add <name>`: Add new item

## 🔒 Security Features

- **Content Security Policy**: Strict CSP prevents XSS attacks
- **Nonce-based Scripts**: All scripts use cryptographic nonces
- **Input Sanitization**: All user inputs are escaped
- **Subprocess Isolation**: Binary runs in separate process

## 📦 Package Contents

- `out/`: Compiled JavaScript files
- `media/`: Extension icons and assets
- `package.json`: Extension manifest
- `README.md`: This documentation

## 🐛 Troubleshooting

### Common Issues

1. **"Unknown command" errors**: Ensure the binary path is correct
2. **CSP violations**: All inline scripts/styles use proper nonces
3. **Permission errors**: Check binary executable permissions

### Debug Mode

Use `SQLite: Show Logs` command to view detailed extension logs.

## 📄 License

This project is part of the bundle-node toolkit.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

---

_Built with ❤️ using VS Code Extension API and modern TypeScript patterns_
