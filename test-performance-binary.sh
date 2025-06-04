#!/bin/bash

echo "🚀 CLI Server Performance Testing Suite (Using PKG Binary)"
echo "=========================================================="

# Default port
PORT=${1:-9229}

echo "Testing server on port $PORT using pre-built binary"

# Path to the binary
BINARY_PATH="./bin/cross-platform-tool-linux"

# Check if binary exists
if [ ! -f "$BINARY_PATH" ]; then
    echo "❌ Binary not found at $BINARY_PATH"
    exit 1
fi

# Make sure binary is executable
chmod +x "$BINARY_PATH"

# Start the server in background using the binary
echo "🔧 Starting CLI server using PKG binary on port $PORT..."
"$BINARY_PATH" server --port $PORT &
SERVER_PID=$!

# Wait for server to start (PKG binaries might take longer to initialize)
echo "⏳ Waiting for PKG binary server to start..."
sleep 5

# Function to cleanup server on exit
cleanup() {
    echo "🧹 Cleaning up..."
    kill $SERVER_PID 2>/dev/null || true
    # Give it a moment to cleanup
    sleep 1
    # Force kill if still running
    kill -9 $SERVER_PID 2>/dev/null || true
    exit 0
}
trap cleanup EXIT INT TERM

# Check if server is running
echo "🔍 Checking server status..."
MAX_RETRIES=10
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if curl -s http://localhost:$PORT/ping > /dev/null 2>&1; then
        echo "✅ PKG binary server is running!"
        break
    else
        echo "⏳ Waiting for server... (attempt $((RETRY_COUNT + 1))/$MAX_RETRIES)"
        sleep 2
        RETRY_COUNT=$((RETRY_COUNT + 1))
    fi
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo "❌ PKG binary server failed to start after $MAX_RETRIES attempts"
    echo "Server output (if any):"
    # Try to get some output from the process
    ps aux | grep cross-platform-tool || true
    exit 1
fi

# Test basic functionality before performance testing
echo "🧪 Testing basic server functionality..."
PING_RESPONSE=$(curl -s http://localhost:$PORT/ping)
if [ "$PING_RESPONSE" = "pong" ]; then
    echo "✅ Ping test successful"
else
    echo "⚠️  Unexpected ping response: $PING_RESPONSE"
fi

# Test root endpoint
ROOT_RESPONSE=$(curl -s http://localhost:$PORT/)
if echo "$ROOT_RESPONSE" | grep -q "status"; then
    echo "✅ Root endpoint test successful"
else
    echo "⚠️  Unexpected root response: $ROOT_RESPONSE"
fi

# Run performance tests
echo "🏃 Running performance tests against PKG binary..."
node core/src/performance-test.js $PORT

echo "🎉 PKG binary performance testing completed!"