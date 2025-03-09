import * as vscode from 'vscode';
import { MCPTool, MCPCommand, MCPParameter } from '../types/mcp';

export class MCPToolCreator {
    /**
     * 創建一個新的 MCP 工具
     */
    public static async createTool(): Promise<MCPTool | undefined> {
        // 獲取工具基本信息
        const toolName = await vscode.window.showInputBox({
            prompt: '輸入工具名稱',
            placeHolder: '例如: FileManager, DatabaseTool'
        });
        
        if (!toolName) return undefined;
        
        const toolDescription = await vscode.window.showInputBox({
            prompt: '輸入工具描述',
            placeHolder: '例如: 管理文件操作的工具'
        });
        
        if (!toolDescription) return undefined;
        
        const toolVersion = await vscode.window.showInputBox({
            prompt: '輸入工具版本',
            placeHolder: '例如: 1.0.0',
            value: '1.0.0'
        });
        
        if (!toolVersion) return undefined;
        
        // 創建命令
        const commands: MCPCommand[] = [];
        let addingCommands = true;
        
        while (addingCommands) {
            const command = await this.createCommand();
            if (command) {
                commands.push(command);
                
                const addMore = await vscode.window.showQuickPick(['是', '否'], {
                    placeHolder: '添加更多命令?'
                });
                
                if (addMore !== '是') {
                    addingCommands = false;
                }
            } else {
                addingCommands = false;
            }
        }
        
        if (commands.length === 0) {
            vscode.window.showWarningMessage('工具必須至少有一個命令');
            return undefined;
        }
        
        // 返回完整工具定義
        return {
            name: toolName,
            description: toolDescription,
            version: toolVersion,
            commands: commands
        };
    }
    
    /**
     * 創建一個 MCP 命令
     */
    private static async createCommand(): Promise<MCPCommand | undefined> {
        const commandName = await vscode.window.showInputBox({
            prompt: '輸入命令名稱',
            placeHolder: '例如: readFile, executeQuery'
        });
        
        if (!commandName) return undefined;
        
        const commandDescription = await vscode.window.showInputBox({
            prompt: '輸入命令描述',
            placeHolder: '例如: 讀取文件內容'
        });
        
        if (!commandDescription) return undefined;
        
        // 創建參數
        const parameters: MCPParameter[] = [];
        let addingParameters = true;
        
        while (addingParameters) {
            const parameter = await this.createParameter();
            if (parameter) {
                parameters.push(parameter);
                
                const addMore = await vscode.window.showQuickPick(['是', '否'], {
                    placeHolder: '添加更多參數?'
                });
                
                if (addMore !== '是') {
                    addingParameters = false;
                }
            } else {
                addingParameters = false;
            }
        }
        
        return {
            name: commandName,
            description: commandDescription,
            parameters: parameters
        };
    }
    
    /**
     * 創建一個 MCP 參數
     */
    private static async createParameter(): Promise<MCPParameter | undefined> {
        const paramName = await vscode.window.showInputBox({
            prompt: '輸入參數名稱',
            placeHolder: '例如: filePath, query'
        });
        
        if (!paramName) return undefined;
        
        const paramDescription = await vscode.window.showInputBox({
            prompt: '輸入參數描述',
            placeHolder: '例如: 文件的路徑'
        });
        
        if (!paramDescription) return undefined;
        
        const paramType = await vscode.window.showQuickPick(
            ['string', 'number', 'boolean', 'object', 'array'],
            {
                placeHolder: '選擇參數類型'
            }
        );
        
        if (!paramType) return undefined;
        
        const isRequired = await vscode.window.showQuickPick(
            ['是', '否'],
            {
                placeHolder: '此參數是否必須?'
            }
        );
        
        if (!isRequired) return undefined;
        
        return {
            name: paramName,
            description: paramDescription,
            type: paramType,
            required: isRequired === '是'
        };
    }
    
    /**
     * 將工具定義轉換為 JSON 字符串
     */
    public static toolToJson(tool: MCPTool): string {
        return JSON.stringify(tool, null, 2);
    }
} 