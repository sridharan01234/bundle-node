# Cross-Platform Tool HTTP API Documentation

## Overview

The Cross-Platform Tool provides a REST API server mode for efficient communication between IDE plugins and the core functionality. This replaces the CLI-based approach with a persistent HTTP server that offers better performance and easier integration.

## Server Information

- **Base URL**: `http://localhost:{port}` (default port: 9090)
- **Protocol**: HTTP/1.1
- **Content-Type**: `application/json`
- **Authentication**: None required (optimized for multiple IDE instances)

## Starting the Server

```bash
# Start server on default port (9090)
./bin/cross-platform-tool-linux server

# Start server on custom port
./bin/cross-platform-tool-linux server --port 8080
```

## Multi-Instance Support

The server is designed to support multiple VS Code instances and IDE connections:

- No authentication required for simplified multi-instance support
- Server continues running independently of individual IDE instances
- Persistent connection with intelligent health checking
- Optimized performance with connection caching

---

## Health Check Endpoints

### GET /ping

Health check endpoint to verify server availability.

**Request:**

```http
GET /ping HTTP/1.1
Host: localhost:9090
```

**Response:**

```
Status: 200 OK
Content-Type: text/plain

pong
```

**Example:**

```bash
curl -X GET http://localhost:9090/ping
```

---

### GET /

Server status and available endpoints.

**Request:**

```http
GET / HTTP/1.1
Host: localhost:9090
```

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

---

## Database Endpoints

### POST /database/init

Initialize the SQLite database with required tables.

**Request Body:**

```json
{}
```

**Response (Success):**

```json
{
  "success": true,
  "message": "Database initialized"
}
```

**Error Responses:**

- `500`: Database connection failed or internal error

**Example:**

```bash
curl -X POST http://localhost:9090/database/init \
  -H "Content-Type: application/json" \
  -d '{}'
```

---

### POST /database/items

Perform CRUD operations on database items.

#### List Items

**Request Body:**

```json
{
  "action": "list"
}
```

**Response (Success):**

```json
{
  "items": [
    {
      "id": 1,
      "name": "Sample Item",
      "created_at": "2025-06-02 10:30:00"
    },
    {
      "id": 2,
      "name": "Another Item",
      "created_at": "2025-06-02 11:15:00"
    }
  ]
}
```

#### Add Item

**Request Body:**

```json
{
  "action": "add",
  "name": "New Item Name"
}
```

**Response (Success):**

```json
{
  "success": true,
  "message": "Item added"
}
```

#### Update Item

**Request Body:**

```json
{
  "action": "update",
  "id": "1",
  "name": "Updated Item Name"
}
```

**Response (Success):**

```json
{
  "success": true,
  "message": "Item updated"
}
```

#### Delete Item

**Request Body:**

```json
{
  "action": "delete",
  "id": "1"
}
```

**Response (Success):**

```json
{
  "success": true,
  "message": "Item deleted"
}
```

**Parameters:**

- `action` (required): One of "list", "add", "update", "delete"
- `name` (required for add/update): Item name
- `id` (required for update/delete): Item ID

**Examples:**

```bash
# List items
curl -X POST http://localhost:9090/database/items \
  -H "Content-Type: application/json" \
  -d '{"action": "list"}'

# Add item
curl -X POST http://localhost:9090/database/items \
  -H "Content-Type: application/json" \
  -d '{"action": "add", "name": "Test Item"}'

# Update item
curl -X POST http://localhost:9090/database/items \
  -H "Content-Type: application/json" \
  -d '{"action": "update", "id": "1", "name": "Updated Name"}'

# Delete item
curl -X POST http://localhost:9090/database/items \
  -H "Content-Type: application/json" \
  -d '{"action": "delete", "id": "1"}'
```

---

## Code Analysis Endpoints

### POST /analyze

Analyze JavaScript/TypeScript code for issues and improvements.

**Request Body:**

```json
{
  "filePath": "/path/to/file.js", // Optional: path to file
  "code": "console.log('hello');" // Optional: direct code string
}
```

**Parameters:**

- `filePath` (optional): Path to file to analyze
- `code` (optional): Code string to analyze directly
- **Note**: Either `filePath` or `code` must be provided

**Response (Success):**

```json
{
  "fileName": "file.js",
  "issues": [
    {
      "line": 1,
      "column": 1,
      "message": "Avoid console.log in production code",
      "severity": "warning",
      "type": "console-log"
    }
  ],
  "summary": {
    "totalIssues": 1,
    "errors": 0,
    "warnings": 1,
    "info": 0
  }
}
```

**Error Responses:**

- `400`: Missing code or filePath
- `404`: File not found
- `500`: Internal server error

**Example:**

```bash
curl -X POST http://localhost:9090/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "code": "function test() { console.log(\"debug\"); }"
  }'
```

---

### POST /format

Format JavaScript/TypeScript code according to standards.

**Request Body:**

```json
{
  "filePath": "/path/to/file.js", // Optional: path to file
  "code": "function test(){return 1}", // Optional: direct code string
  "saveToFile": true // Optional: save formatted code to file
}
```

**Parameters:**

- `filePath` (optional): Path to file to format
- `code` (optional): Code string to format directly
- `saveToFile` (optional): If true and filePath provided, saves formatted code to file

**Response (Success):**

```json
{
  "formatted": "function test() {\n  return 1;\n}",
  "changed": true
}
```

**Error Responses:**

- `400`: Missing code or filePath
- `404`: File not found
- `500`: Internal server error

**Example:**

```bash
curl -X POST http://localhost:9090/format \
  -H "Content-Type: application/json" \
  -d '{
    "code": "function test(){return 1;}"
  }'
```

---

## Performance Optimizations

### Connection Caching

- Health checks only performed every 30 seconds when server is known to be running
- Connection status cached to avoid redundant ping requests
- Smart retry logic with automatic reconnection

### Multi-Instance Support

- No authentication tokens to avoid conflicts between IDE instances
- Server runs independently and persists across instance closures
- Detached server process continues running when IDE closes

### Error Handling

- Automatic retry with exponential backoff
- Connection failure detection and recovery
- Graceful degradation with meaningful error messages

---

## Performance Considerations

- **Server Startup**: ~500ms initial startup time
- **Health Check Frequency**: Every 30 seconds (instead of every request)
- **Request Latency**: <5ms for cached connections
- **Concurrent Requests**: Supports multiple simultaneous connections
- **Memory Usage**: ~20MB base memory footprint with connection pooling

---

## Troubleshooting

### Server Won't Start

```bash
# Check if port is already in use
lsof -i :9090

# Try different port
./bin/cross-platform-tool-linux server --port 8080
```

### Connection Refused

```bash
# Verify server is running
curl -X GET http://localhost:9090/ping

# Check server logs for errors
./bin/cross-platform-tool-linux server --port 9090 2>&1 | tee server.log
```

### Authentication Errors

```bash
# Verify token in request
curl -X POST http://localhost:9090/database/items \
  -H "Content-Type: application/json" \
  -d '{"action": "list"}' \
  -v
```

### Database Errors

```bash
# Initialize database if needed
curl -X POST http://localhost:9090/database/init \
  -H "Content-Type: application/json" \
  -d '{}'
```
