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
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https:; script-src 'nonce-${nonce}' https://code.jquery.com 'nonce-${nonce}'; style-src 'nonce-${nonce}';">
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

  <!-- Add jQuery for easier DOM manipulation -->
  <script nonce="${nonce}" src="https://code.jquery.com/jquery-3.7.1.min.js" 
    integrity="sha256-/JqT3SQfawRcv/BIHPThkBvs0OEvtFFmqPF/lYI/Cxo=" 
    crossorigin="anonymous"></script>

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
    
    // Wait for DOM to be fully loaded using jQuery
    $(document).ready(function() {
      try {
        // State variables
        let items = [];
        let isLoading = true;
        let currentPromiseResolve = null;
        
        // DOM elements - will be set after render
        let $status;
        let $itemNameInput;
        let $loadingIndicator;
        let $emptyState;
        let $itemsTable;
        let $itemsList;
        
        // Custom modal dialogs
        function showConfirmDialog(message, title = 'Confirm') {
          return new Promise((resolve) => {
            currentPromiseResolve = resolve;
            
            const $modal = $('<div>')
              .addClass('modal-overlay')
              .append(
                $('<div>')
                  .addClass('modal-container')
                  .append(
                    $('<div>')
                      .addClass('modal-header')
                      .append($('<h3>').addClass('modal-title').text(title)),
                    $('<div>')
                      .addClass('modal-body')
                      .text(message),
                    $('<div>')
                      .addClass('modal-footer')
                      .append(
                        $('<button>').addClass('cancel-btn').text('Cancel'),
                        $('<button>').addClass('confirm-btn').text('Confirm')
                      )
                  )
              );
            
            $('body').append($modal);
            
            $('.confirm-btn').on('click', function() {
              $modal.remove();
              resolve(true);
            });
            
            $('.cancel-btn').on('click', function() {
              $modal.remove();
              resolve(false);
            });
          });
        }
        
        function showPromptDialog(message, defaultValue = '', title = 'Input') {
          return new Promise((resolve) => {
            currentPromiseResolve = resolve;
            
            const $modal = $('<div>')
              .addClass('modal-overlay')
              .append(
                $('<div>')
                  .addClass('modal-container')
                  .append(
                    $('<div>')
                      .addClass('modal-header')
                      .append($('<h3>').addClass('modal-title').text(title)),
                    $('<div>')
                      .addClass('modal-body')
                      .append(
                        $('<p>').text(message),
                        $('<input>').addClass('modal-input').attr('type', 'text').val(defaultValue)
                      ),
                    $('<div>')
                      .addClass('modal-footer')
                      .append(
                        $('<button>').addClass('cancel-btn').text('Cancel'),
                        $('<button>').addClass('confirm-btn').text('OK')
                      )
                  )
              );
            
            $('body').append($modal);
            
            const $input = $('.modal-input');
            $input.focus().select();
            
            $('.confirm-btn').on('click', function() {
              const value = $input.val();
              $modal.remove();
              resolve(value);
            });
            
            $('.cancel-btn').on('click', function() {
              $modal.remove();
              resolve(null);
            });
            
            $input.on('keyup', function(e) {
              if (e.key === 'Enter') {
                const value = $input.val();
                $modal.remove();
                resolve(value);
              } else if (e.key === 'Escape') {
                $modal.remove();
                resolve(null);
              }
            });
          });
        }
        
        function showAlertDialog(message, title = 'Alert') {
          return new Promise((resolve) => {
            currentPromiseResolve = resolve;
            
            const $modal = $('<div>')
              .addClass('modal-overlay')
              .append(
                $('<div>')
                  .addClass('modal-container')
                  .append(
                    $('<div>')
                      .addClass('modal-header')
                      .append($('<h3>').addClass('modal-title').text(title)),
                    $('<div>')
                      .addClass('modal-body')
                      .text(message),
                    $('<div>')
                      .addClass('modal-footer')
                      .append(
                        $('<button>').addClass('ok-btn').text('OK')
                      )
                  )
              );
            
            $('body').append($modal);
            
            $('.ok-btn').on('click', function() {
              $modal.remove();
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
        
        // Helper functions
        function renderItems() {
          if (items.length === 0) return '';
          
          return items.map(item => {
            return $('<tr>')
              .append(
                $('<td>').text(item.id),
                $('<td>').text(item.name),
                $('<td>').text(item.created_at),
                $('<td>').append(
                  $('<div>').addClass('item-actions')
                    .append(
                      $('<button>').addClass('edit-btn').text('Edit')
                        .attr('data-id', item.id)
                        .attr('data-name', item.name),
                      $('<button>').addClass('view-btn').text('View')
                        .attr('data-id', item.id),
                      $('<button>').addClass('delete-btn').text('Delete')
                        .attr('data-id', item.id)
                        .attr('data-name', item.name)
                    )
                )
              )[0].outerHTML;
          }).join('');
        }
        
        function showStatus(message, type = 'info') {
          if (!$status) return;
          
          $status.text(message).attr('class', 'status ' + type).css('display', message ? 'block' : 'none');
        }
        
        function hideStatus() {
          if ($status) {
            $status.css('display', 'none');
          }
        }
        
        function escapeHtml(unsafe) {
          if (!unsafe) return '';
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
          const name = $itemNameInput.val().trim();
          
          if (!name) {
            showStatus('Please enter an item name', 'error');
            return;
          }
          
          vscode.postMessage({
            command: 'addItem',
            itemName: name
          });
          
          $itemNameInput.val('');
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
          $status = $('#status');
          $itemNameInput = $('#itemNameInput');
          $loadingIndicator = $('#loadingIndicator');
          $emptyState = $('#emptyState');
          $itemsTable = $('#itemsTable');
          $itemsList = $('#itemsList');
          
          // Add event listeners
          $('#addItemBtn').on('click', addItem);
          $('#refreshBtn').on('click', refreshItems);
          $('#initDatabaseBtn').on('click', initDatabase);
          $('#clearDatabaseBtn').on('click', clearDatabase);
          $('#exportDataBtn').on('click', exportData);
          
          if ($itemNameInput) {
            $itemNameInput.on('keypress', function(e) {
              if (e.key === 'Enter') {
                addItem();
              }
            });
          }
          
          // Set up item action buttons (edit, view, delete)
          setupItemActionListeners();
        }
        
        // Update event listeners for buttons
        function setupItemActionListeners() {
          $('.edit-btn').off('click').on('click', function() {
            const itemId = $(this).data('id');
            const itemName = $(this).data('name');
            editItem(itemId, itemName);
          });
          
          $('.view-btn').off('click').on('click', function() {
            const itemId = $(this).data('id');
            viewItemDetails(itemId);
          });
          
          $('.delete-btn').off('click').on('click', function() {
            const itemId = $(this).data('id');
            const itemName = $(this).data('name');
            deleteItem(itemId, itemName);
          });
        }
        
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
 * Escape HTML special characters
 * @param unsafe Potentially unsafe string
 * @returns Escaped safe string
 */
function escapeHtml(unsafe: string): string {
  if (!unsafe) return '';
  return unsafe
    .toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
