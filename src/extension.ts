'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { ArcGISTreeProvider } from './ArcGISTreeProvider';
import copy from './util/copy';
import refresh from './util/refresh';
import open from './util/open';
import { ArcGISDocumentProvider } from './ArcGISDocumentProvider';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
    
    const arcgisTreeProvider = new ArcGISTreeProvider(context);
    const arcgisDocumentProvider = new ArcGISDocumentProvider();
    vscode.workspace.registerTextDocumentContentProvider(ArcGISDocumentProvider.scheme, arcgisDocumentProvider);
    
    vscode.window.registerTreeDataProvider('arcgisAssistant', arcgisTreeProvider);
    vscode.commands.registerCommand('arcgisAssistant.refreshEntry', refresh);
    vscode.commands.registerCommand('arcgisAssistant.copy', copy);
    vscode.commands.registerCommand('arcgisAssistant.open', open);
}

// this method is called when your extension is deactivated
export function deactivate() {
}