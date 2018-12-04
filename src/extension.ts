'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { ArcGISProvider } from './ArcGISProvider';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
    
    const arcgisProvider = new ArcGISProvider();
    vscode.window.registerTreeDataProvider('arcgisAssistant', arcgisProvider);
    vscode.commands.registerCommand('arcgisAssistant.refreshEntry', () => vscode.window.showInformationMessage('Refresh', 'Test'));
}

// this method is called when your extension is deactivated
export function deactivate() {
}