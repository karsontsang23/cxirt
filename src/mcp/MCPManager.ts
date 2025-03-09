import * as vscode from 'vscode';
import axios from 'axios';
import { MCPTool, MCPResponse } from '../types/mcp';

export class MCPManager {
    private tools: Map<string, MCPTool> = new Map();
    private serverUrl: string = '';

    constructor() {
        this.loadTools();
    }

    private async loadTools() {
        // 從配置中加載已安裝的工具
        const config = vscode.workspace.getConfiguration('aiAssistant');
        const savedTools = config.get<MCPTool[]>('mcpTools') || [];
        savedTools.forEach(tool => {
            this.tools.set(tool.name, tool);
        });
    }

    public async installTool(toolDefinition: string): Promise<MCPResponse> {
        try {
            // 解析工具定義
            const tool: MCPTool = JSON.parse(toolDefinition);
            
            // 驗證工具定義
            if (!this.validateTool(tool)) {
                return {
                    success: false,
                    error: '無效的工具定義'
                };
            }

            // 保存工具
            this.tools.set(tool.name, tool);
            await this.saveTool(tool);

            return {
                success: true,
                data: tool
            };
        } catch (error) {
            return {
                success: false,
                error: `安裝工具失敗: ${error.message}`
            };
        }
    }

    public async executeCommand(toolName: string, commandName: string, parameters: any): Promise<MCPResponse> {
        const tool = this.tools.get(toolName);
        if (!tool) {
            return {
                success: false,
                error: `找不到工具: ${toolName}`
            };
        }

        const command = tool.commands.find(cmd => cmd.name === commandName);
        if (!command) {
            return {
                success: false,
                error: `找不到命令: ${commandName}`
            };
        }

        try {
            const response = await axios.post(`${this.serverUrl}/execute`, {
                tool: toolName,
                command: commandName,
                parameters
            });

            return {
                success: true,
                data: response.data
            };
        } catch (error) {
            return {
                success: false,
                error: `執行命令失敗: ${error.message}`
            };
        }
    }

    private validateTool(tool: MCPTool): boolean {
        return !!(
            tool.name &&
            tool.description &&
            tool.version &&
            Array.isArray(tool.commands) &&
            tool.commands.every(cmd => 
                cmd.name && 
                cmd.description && 
                Array.isArray(cmd.parameters)
            )
        );
    }

    private async saveTool(tool: MCPTool) {
        const config = vscode.workspace.getConfiguration('aiAssistant');
        const currentTools = config.get<MCPTool[]>('mcpTools') || [];
        const updatedTools = [...currentTools.filter(t => t.name !== tool.name), tool];
        await config.update('mcpTools', updatedTools, vscode.ConfigurationTarget.Global);
    }

    public getTools(): MCPTool[] {
        return Array.from(this.tools.values());
    }
}