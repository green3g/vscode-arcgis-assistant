'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { ArcGISTreeProvider, ArcGISType } from './lib/ArcGISTreeProvider';
import { MemFS } from './lib/fileSystemProvider';
import PortalConnection from './lib/PortalConnection';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

    const memFs = new MemFS();
    context.subscriptions.push(vscode.workspace.registerFileSystemProvider('memfs', memFs, {
        isCaseSensitive: true
    }));
    vscode.workspace.updateWorkspaceFolders(0, 0, { uri: vscode.Uri.parse('memfs:/'), name: "MemFS - ArcGIS" });

    // initialize tree
    const portalsConfig : string = context.globalState.get('portals') || '';
    const portals = portalsConfig.split(',').map(p => new PortalConnection({portal: p}));
    const arcgisTreeProvider = new ArcGISTreeProvider(context, portals, memFs);

    vscode.window.registerTreeDataProvider('arcgisAssistant', arcgisTreeProvider);
    vscode.commands.registerCommand('arcgisAssistant.refreshEntry', (item) => arcgisTreeProvider.refreshItem(item));
    vscode.commands.registerCommand('arcgisAssistant.copy', (item) => arcgisTreeProvider.copyItem(item));
    vscode.commands.registerCommand('arcgisAssistant.open', (item) => arcgisTreeProvider.openItem(item));
    vscode.commands.registerCommand('arcgisAssistant.paste', (item) => arcgisTreeProvider.pasteItem(item));
    vscode.commands.registerCommand('arcgisAssistant.delete', (item) => arcgisTreeProvider.deleteItem(item));
    vscode.commands.registerCommand('arcgisAssistant.addPortal', () => arcgisTreeProvider.addPortal());

    arcgisTreeProvider.onDidChangeTreeData(() => {
        arcgisTreeProvider.getChildren().then(portals => {
            const items = portals.filter(p => p.type === ArcGISType.Portal).map(p => p.id);
            context.globalState.update('portals',items.join(','));
        });
    });
}

// this method is called when your extension is deactivated
export function deactivate() {
}