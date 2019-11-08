'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { ArcGISTreeProvider } from './lib/ArcGISTreeProvider';
import copy from './lib/commands/copy';
import refresh from './lib/commands/refresh';
import open from './lib/commands/open';
import PortalConnection from './lib/PortalConnection';
import { MemFS } from './lib/fileSystemProvider';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
    
    const memFs = new MemFS();
    context.subscriptions.push(vscode.workspace.registerFileSystemProvider('memfs', memFs, { 
        isCaseSensitive: true 
    }));
    vscode.workspace.updateWorkspaceFolders(0, 0, { uri: vscode.Uri.parse('memfs:/'), name: "MemFS - ArcGIS" });
    
    const arcgisTreeProvider = new ArcGISTreeProvider(context, [], memFs);
    
    vscode.window.registerTreeDataProvider('arcgisAssistant', arcgisTreeProvider);
    vscode.commands.registerCommand('arcgisAssistant.refreshEntry', (item) => arcgisTreeProvider.refreshItem(item));
    vscode.commands.registerCommand('arcgisAssistant.copy', copy);
    vscode.commands.registerCommand('arcgisAssistant.open', open, {fs: memFs});

    vscode.commands.registerCommand('arcgisAssistant.removePortal',  (item) => arcgisTreeProvider.removePortal(item));
    vscode.commands.registerCommand('arcgisAssistant.addPortal', () => arcgisTreeProvider.addPortal());
}

// this method is called when your extension is deactivated
export function deactivate() {
}