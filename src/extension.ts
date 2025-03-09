import * as vscode from 'vscode';
import { MCPManager } from './mcp/MCPManager';
import { AIService } from './services/AIService';
import { TokenService } from './services/TokenService';
import { TerminalService } from './services/TerminalService';
import { BrowserService } from './services/BrowserService';
import { MCPToolCreator } from './mcp/MCPToolCreator';
import { SnapshotService } from './services/SnapshotService';

export function activate(context: vscode.ExtensionContext) {
    const mcpManager = new MCPManager();
    const tokenService = new TokenService();
    const aiService = new AIService(tokenService);
    const terminalService = new TerminalService();
    const browserService = new BrowserService(context);
    const snapshotService = new SnapshotService(context);

    // 註冊更新模型列表命令
    let updateModelsCommand = vscode.commands.registerCommand('ai-assistant.updateModels', async () => {
        await aiService.updateOpenRouterModels();
        vscode.window.showInformationMessage('已更新 OpenRouter 模型列表');
    });

    // 註冊瀏覽器相關命令
    let launchBrowserCommand = vscode.commands.registerCommand('ai-assistant.launchBrowser', async () => {
        const url = await vscode.window.showInputBox({
            prompt: '輸入要打開的 URL',
            placeHolder: 'https://1.0.0.12:8080'
        });
        
        if (url) {
            const result = await browserService.launchBrowser(url);
            vscode.window.showInformationMessage(result);
        }
    });

    let closeBrowserCommand = vscode.commands.registerCommand('ai-assistant.closeBrowser', async () => {
        const result = await browserService.closeBrowser();
        vscode.window.showInformationMessage(result);
    });

    let takeScreenshotCommand = vscode.commands.registerCommand('ai-assistant.takeScreenshot', async () => {
        const screenshotPath = await browserService.takeScreenshot();
        vscode.window.showInformationMessage(`截圖已保存至: ${screenshotPath}`);
    });

    // 註冊快照相關命令
    let createSnapshotCommand = vscode.commands.registerCommand('ai-assistant.createSnapshot', async () => {
        const description = await vscode.window.showInputBox({
            prompt: '輸入快照描述',
            placeHolder: '例如: 實現登入功能'
        });
        
        if (description) {
            const snapshot = await snapshotService.createSnapshot(description);
            if (snapshot) {
                vscode.window.showInformationMessage(`已創建快照: ${description}`);
            }
        }
    });

    let listSnapshotsCommand = vscode.commands.registerCommand('ai-assistant.listSnapshots', async () => {
        const snapshots = snapshotService.getAllSnapshots();
        
        if (snapshots.length === 0) {
            vscode.window.showInformationMessage('沒有可用的快照');
            return;
        }
        
        const items = snapshots.map(snapshot => ({
            label: `${new Date(snapshot.timestamp).toLocaleString()}`,
            description: snapshot.description,
            id: snapshot.id
        }));
        
        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: '選擇要查看的快照'
        });
        
        if (selected) {
            const actions = [
                '比較與當前工作區',
                '還原工作區',
                '還原任務和工作區',
                '刪除快照'
            ];
            
            const action = await vscode.window.showQuickPick(actions, {
                placeHolder: '選擇操作'
            });
            
            if (action === '比較與當前工作區') {
                await snapshotService.compareSnapshotWithWorkspace(selected.id);
            } else if (action === '還原工作區') {
                await snapshotService.restoreSnapshot(selected.id, false);
            } else if (action === '還原任務和工作區') {
                await snapshotService.restoreSnapshot(selected.id, true);
            } else if (action === '刪除快照') {
                snapshotService.deleteSnapshot(selected.id);
            }
        }
    });

    // 註冊 AI 助手命令
    let chatCommand = vscode.commands.registerCommand('ai-assistant.chat', async () => {
        // 開始新任務並創建初始快照
        const taskId = snapshotService.startTask('AI 助手任務開始');
        await snapshotService.createSnapshot('初始狀態');
        
        const panel = vscode.window.createWebviewPanel(
            'aiAssistant',
            'AI Assistant',
            vscode.ViewColumn.Two,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        // 處理來自 WebView 的消息
        panel.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.command) {
                    case 'sendMessage':
                        try {
                            const response = await aiService.sendMessage(message.text);
                            // 發送回覆到 WebView
                            panel.webview.postMessage({ 
                                type: 'response', 
                                text: response 
                            });
                        } catch (error) {
                            vscode.window.showErrorMessage('AI 服務錯誤: ' + error.message);
                        }
                        break;
                    case 'installMCPTool':
                        try {
                            const result = await mcpManager.installTool(message.toolDefinition);
                            if (result.success) {
                                vscode.window.showInformationMessage(`成功安裝工具: ${result.data.name}`);
                            } else {
                                vscode.window.showErrorMessage(`安裝工具失敗: ${result.error}`);
                            }
                        } catch (error) {
                            vscode.window.showErrorMessage(`安裝工具時發生錯誤: ${error.message}`);
                        }
                        break;
                    case 'executeMCPCommand':
                        try {
                            const result = await mcpManager.executeCommand(
                                message.tool,
                                message.command,
                                message.parameters
                            );
                            panel.webview.postMessage({
                                type: 'mcpResponse',
                                success: result.success,
                                data: result.data,
                                error: result.error
                            });
                        } catch (error) {
                            vscode.window.showErrorMessage(`執行命令時發生錯誤: ${error.message}`);
                        }
                        break;
                    case 'launchBrowser':
                        try {
                            const result = await browserService.launchBrowser(message.url);
                            panel.webview.postMessage({
                                type: 'browserAction',
                                action: 'launch',
                                result: result
                            });
                        } catch (error) {
                            vscode.window.showErrorMessage(`啟動瀏覽器失敗: ${error.message}`);
                        }
                        break;
                    case 'navigateTo':
                        try {
                            const result = await browserService.navigateTo(message.url);
                            panel.webview.postMessage({
                                type: 'browserAction',
                                action: 'navigate',
                                result: result
                            });
                        } catch (error) {
                            vscode.window.showErrorMessage(`導航失敗: ${error.message}`);
                        }
                        break;
                    case 'clickElement':
                        try {
                            const result = await browserService.click(message.selector);
                            panel.webview.postMessage({
                                type: 'browserAction',
                                action: 'click',
                                result: result
                            });
                        } catch (error) {
                            vscode.window.showErrorMessage(`點擊元素失敗: ${error.message}`);
                        }
                        break;
                    case 'typeText':
                        try {
                            const result = await browserService.type(message.selector, message.text);
                            panel.webview.postMessage({
                                type: 'browserAction',
                                action: 'type',
                                result: result
                            });
                        } catch (error) {
                            vscode.window.showErrorMessage(`輸入文字失敗: ${error.message}`);
                        }
                        break;
                    case 'scrollPage':
                        try {
                            const result = await browserService.scroll(message.pixels);
                            panel.webview.postMessage({
                                type: 'browserAction',
                                action: 'scroll',
                                result: result
                            });
                        } catch (error) {
                            vscode.window.showErrorMessage(`滾動頁面失敗: ${error.message}`);
                        }
                        break;
                    case 'takeScreenshot':
                        try {
                            const screenshotPath = await browserService.takeScreenshot();
                            panel.webview.postMessage({
                                type: 'browserAction',
                                action: 'screenshot',
                                result: screenshotPath
                            });
                        } catch (error) {
                            vscode.window.showErrorMessage(`截圖失敗: ${error.message}`);
                        }
                        break;
                    case 'getConsoleLog':
                        try {
                            const logs = await browserService.getConsoleLog();
                            panel.webview.postMessage({
                                type: 'browserAction',
                                action: 'consoleLogs',
                                result: logs
                            });
                        } catch (error) {
                            vscode.window.showErrorMessage(`獲取控制台日誌失敗: ${error.message}`);
                        }
                        break;
                    case 'closeBrowser':
                        try {
                            const result = await browserService.closeBrowser();
                            panel.webview.postMessage({
                                type: 'browserAction',
                                action: 'close',
                                result: result
                            });
                        } catch (error) {
                            vscode.window.showErrorMessage(`關閉瀏覽器失敗: ${error.message}`);
                        }
                        break;
                    case 'createSnapshot':
                        try {
                            const snapshot = await snapshotService.createSnapshot(message.description);
                            panel.webview.postMessage({
                                type: 'snapshotCreated',
                                timestamp: snapshot?.timestamp
                            });
                        } catch (error) {
                            vscode.window.showErrorMessage(`創建快照失敗: ${error.message}`);
                        }
                        break;
                    case 'compareSnapshots':
                        try {
                            await snapshotService.compareSnapshotWithWorkspace(message.snapshotId);
                        } catch (error) {
                            vscode.window.showErrorMessage(`比較快照失敗: ${error.message}`);
                        }
                        break;
                    case 'restoreSnapshot':
                        try {
                            await snapshotService.restoreSnapshot(message.snapshotId, message.restoreTaskState);
                        } catch (error) {
                            vscode.window.showErrorMessage(`還原快照失敗: ${error.message}`);
                        }
                        break;
                }
            },
            undefined,
            context.subscriptions
        );

        // 當WebView被關閉時，結束當前任務
        panel.onDidDispose(() => {
            snapshotService.endTask();
        }, null, context.subscriptions);

        // 更新 WebView 內容以包含 MCP 工具列表
        panel.webview.html = getWebviewContent(mcpManager.getTools());
    });

    // 添加創建 MCP 工具命令
    let createMCPToolCommand = vscode.commands.registerCommand('ai-assistant.createMCPTool', async () => {
        const tool = await MCPToolCreator.createTool();
        if (tool) {
            const toolJson = MCPToolCreator.toolToJson(tool);
            
            // 創建並顯示工具定義
            const document = await vscode.workspace.openTextDocument({
                content: toolJson,
                language: 'json'
            });
            await vscode.window.showTextDocument(document);
            
            // 詢問是否安裝
            const install = await vscode.window.showQuickPick(['是', '否'], {
                placeHolder: '立即安裝這個工具?'
            });
            
            if (install === '是') {
                const result = await mcpManager.installTool(toolJson);
                if (result.success) {
                    vscode.window.showInformationMessage(`成功安裝工具: ${result.data.name}`);
                } else {
                    vscode.window.showErrorMessage(`安裝工具失敗: ${result.error}`);
                }
            }
        }
    });

    context.subscriptions.push(chatCommand, updateModelsCommand, launchBrowserCommand, closeBrowserCommand, takeScreenshotCommand, createMCPToolCommand, createSnapshotCommand, listSnapshotsCommand);
}

