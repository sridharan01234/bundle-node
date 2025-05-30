import * as vscode from "vscode";
import { DatabaseService } from "../services/DatabaseService";
import { WebviewMessage, ExtensionMessage } from "../types";
import { Logger } from "../utils/Logger";
import { UIUtils } from "../utils/UIUtils";

/**
 * Manages the database webview panel
 */
export class WebviewManager {
  private static currentPanel: WebviewManager | undefined;
  private readonly panel: vscode.WebviewPanel;
  private readonly databaseService: DatabaseService;
  private disposables: vscode.Disposable[] = [];

  private constructor(panel: vscode.WebviewPanel, binaryPath: string) {
    this.panel = panel;
    this.databaseService = new DatabaseService(binaryPath);

    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    this.panel.webview.onDidReceiveMessage(
      this.handleWebviewMessage.bind(this),
      null,
      this.disposables,
    );

    this.updateWebview();
    this.loadItems();
  }

  public static createOrShow(extensionUri: vscode.Uri, binaryPath: string) {
    if (WebviewManager.currentPanel) {
      WebviewManager.currentPanel.panel.reveal();
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      "databaseManager",
      "SQLite Database Manager",
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [extensionUri],
      },
    );

    WebviewManager.currentPanel = new WebviewManager(panel, binaryPath);
  }

  private async handleWebviewMessage(message: WebviewMessage) {
    try {
      Logger.info(`Received webview message: ${message.command}`);

      switch (message.command) {
        case "refresh":
          await this.loadItems();
          break;
        case "initDatabase":
          await this.databaseService.initializeDatabase();
          UIUtils.showInfo("Database initialized successfully");
          await this.loadItems();
          break;
        case "addItem":
          await this.databaseService.addItem(message.itemName);
          UIUtils.showInfo(`Added item: ${message.itemName}`);
          await this.loadItems();
          break;
        case "deleteItem":
          await this.databaseService.deleteItem(message.itemId);
          UIUtils.showInfo("Item deleted successfully");
          await this.loadItems();
          break;
        case "updateItem":
          await this.databaseService.updateItem(
            message.itemId,
            message.newName,
          );
          UIUtils.showInfo("Item updated successfully");
          await this.loadItems();
          break;
        case "clearDatabase":
          await this.databaseService.clearDatabase();
          UIUtils.showInfo("Database cleared successfully");
          await this.loadItems();
          break;
        case "exportData":
          await this.exportData();
          break;
        case "viewItemDetails":
          await this.showItemDetails(message.itemId);
          break;
      }
    } catch (error: any) {
      Logger.error(`Error handling webview message: ${error.message}`);
      this.sendMessage({ command: "showError", message: error.message });
      UIUtils.showError(error.message);
    }
  }

  private async loadItems() {
    try {
      this.sendMessage({ command: "showLoading", message: "Loading items..." });
      const items = await this.databaseService.listItems();
      this.sendMessage({
        command: "updateItems",
        success: true,
        items: JSON.stringify(items),
      });
    } catch (error: any) {
      this.sendMessage({
        command: "updateItems",
        success: false,
        error: error.message,
      });
    }
  }

  private async exportData() {
    try {
      const items = await this.databaseService.exportData();
      const exportData = {
        timestamp: new Date().toISOString(),
        data: items,
      };

      const uri = await UIUtils.showSaveDialog("database_export.json");
      if (uri) {
        await UIUtils.writeFile(uri, JSON.stringify(exportData, null, 2));
        UIUtils.showInfo(`Database exported to ${uri.fsPath}`);
      }
    } catch (error: any) {
      UIUtils.showError(`Failed to export data: ${error.message}`);
    }
  }

  private async showItemDetails(itemId: string) {
    try {
      const details = await this.databaseService.getItemDetails(itemId);
      if (details) {
        this.sendMessage({ command: "showItemDetails", details });
      }
    } catch (error: any) {
      UIUtils.showError(`Failed to get item details: ${error.message}`);
    }
  }

  private sendMessage(message: ExtensionMessage) {
    this.panel.webview.postMessage(message);
  }

  private updateWebview() {
    this.panel.webview.html = this.getWebviewContent();
  }

  private getWebviewContent(): string {
    const nonce = this.getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}' https://code.jquery.com; style-src 'nonce-${nonce}'; img-src data: https:;">
  <title>SQLite Database Manager</title>
  <style nonce="${nonce}">
    body { 
      font-family: var(--vscode-font-family); 
      padding: 20px; 
      color: var(--vscode-foreground); 
      background-color: var(--vscode-editor-background); 
      margin: 0;
    }
    .container { max-width: 800px; margin: 0 auto; }
    .status { 
      margin: 10px 0; 
      padding: 10px; 
      border-radius: 3px; 
      display: none;
    }
    .info { background-color: rgba(65, 105, 225, 0.1); border-left: 4px solid royalblue; }
    .success { background-color: rgba(50, 205, 50, 0.1); border-left: 4px solid limegreen; }
    .error { background-color: rgba(255, 0, 0, 0.1); border-left: 4px solid red; }
    .warning { background-color: rgba(255, 165, 0, 0.1); border-left: 4px solid orange; }
    
    /* Modal styles */
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.5);
      display: none;
      z-index: 1000;
    }
    .modal {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background-color: var(--vscode-editor-background);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 6px;
      padding: 20px;
      min-width: 300px;
      max-width: 500px;
      z-index: 1001;
    }
    .modal-header {
      font-weight: 600;
      margin-bottom: 15px;
      color: var(--vscode-foreground);
    }
    .modal-content {
      margin-bottom: 20px;
      color: var(--vscode-descriptionForeground);
    }
    .modal-actions {
      display: flex;
      gap: 10px;
      justify-content: flex-end;
    }
    
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
      font-weight: 600;
    }
    button { 
      background-color: var(--vscode-button-background); 
      color: var(--vscode-button-foreground); 
      border: none; 
      padding: 6px 12px; 
      border-radius: 3px; 
      cursor: pointer; 
      margin: 2px; 
      font-size: 12px;
    }
    button:hover {
      background-color: var(--vscode-button-hoverBackground);
    }
    button.secondary {
      background-color: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }
    button.secondary:hover {
      background-color: var(--vscode-button-secondaryHoverBackground);
    }
    button.danger {
      background-color: #d73a49;
      color: white;
    }
    button.danger:hover {
      background-color: #cb2431;
    }
    input { 
      padding: 6px; 
      border: 1px solid var(--vscode-input-border); 
      background-color: var(--vscode-input-background); 
      color: var(--vscode-input-foreground); 
      border-radius: 3px; 
      margin-right: 8px;
      width: 200px;
    }
    .actions { 
      margin: 20px 0; 
      display: flex; 
      flex-wrap: wrap; 
      align-items: center; 
      gap: 8px; 
    }
    .loading { 
      display: flex; 
      align-items: center; 
      justify-content: center; 
      padding: 40px 0; 
    }
    .spinner { 
      width: 20px; 
      height: 20px; 
      border: 2px solid rgba(0,0,0,0.1); 
      border-top-color: var(--vscode-textLink-activeForeground); 
      border-radius: 50%; 
      animation: spin 1s ease-in-out infinite; 
      margin-right: 8px;
    }
    .empty-state {
      text-align: center;
      padding: 40px 0;
      color: var(--vscode-descriptionForeground);
    }
    .item-actions {
      display: flex;
      gap: 4px;
    }
    @keyframes spin { 
      to { transform: rotate(360deg); } 
    }
  </style>
