import * as vscode from "vscode";
import { getNonce } from "../utils/common";

/**
 * Get the webview HTML for the database panel
 * @param webview The webview to generate HTML for
 * @param extensionUri Extension URI for loading resources
 * @returns HTML string for the webview
 */
export function getDatabaseHtml(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
): string {
  const nonce = getNonce();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https:; script-src 'nonce-${nonce}' https:; style-src 'nonce-${nonce}';">
  <title>SQLite Database Manager</title>
  <style nonce="${nonce}">
    body {
      font-family: var(--vscode-font-family);
      padding: 20px;
      color: var(--vscode-foreground);
      background-color: var(--vscode-editor-background);
      margin: 0;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
    }
    h1 {
      margin-bottom: 10px;
      color: var(--vscode-editor-foreground);
    }
    .status {
      margin: 10px 0;
      padding: 10px;
      border-radius: 3px;
    }
    .info { background-color: rgba(65, 105, 225, 0.1); border-left: 4px solid royalblue; }
    .success { background-color: rgba(50, 205, 50, 0.1); border-left: 4px solid limegreen; }
    .error { background-color: rgba(255, 0, 0, 0.1); border-left: 4px solid red; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    th, td {
      padding: 8px;
      text-align: left;
      border-bottom: 1px solid var(--vscode-panel-border);
    }
    th {
      background-color: var(--vscode-editor-lineHighlightBackground);
    }
    button {
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      padding: 6px 12px;
      border-radius: 3px;
      cursor: pointer;
      margin-right: 5px;
      margin-bottom: 5px;
    }
    button:hover {
      background-color: var(--vscode-button-hoverBackground);
    }
    input {
      padding: 6px;
      border: 1px solid var(--vscode-input-border);
      background-color: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border-radius: 3px;
      width: 200px;
    }
    .actions {
      margin: 20px 0;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }
    .row {
      margin-bottom: 10px;
      display: flex;
      align-items: center;
    }
    .spinner {
      width: 20px;
      height: 20px;
      border: 2px solid rgba(0, 0, 0, 0.1);
      border-top-color: var(--vscode-textLink-activeForeground);
      border-radius: 50%;
      animation: spin 1s ease-in-out infinite;
      display: inline-block;
      vertical-align: middle;
      margin-right: 8px;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .item-actions {
      display: flex;
      gap: 4px;
    }
    .empty-state {
      text-align: center;
      padding: 40px 0;
      color: var(--vscode-descriptionForeground);
    }
    .loading {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 40px 0;
    }
    
    /* Modal Dialog Styles */
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: rgba(0, 0, 0, 0.5);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 1000;
    }
    
    .modal-container {
      background-color: var(--vscode-editor-background);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 4px;
      padding: 20px;
      max-width: 400px;
      width: 100%;
      box-shadow: 0 5px 15px rgba(0, 0, 0, 0.5);
    }
    
    .modal-header {
      margin-bottom: 15px;
    }
    
    .modal-title {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
    }
    
    .modal-body {
      margin-bottom: 20px;
    }
    
    .modal-input {
      width: 100%;
      padding: 8px;
      margin-top: 10px;
      box-sizing: border-box;
      background-color: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border);
      border-radius: 3px;
    }
    
    .modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
    }
  </style>