function getWebviewContent(tools: any[]) {
    const toolsHtml = tools.map(tool => `
        <div class="tool-item">
            <h3>${tool.name} <span class="version">v${tool.version}</span></h3>
            <p>${tool.description}</p>
            <div class="commands">
                <h4>命令:</h4>
                <ul>
                    ${tool.commands.map(cmd => `
                        <li>
                            <strong>${cmd.name}</strong>: ${cmd.description}
                            <button class="execute-btn" data-tool="${tool.name}" data-command="${cmd.name}">執行</button>
                        </li>
                    `).join('')}
                </ul>
            </div>
        </div>
    `).join('');
    
    // 在側邊欄添加快照部分
    const sidebarHtml = `
        <div class="sidebar">
            <h2>AI 配置</h2>
            <div class="config-section">
                <label for="provider-select">供應商:</label>
                <select id="provider-select">
                    <option value="openrouter">OpenRouter</option>
                    <option value="anthropic">Anthropic</option>
                    <option value="openai">OpenAI</option>
                    <option value="google">Google</option>
                    <option value="aws">AWS</option>
                    <option value="azure">Azure</option>
                    <option value="vertex">GCP Vertex</option>
                    <option value="custom">自定義</option>
                </select>
            </div>
            <div class="config-section">
                <label for="model-select">模型:</label>
                <select id="model-select">
                    <!-- 將由 JavaScript 動態填充 -->
                </select>
            </div>
            <div class="token-info">
                <div>用量: <span id="token-count">0</span> 令牌</div>
                <div>成本: $<span id="token-cost">0.00</span></div>
            </div>
            
            <h2>MCP 工具</h2>
            <button id="add-tool-btn">添加工具</button>
            <div class="tools-container">
                ${toolsHtml}
            </div>
            
            <h2>操作</h2>
            <div class="actions">
                <button id="add-file-btn">添加文件</button>
                <button id="add-folder-btn">添加資料夾</button>
                <button id="add-url-btn">添加 URL</button>
                <button id="add-terminal-btn">執行命令</button>
                <button id="launch-browser-btn">啟動瀏覽器</button>
            </div>
            
            <h2>工作區快照</h2>
            <div class="snapshot-actions">
                <button id="create-snapshot-btn">創建快照</button>
                <button id="list-snapshots-btn">查看快照</button>
            </div>
        </div>
    `;
    
    // 在 JavaScript 中添加快照按鈕處理
    const snapshotJavaScript = `
        const vscode = acquireVsCodeApi();
        const messagesDiv = document.getElementById('messages');
        const userInput = document.getElementById('user-input');
        const sendButton = document.getElementById('send-button');
        const providerSelect = document.getElementById('provider-select');
        const modelSelect = document.getElementById('model-select');
        const addToolBtn = document.getElementById('add-tool-btn');
        const addFileBtn = document.getElementById('add-file-btn');
        const addFolderBtn = document.getElementById('add-folder-btn');
        const addUrlBtn = document.getElementById('add-url-btn');
        const addTerminalBtn = document.getElementById('add-terminal-btn');
        const launchBrowserBtn = document.getElementById('launch-browser-btn');
        const createSnapshotBtn = document.getElementById('create-snapshot-btn');
        const listSnapshotsBtn = document.getElementById('list-snapshots-btn');
        
        // 初始化工具執行按鈕
        document.querySelectorAll('.execute-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const tool = this.getAttribute('data-tool');
                const command = this.getAttribute('data-command');
                executeToolCommand(tool, command);
            });
        });
        
        // 處理發送消息
        function sendMessage() {
            const text = userInput.value;
            if (text.trim()) {
                // 添加用戶消息到界面
                appendMessage('user', text);
                // 發送到擴展
                vscode.postMessage({
                    command: 'sendMessage',
                    text: text
                });
                userInput.value = '';
            }
        }
        
        // 添加消息到界面
        function appendMessage(sender, text) {
            const messageDiv = document.createElement('div');
            messageDiv.className = \`message \${sender}\`;
            
            // 支援 Markdown 格式化
            if (sender === 'assistant') {
                // 簡單的 markdown 解析
                text = text
                    .replace(/\\*\\*(.*?)\\*\\*/g, '<strong>$1</strong>')
                    .replace(/\\*(.*?)\\*/g, '<em>$1</em>')
                    .replace(/\\\`(.*?)\\\`/g, '<code>$1</code>')
                    .replace(/\\n/g, '<br>');
            }
            
            messageDiv.innerHTML = text;
            messagesDiv.appendChild(messageDiv);
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
        }
        
        // 執行工具命令
        function executeToolCommand(tool, command) {
            vscode.postMessage({
                command: 'executeMCPCommand',
                tool: tool,
                command: command,
                parameters: {} // 這裡可以進一步改進以獲取參數
            });
        }
        
        // 添加工具
        addToolBtn.addEventListener('click', function() {
            vscode.postMessage({
                command: 'createMCPTool'
            });
        });
        
        // 啟動瀏覽器
        launchBrowserBtn.addEventListener('click', function() {
            const url = prompt('輸入要打開的 URL:');
            if (url) {
                vscode.postMessage({
                    command: 'launchBrowser',
                    url: url
                });
            }
        });
        
        // 執行終端命令
        addTerminalBtn.addEventListener('click', function() {
            const cmd = prompt('輸入要執行的命令:');
            if (cmd) {
                appendMessage('system', '執行命令: ' + cmd);
                vscode.postMessage({
                    command: 'executeTerminalCommand',
                    text: cmd
                });
            }
        });
        
        // 監聽來自擴展的消息
        window.addEventListener('message', event => {
            const message = event.data;
            if (message.type === 'response') {
                appendMessage('assistant', message.text);
            } else if (message.type === 'mcpResponse') {
                appendMessage('system', 
                    message.success 
                        ? \`命令執行成功: \${JSON.stringify(message.data)}\` 
                        : \`命令執行失敗: \${message.error}\`
                );
            } else if (message.type === 'browserAction') {
                appendMessage('system', \`瀏覽器操作 [\${message.action}]: \${message.result}\`);
            }
        });
        
        // 添加快照按鈕處理
        createSnapshotBtn.addEventListener('click', async () => {
            const description = prompt('請輸入快照描述:');
            if (description) {
                vscode.postMessage({
                    command: 'createSnapshot',
                    description: description
                });
            }
        });
        
        listSnapshotsBtn.addEventListener('click', () => {
            vscode.postMessage({
                command: 'listSnapshots'
            });
        });
        
        sendButton.addEventListener('click', sendMessage);
        userInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
    `;
    
    // 在 CSS 中添加快照樣式
    const snapshotCSS = `
        .snapshot-actions {
            display: flex;
            gap: 8px;
            margin-bottom: 12px;
        }
        
        .snapshot-actions button {
            padding: 6px 12px;
            background-color: #4CAF50;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
        }
    `;
    
    // 返回完整的 HTML 內容
    return `
        <!DOCTYPE html>
        <html>
            <head>
                <meta charset="UTF-8">
                <title>AI Assistant</title>
                <style>
                    .app-container {
                        display: flex;
                        height: 100vh;
                        overflow: hidden;
                    }
                    
                    .sidebar {
                        width: 300px;
                        padding: 16px;
                        background-color: #f5f5f5;
                        overflow-y: auto;
                        border-right: 1px solid #ddd;
                    }
                    
                    .chat-area {
                        flex: 1;
                        display: flex;
                        flex-direction: column;
                        padding: 16px;
                    }
                    
                    #messages {
                        flex: 1;
                        overflow-y: auto;
                        margin-bottom: 16px;
                    }
                    
                    #input-container {
                        display: flex;
                        gap: 10px;
                    }
                    
                    #user-input {
                        flex: 1;
                        min-height: 60px;
                        padding: 8px;
                        border: 1px solid #ccc;
                        border-radius: 4px;
                    }
                    
                    .message {
                        margin: 8px;
                        padding: 8px 12px;
                        border-radius: 8px;
                        max-width: 80%;
                    }
                    
                    .user {
                        background-color: #007acc;
                        color: white;
                        align-self: flex-end;
                    }
                    
                    .assistant {
                        background-color: #2d2d2d;
                        color: white;
                        align-self: flex-start;
                    }
                    
                    .system {
                        background-color: #f0f0f0;
                        color: #666;
                        border: 1px solid #ddd;
                        font-family: monospace;
                    }
                    
                    #send-button {
                        padding: 8px 16px;
                        background-color: #007acc;
                        color: white;
                        border: none;
                        border-radius: 4px;
                        cursor: pointer;
                    }
                    
                    #send-button:hover {
                        background-color: #005999;
                    }
                    
                    .config-section {
                        margin-bottom: 12px;
                    }
                    
                    .config-section label {
                        display: block;
                        margin-bottom: 4px;
                    }
                    
                    .config-section select {
                        width: 100%;
                        padding: 4px;
                    }
                    
                    .token-info {
                        margin: 16px 0;
                        padding: 8px;
                        background-color: #e0e0e0;
                        border-radius: 4px;
                    }
                    
                    .actions {
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        gap: 8px;
                    }
                    
                    .actions button {
                        padding: 8px;
                        background-color: #007acc;
                        color: white;
                        border: none;
                        border-radius: 4px;
                        cursor: pointer;
                    }
                    
                    .tool-item {
                        margin: 16px 0;
                        padding: 8px;
                        background-color: #e6e6e6;
                        border-radius: 4px;
                    }
                    
                    .tool-item h3 {
                        margin-top: 0;
                    }
                    
                    .version {
                        font-size: 0.8em;
                        color: #666;
                    }
                    
                    .commands {
                        margin-top: 8px;
                    }
                    
                    .execute-btn {
                        padding: 2px 6px;
                        background-color: #007acc;
                        color: white;
                        border: none;
                        border-radius: 2px;
                        cursor: pointer;
                        margin-left: 8px;
                        font-size: 0.8em;
                    }
                    ${snapshotCSS}
                </style>
            </head>
            <body>
                <div class="app-container">
                    ${sidebarHtml}
                    
                    <div class="chat-area">
                        <div id="messages"></div>
                        <div id="input-container">
                            <textarea id="user-input" placeholder="輸入訊息..."></textarea>
                            <button id="send-button">發送</button>
                        </div>
                    </div>
                </div>
                
                <script>
                    ${snapshotJavaScript}
                </script>
            </body>
        </html>
    `;
}

export function deactivate() {} 