</head>
<body>
  <div id="root">
    <div class="container">
      <h1>SQLite Database Manager</h1>
      <p>Manage your database items through the bundled SQLite binary.</p>
      <div id="status" class="status"></div>
      <div class="actions">
        <input type="text" id="itemName" placeholder="Enter item name">
        <button id="addItemBtn">Add Item</button>
        <button id="refreshBtn">Refresh</button>
        <button id="initBtn">Initialize</button>
        <button id="exportBtn">Export</button>
      </div>
      <div id="content">
        <div class="loading"><div class="spinner"></div>Loading...</div>
      </div>
    </div>
  </div>

  <!-- Custom Modal -->
  <div id="modalOverlay" class="modal-overlay">
    <div class="modal">
      <div id="modalHeader" class="modal-header"></div>
      <div id="modalContent" class="modal-content"></div>
      <div class="modal-actions">
        <button id="modalCancel" class="secondary">Cancel</button>
        <button id="modalConfirm">Confirm</button>
      </div>
    </div>
  </div>

  <!-- Edit Modal -->
  <div id="editModalOverlay" class="modal-overlay">
    <div class="modal">
      <div class="modal-header">Edit Item</div>
      <div class="modal-content">
        <input type="text" id="editItemName" placeholder="Enter new name" style="width: 100%; margin-right: 0;">
      </div>
      <div class="modal-actions">
        <button id="editModalCancel" class="secondary">Cancel</button>
        <button id="editModalSave">Save</button>
      </div>
    </div>
  </div>

  <script src="https://code.jquery.com/jquery-3.7.1.min.js" nonce="${nonce}"></script>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    let items = [];
    let currentEditId = null;
    let confirmCallback = null;

    $(document).ready(() => {
      // Set up event listeners using jQuery (no inline handlers)
      $('#itemName').on('keypress', (e) => {
        if (e.which === 13) addItem();
      });

      $('#addItemBtn').on('click', addItem);
      $('#refreshBtn').on('click', refreshItems);
      $('#initBtn').on('click', () => showConfirmModal('Initialize Database', 'This will create a new database if none exists. Continue?', initDatabase));
      $('#exportBtn').on('click', exportData);

      // Set up delegation for dynamically created buttons
      $(document).on('click', '.view-item-btn', function() {
        const itemId = $(this).data('item-id');
        viewItem(itemId);
      });

      $(document).on('click', '.edit-item-btn', function() {
        const itemId = $(this).data('item-id');
        const itemName = $(this).data('item-name');
        showEditModal(itemId, itemName);
      });

      $(document).on('click', '.delete-item-btn', function() {
        const itemId = $(this).data('item-id');
        const itemName = $(this).data('item-name');
        showConfirmModal('Delete Item', \`Are you sure you want to delete "\${itemName}"? This action cannot be undone.\`, () => deleteItem(itemId));
      });

      // Modal event handlers
      $('#modalCancel, #modalOverlay').on('click', hideConfirmModal);
      $('#modalConfirm').on('click', () => {
        if (confirmCallback) {
          confirmCallback();
          confirmCallback = null;
        }
        hideConfirmModal();
      });

      $('#editModalCancel, #editModalOverlay').on('click', hideEditModal);
      $('#editModalSave').on('click', saveEdit);
      $('#editItemName').on('keypress', (e) => {
        if (e.which === 13) saveEdit();
      });

      // Prevent modal from closing when clicking inside
      $('.modal').on('click', (e) => {
        e.stopPropagation();
      });
    });

    window.addEventListener('message', (event) => {
      const message = event.data;
      console.log('Received message:', message);
      
      switch (message.command) {
        case 'updateItems':
          if (message.success) {
            try {
              items = JSON.parse(message.items || '[]');
              renderItems();
              if (items.length > 0) {
                showStatus('Items loaded successfully', 'success');
              }
            } catch (err) {
              showStatus('Error parsing items data', 'error');
            }
          } else {
            showStatus(message.error || 'Failed to load items', 'error');
          }
          break;
        case 'showError':
          showStatus(message.message, 'error');
          break;
        case 'showSuccess':
          showStatus(message.message, 'success');
          break;
        case 'showItemDetails':
          showStatus(\`Item Details: \${message.details.name} (ID: \${message.details.id}, Length: \${message.details.length} chars, Words: \${message.details.words})\`, 'info');
          break;
      }
    });

    function addItem() {
      const name = $('#itemName').val().trim();
      if (!name) {
        showStatus('Please enter an item name', 'error');
        return;
      }
      vscode.postMessage({ command: 'addItem', itemName: name });
      $('#itemName').val('');
    }

    function refreshItems() {
      showStatus('Loading items...', 'info');
      vscode.postMessage({ command: 'refresh' });
    }

    function initDatabase() {
      vscode.postMessage({ command: 'initDatabase' });
    }

    function exportData() {
      vscode.postMessage({ command: 'exportData' });
    }

    function viewItem(id) {
      vscode.postMessage({ command: 'viewItemDetails', itemId: id });
    }

    function deleteItem(id) {
      showStatus('Deleting item...', 'warning');
      vscode.postMessage({ command: 'deleteItem', itemId: id });
    }

    function updateItem(id, newName) {
      vscode.postMessage({ command: 'updateItem', itemId: id, newName: newName });
    }

    function showConfirmModal(title, message, callback) {
      $('#modalHeader').text(title);
      $('#modalContent').text(message);
      confirmCallback = callback;
      $('#modalOverlay').show();
    }

    function hideConfirmModal() {
      $('#modalOverlay').hide();
      confirmCallback = null;
    }

    function showEditModal(itemId, itemName) {
      currentEditId = itemId;
      $('#editItemName').val(itemName);
      $('#editModalOverlay').show();
      $('#editItemName').focus();
    }

    function hideEditModal() {
      $('#editModalOverlay').hide();
      currentEditId = null;
    }

    function saveEdit() {
      const newName = $('#editItemName').val().trim();
      if (!newName) {
        showStatus('Please enter a valid name', 'error');
        return;
      }
      if (currentEditId) {
        updateItem(currentEditId, newName);
        hideEditModal();
      }
    }

    function renderItems() {
      if (items.length === 0) {
        $('#content').html('<div class="empty-state"><h3>No items found</h3><p>Add your first item using the form above or initialize the database.</p></div>');
        return;
      }

      const table = \`
        <table>
          <thead>
            <tr><th>ID</th><th>Name</th><th>Created</th><th>Actions</th></tr>
          </thead>
          <tbody>
            \${items.map(item => \`
              <tr>
                <td>\${escapeHtml(item.id)}</td>
                <td>\${escapeHtml(item.name)}</td>
                <td>\${escapeHtml(item.created_at)}</td>
                <td>
                  <div class="item-actions">
                    <button class="view-item-btn" data-item-id="\${escapeHtml(item.id)}">View</button>
                    <button class="edit-item-btn" data-item-id="\${escapeHtml(item.id)}" data-item-name="\${escapeHtml(item.name)}">Edit</button>
                    <button class="delete-item-btn danger" data-item-id="\${escapeHtml(item.id)}" data-item-name="\${escapeHtml(item.name)}">Delete</button>
                  </div>
                </td>
              </tr>
            \`).join('')}
          </tbody>
        </table>
      \`;
      $('#content').html(table);
    }

    function showStatus(message, type) {
      $('#status').removeClass().addClass('status ' + type).text(message).show();
      setTimeout(() => $('#status').fadeOut(), 3000);
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

    // Initial load
    refreshItems();
  </script>
</body>
</html>`;
  }

  private getNonce(): string {
    let text = "";
    const possible =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }

  public dispose() {
    WebviewManager.currentPanel = undefined;
    this.panel.dispose();
    while (this.disposables.length) {
      const x = this.disposables.pop();
      if (x) x.dispose();
    }
  }
}