</head>
<body>
  <div id="root">
    <div class="container">
      <h1>SQLite Database Manager</h1>
      <p>Loading database items...</p>
      <div class="loading">
        <div class="spinner"></div>
      </div>
    </div>
  </div>

  <script nonce="${nonce}">
    // Add global error handler to prevent uncaught exceptions from breaking the WebView
    window.addEventListener('error', function(event) {
      console.error('Caught global error:', event.error || event.message);
      event.preventDefault();
      return true;
    });
    
    // Safely acquire VS Code API - avoid potential collisions with other extensions
    const vscode = (function() {
      try {
        return acquireVsCodeApi();
      } catch (err) {
        console.error('Failed to acquire VS Code API:', err);
        // Return a mock API to prevent errors
        return {
          postMessage: function(msg) {
            console.log('Mock postMessage:', msg);
          },
          setState: function() {},
          getState: function() { return {}; }
        };
      }
    })();
    
    // Wait for DOM to be fully loaded
    window.addEventListener('DOMContentLoaded', () => {
      try {
        // State variables
        let items = [];
        let isLoading = true;
        let currentPromiseResolve = null;
        
        // DOM elements - will be set after render
        let statusEl;
        let itemNameInput;
        let itemsList;
        let loadingIndicator;
        let emptyState;
        let itemsTable;
        
        // Custom modal dialogs
        function showConfirmDialog(message, title = 'Confirm') {
          return new Promise((resolve) => {
            currentPromiseResolve = resolve;
            
            const modal = document.createElement('div');
            modal.className = 'modal-overlay';
            modal.innerHTML = \`
              <div class="modal-container">
                <div class="modal-header">
                  <h3 class="modal-title">\${escapeHtml(title)}</h3>
                </div>
                <div class="modal-body">
                  \${escapeHtml(message)}
                </div>
                <div class="modal-footer">
                  <button class="cancel-btn">Cancel</button>
                  <button class="confirm-btn">Confirm</button>
                </div>
              </div>
            \`;
            
            document.body.appendChild(modal);
            
            modal.querySelector('.confirm-btn').addEventListener('click', () => {
              document.body.removeChild(modal);
              resolve(true);
            });
            
            modal.querySelector('.cancel-btn').addEventListener('click', () => {
              document.body.removeChild(modal);
              resolve(false);
            });
          });
        }
        
        function showPromptDialog(message, defaultValue = '', title = 'Input') {
          return new Promise((resolve) => {
            currentPromiseResolve = resolve;
            
            const modal = document.createElement('div');
            modal.className = 'modal-overlay';
            modal.innerHTML = \`
              <div class="modal-container">
                <div class="modal-header">
                  <h3 class="modal-title">\${escapeHtml(title)}</h3>
                </div>
                <div class="modal-body">
                  \${escapeHtml(message)}
                  <input type="text" class="modal-input" value="\${escapeHtml(defaultValue)}">
                </div>
                <div class="modal-footer">
                  <button class="cancel-btn">Cancel</button>
                  <button class="confirm-btn">OK</button>
                </div>
              </div>
            \`;
            
            document.body.appendChild(modal);
            
            const input = modal.querySelector('.modal-input');
            input.focus();
            input.select();
            
            modal.querySelector('.confirm-btn').addEventListener('click', () => {
              const value = input.value;
              document.body.removeChild(modal);
              resolve(value);
            });
            
            modal.querySelector('.cancel-btn').addEventListener('click', () => {
              document.body.removeChild(modal);
              resolve(null);
            });
            
            input.addEventListener('keyup', (e) => {
              if (e.key === 'Enter') {
                const value = input.value;
                document.body.removeChild(modal);
                resolve(value);
              } else if (e.key === 'Escape') {
                document.body.removeChild(modal);
                resolve(null);
              }
            });
          });
        }
        
        function showAlertDialog(message, title = 'Alert') {
          return new Promise((resolve) => {
            currentPromiseResolve = resolve;
            
            const modal = document.createElement('div');
            modal.className = 'modal-overlay';
            modal.innerHTML = \`
              <div class="modal-container">
                <div class="modal-header">
                  <h3 class="modal-title">\${escapeHtml(title)}</h3>
                </div>
                <div class="modal-body">
                  \${escapeHtml(message)}
                </div>
                <div class="modal-footer">
                  <button class="ok-btn">OK</button>
                </div>
              </div>
            \`;
            
            document.body.appendChild(modal);
            
            modal.querySelector('.ok-btn').addEventListener('click', () => {
              document.body.removeChild(modal);
              resolve();
            });
          });
        }
        
        // Initial render
        renderApp();
        
        // Listen for messages from the extension
        window.addEventListener('message', event => {
          const message = event.data;
          console.log('Received message:', message);
          
          switch (message.command) {
            case 'showLoading':
              isLoading = true;
              showStatus(message.message || 'Loading...', 'info');
              renderApp();
              break;
              
            case 'updateItems':
              isLoading = false;
              if (message.success && message.items) {
                try {
                  if (typeof message.items === 'string') {
                    try {
                      items = JSON.parse(message.items);
                      
                      if (items.length > 0) {
                        showStatus('Items loaded successfully', 'success');
                        setTimeout(() => hideStatus(), 3000);
                      } else {
                        showStatus('No items found. Add an item or initialize the database.', 'info');
                      }
                    } catch (jsonError) {
                      console.error('Failed to parse items JSON:', jsonError);
                      items = [];
                      showStatus('Error parsing data: ' + jsonError.message, 'error');
                    }
                  } else {
                    items = [];
                    showStatus('Invalid data format received', 'error');
                  }
                } catch (err) {
                  console.error('Error processing items:', err);
                  items = [];
                  showStatus('Error processing data: ' + err.message, 'error');
                }
              } else {
                items = [];
                showStatus(message.error || 'Failed to load items', 'error');
              }
              renderApp();
              break;
              
            case 'showSuccess':
              isLoading = false;
              showStatus(message.message, 'success');
              setTimeout(() => hideStatus(), 3000);
              renderApp();
              break;
              
            case 'showError':
              isLoading = false;
              showStatus(message.message, 'error');
              renderApp();
              break;
              
            case 'showInfo':
              showStatus(message.message, 'info');
              break;
              
            case 'showItemDetails':
              if (message.details) {
                showAlertDialog(
                  'Item Details:\\n\\n' +
                  'ID: ' + message.details.id + '\\n' +
                  'Name: ' + message.details.name + '\\n' +
                  'Created: ' + message.details.created_at + '\\n' +
                  'Character Length: ' + (message.details.length || 'N/A') + '\\n' +
                  'Word Count: ' + (message.details.words || 'N/A'),
                  'Item Details'
                );
              }
              break;
          }
        });
        
        // Main render function
        function renderApp() {
          const rootEl = document.getElementById('root');
          
          rootEl.innerHTML = \`
            <div class="container">
              <h1>SQLite Database Manager</h1>
              <p>Manage your database items through the bundled SQLite binary.</p>
              
              <div id="status" class="status info" style="display: none;"></div>
              
              <div class="actions">
                <div class="row" style="margin-right: 10px;">
                  <input type="text" id="itemNameInput" placeholder="Enter item name" style="margin-right: 5px;">
                  <button id="addItemBtn">Add Item</button>
                </div>
                <button id="refreshBtn">Refresh</button>
                <button id="initDatabaseBtn">Initialize Database</button>
                <button id="clearDatabaseBtn">Clear All</button>
                <button id="exportDataBtn">Export Data</button>
              </div>
              
              \${isLoading ? 
                \`<div id="loadingIndicator" class="loading">
                  <div class="spinner"></div> Loading items...
                </div>\` : 
                items.length === 0 ?
                \`<div id="emptyState" class="empty-state">
                  <h3>No items found</h3>
                  <p>Add your first item using the form above or initialize the database.</p>
                </div>\` :
                \`<table id="itemsTable">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Name</th>
                      <th>Created At</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody id="itemsList">
                    \${renderItems()}
                  </tbody>
                </table>\`
              }
            </div>
          \`;
          
          // Set references to DOM elements after render
          statusEl = document.getElementById('status');
          itemNameInput = document.getElementById('itemNameInput');
          loadingIndicator = document.getElementById('loadingIndicator');
          emptyState = document.getElementById('emptyState');
          itemsTable = document.getElementById('itemsTable');
          itemsList = document.getElementById('itemsList');
          
          // Add event listeners
          document.getElementById('addItemBtn').addEventListener('click', addItem);
          document.getElementById('refreshBtn').addEventListener('click', refreshItems);
          document.getElementById('initDatabaseBtn').addEventListener('click', initDatabase);
          document.getElementById('clearDatabaseBtn').addEventListener('click', clearDatabase);
          document.getElementById('exportDataBtn').addEventListener('click', exportData);
          
          itemNameInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
              addItem();
            }
          });
          
          // Add event listeners to action buttons
          const editButtons = document.querySelectorAll('.edit-btn');
          const viewButtons = document.querySelectorAll('.view-btn');
          const deleteButtons = document.querySelectorAll('.delete-btn');
          
          editButtons.forEach(button => {
            button.addEventListener('click', () => {
              const itemId = button.getAttribute('data-id');
              const itemName = button.getAttribute('data-name');
              editItem(itemId, itemName);
            });
          });
          
          viewButtons.forEach(button => {
            button.addEventListener('click', () => {
              const itemId = button.getAttribute('data-id');
              viewItemDetails(itemId);
            });
          });
          
          deleteButtons.forEach(button => {
            button.addEventListener('click', () => {
              const itemId = button.getAttribute('data-id');
              const itemName = button.getAttribute('data-name');
              deleteItem(itemId, itemName);
            });
          });
        }
        
        // Helper functions
        function renderItems() {
          if (items.length === 0) return '';
          
          return items.map(item => \`
            <tr>
              <td>\${escapeHtml(item.id)}</td>
              <td>\${escapeHtml(item.name)}</td>
              <td>\${escapeHtml(item.created_at)}</td>
              <td>
                <div class="item-actions">
                  <button class="edit-btn" data-id="\${escapeHtml(item.id)}" data-name="\${escapeHtml(item.name)}">Edit</button>
                  <button class="view-btn" data-id="\${escapeHtml(item.id)}">View</button>
                  <button class="delete-btn" data-id="\${escapeHtml(item.id)}" data-name="\${escapeHtml(item.name)}">Delete</button>
                </div>
              </td>
            </tr>
          \`).join('');
        }
        
        function showStatus(message, type = 'info') {
          if (!statusEl) return;
          
          statusEl.textContent = message;
          statusEl.className = 'status ' + type;
          statusEl.style.display = message ? 'block' : 'none';
        }
        
        function hideStatus() {
          if (statusEl) {
            statusEl.style.display = 'none';
          }
        }
        
        function escapeHtml(unsafe) {
          return unsafe
            .toString()
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
        }
        
        // Action functions
        async function addItem() {
          const name = itemNameInput.value.trim();
          
          if (!name) {
            showStatus('Please enter an item name', 'error');
            return;
          }
          
          vscode.postMessage({
            command: 'addItem',
            itemName: name
          });
          
          itemNameInput.value = '';
          isLoading = true;
          renderApp();
        }
        
        async function refreshItems() {
          vscode.postMessage({
            command: 'refresh'
          });
          
          isLoading = true;
          renderApp();
        }
        
        async function initDatabase() {
          const confirmed = await showConfirmDialog('Are you sure you want to initialize the database?', 'Initialize Database');
          if (confirmed) {
            vscode.postMessage({
              command: 'initDatabase'
            });
            
            isLoading = true;
            renderApp();
          }
        }
        
        async function clearDatabase() {
          const confirmed = await showConfirmDialog('Are you sure you want to clear all items? This cannot be undone.', 'Clear Database');
          if (confirmed) {
            vscode.postMessage({
              command: 'clearDatabase'
            });
            
            isLoading = true;
            renderApp();
          }
        }
        
        async function exportData() {
          vscode.postMessage({
            command: 'exportData'
          });
        }
        
        async function editItem(itemId, itemName) {
          const newName = await showPromptDialog('Enter new name for item:', itemName, 'Edit Item');
          
          if (newName && newName.trim() && newName !== itemName) {
            vscode.postMessage({
              command: 'updateItem',
              itemId: itemId,
              newName: newName.trim()
            });
            
            isLoading = true;
            renderApp();
          }
        }
        
        async function deleteItem(itemId, itemName) {
          const confirmed = await showConfirmDialog('Are you sure you want to delete "' + itemName + '"?', 'Delete Item');
          if (confirmed) {
            vscode.postMessage({
              command: 'deleteItem',
              itemId: itemId
            });
            
            isLoading = true;
            renderApp();
          }
        }
        
        async function viewItemDetails(itemId) {
          vscode.postMessage({
            command: 'viewItemDetails',
            itemId: itemId
          });
        }
        
        // Update event listeners for buttons
        function setupItemActionListeners() {
          document.querySelectorAll('.edit-btn').forEach(button => {
            button.addEventListener('click', () => {
              const itemId = button.getAttribute('data-id');
              const itemName = button.getAttribute('data-name');
              editItem(itemId, itemName);
            });
          });
          
          document.querySelectorAll('.view-btn').forEach(button => {
            button.addEventListener('click', () => {
              const itemId = button.getAttribute('data-id');
              viewItemDetails(itemId);
            });
          });
          
          document.querySelectorAll('.delete-btn').forEach(button => {
            button.addEventListener('click', () => {
              const itemId = button.getAttribute('data-id');
              const itemName = button.getAttribute('data-name');
              deleteItem(itemId, itemName);
            });
          });
        }
        
        // Main render function
        function renderApp() {
          const rootEl = document.getElementById('root');
          
          rootEl.innerHTML = \`
            <div class="container">
              <h1>SQLite Database Manager</h1>
              <p>Manage your database items through the bundled SQLite binary.</p>
              
              <div id="status" class="status info" style="display: none;"></div>
              
              <div class="actions">
                <div class="row" style="margin-right: 10px;">
                  <input type="text" id="itemNameInput" placeholder="Enter item name" style="margin-right: 5px;">
                  <button id="addItemBtn">Add Item</button>
                </div>
                <button id="refreshBtn">Refresh</button>
                <button id="initDatabaseBtn">Initialize Database</button>
                <button id="clearDatabaseBtn">Clear All</button>
                <button id="exportDataBtn">Export Data</button>
              </div>
              
              \${isLoading ? 
                \`<div id="loadingIndicator" class="loading">
                  <div class="spinner"></div> Loading items...
                </div>\` : 
                items.length === 0 ?
                \`<div id="emptyState" class="empty-state">
                  <h3>No items found</h3>
                  <p>Add your first item using the form above or initialize the database.</p>
                </div>\` :
                \`<table id="itemsTable">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Name</th>
                      <th>Created At</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody id="itemsList">
                    \${renderItems()}
                  </tbody>
                </table>\`
              }
            </div>
          \`;
          
          // Set references to DOM elements after render
          statusEl = document.getElementById('status');
          itemNameInput = document.getElementById('itemNameInput');
          loadingIndicator = document.getElementById('loadingIndicator');
          emptyState = document.getElementById('emptyState');
          itemsTable = document.getElementById('itemsTable');
          itemsList = document.getElementById('itemsList');
          
          // Add event listeners
          document.getElementById('addItemBtn').addEventListener('click', addItem);
          document.getElementById('refreshBtn').addEventListener('click', refreshItems);
          document.getElementById('initDatabaseBtn').addEventListener('click', initDatabase);
          document.getElementById('clearDatabaseBtn').addEventListener('click', clearDatabase);
          document.getElementById('exportDataBtn').addEventListener('click', exportData);
          
          itemNameInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
              addItem();
            }
          });
          
          // Set up item action buttons (edit, view, delete)
          setupItemActionListeners();
        }
        
        // Handle message from extension for showing item details
        window.addEventListener('message', event => {
          const message = event.data;
          console.log('Received message:', message);
          
          switch (message.command) {
            // ...existing code...
            
            case 'showItemDetails':
              if (message.details) {
                showAlertDialog(
                  'Item Details:\\n\\n' +
                  'ID: ' + message.details.id + '\\n' +
                  'Name: ' + message.details.name + '\\n' +
                  'Created: ' + message.details.created_at + '\\n' +
                  'Character Length: ' + (message.details.length || 'N/A') + '\\n' +
                  'Word Count: ' + (message.details.words || 'N/A'),
                  'Item Details'
                );
              }
              break;
            
            // ...existing code...
          }
        });
        
        // Initial data load
        refreshItems();
      } catch (err) {
        console.error('Error in WebView script:', err);
      }
    });
  </script>
</body>
</html>`;
}

/**
 * Get the webview HTML for the results panel
 * @param webview The webview to generate HTML for
 * @param results Analysis results to display
 * @returns HTML string for the webview
 */
export function getResultsHtml(webview: vscode.Webview, results: any): string {
  const nonce = getNonce();

  // Convert results to displayable format
  const resultsHtml = formatResults(results);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https:; script-src 'nonce-${nonce}' https:; style-src 'nonce-${nonce}';">
  <title>Analysis Results</title>
  <style nonce="${nonce}">
    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-editor-foreground);
      background-color: var(--vscode-editor-background);
      padding: 20px;
      margin: 0;
    }
    h1 {
      margin-bottom: 16px;
      font-weight: 600;
    }
    h2 {
      margin-top: 24px;
      margin-bottom: 8px;
      font-weight: 500;
    }
    .summary {
      padding: 16px;
      background-color: var(--vscode-editor-lineHighlightBackground);
      border-radius: 4px;
      margin-bottom: 16px;
    }
    .results-container {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .result-item {
      background-color: var(--vscode-editor-lineHighlightBackground);
      border-radius: 4px;
      padding: 16px;
      position: relative;
    }
    .result-item.error {
      border-left: 4px solid #F44336;
    }
    .result-item.warning {
      border-left: 4px solid #FFA500;
    }
    .result-item.info {
      border-left: 4px solid #1E90FF;
    }
    .result-title {
      font-weight: 500;
      margin-bottom: 8px;
    }
    .result-description {
      margin-bottom: 12px;
    }
    .result-location {
      font-family: var(--vscode-editor-font-family);
      font-size: var(--vscode-editor-font-size);
      background-color: var(--vscode-input-background);
      padding: 4px 8px;
      border-radius: 2px;
      margin-bottom: 8px;
    }
    .result-code {
      font-family: var(--vscode-editor-font-family);
      font-size: var(--vscode-editor-font-size);
      background-color: var(--vscode-input-background);
      padding: 8px;
      border-radius: 2px;
      white-space: pre;
      overflow-x: auto;
    }
    .tag {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 4px;
      margin-right: 8px;
      font-size: 12px;
      font-weight: 500;
    }
    .tag.error {
      background-color: rgba(244, 67, 54, 0.1);
      color: #F44336;
    }
    .tag.warning {
      background-color: rgba(255, 165, 0, 0.1);
      color: #FFA500;
    }
    .tag.info {
      background-color: rgba(30, 144, 255, 0.1);
      color: #1E90FF;
    }
    .action-buttons {
      margin-top: 12px;
      display: flex;
      gap: 8px;
    }
    button {
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      padding: 6px 12px;
      border-radius: 3px;
      cursor: pointer;
    }
    button:hover {
      background-color: var(--vscode-button-hoverBackground);
    }
  </style>
</head>
<body>
  <h1>Analysis Results</h1>

  <div class="summary">
    ${results.summary || "Analysis completed successfully."}
  </div>

  <div class="results-container">
    ${resultsHtml}
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    
    document.querySelectorAll('.copy-btn').forEach(button => {
      button.addEventListener('click', (e) => {
        const code = e.target.parentElement.previousElementSibling.textContent;
        vscode.postMessage({
          command: 'copy',
          text: code
        });
      });
    });
    
    document.querySelectorAll('.goto-btn').forEach(button => {
      button.addEventListener('click', (e) => {
        const location = e.target.dataset.location;
        vscode.postMessage({
          command: 'goto',
          location: location
        });
      });
    });
  </script>
</body>
</html>`;
}

/**
 * Format analysis results into HTML
 * @param results Analysis results to format
 * @returns Formatted HTML string
 */
function formatResults(results: any): string {
  if (
    !results ||
    !results.items ||
    !Array.isArray(results.items) ||
    results.items.length === 0
  ) {
    return '<div class="result-item info"><div class="result-title">No issues found</div><div class="result-description">Code analysis completed successfully with no issues detected.</div></div>';
  }

  return results.items
    .map((item: any) => {
      const severity = item.severity?.toLowerCase() || "info";
      const location = item.location
        ? `${item.location.file}:${item.location.line}:${item.location.column || 0}`
        : "Unknown location";

      return `<div class="result-item ${severity}">
      <div class="result-title">
        <span class="tag ${severity}">${severity.toUpperCase()}</span>
        ${escapeHtml(item.title || "Issue detected")}
      </div>
      <div class="result-description">${escapeHtml(item.message || "")}</div>
      <div class="result-location">${escapeHtml(location)}</div>
      ${item.code ? `<div class="result-code">${escapeHtml(item.code)}</div>` : ""}
      <div class="action-buttons">
        ${item.location ? `<button class="goto-btn" data-location="${escapeHtml(JSON.stringify(item.location))}">Go to Issue</button>` : ""}
        ${item.code ? `<button class="copy-btn">Copy Code</button>` : ""}
      </div>
    </div>`;
    })
    .join("");
}

/**
 * Escape HTML special characters
 * @param unsafe Potentially unsafe string
 * @returns Escaped safe string
 */
function escapeHtml(unsafe: string): string {
  return unsafe
    .toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
