'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { ArcGISTreeProvider } from './ArcGISTreeProvider';
import copy from './util/copy';
import refresh from './util/refresh';
import open from './util/open';
import { ArcGISDocumentProvider } from './ArcGISDocumentProvider';
import getWorkingDirectory from './util/getWorkingDirectory';
import save from './util/save';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
    
    const portals : any = context.workspaceState.get('portals') || 'maps.arcgis.com';

    const arcgisTreeProvider = new ArcGISTreeProvider(context, portals.split(','));
    const arcgisDocumentProvider = new ArcGISDocumentProvider();
    vscode.workspace.registerTextDocumentContentProvider(ArcGISDocumentProvider.scheme, arcgisDocumentProvider);
    
    vscode.window.registerTreeDataProvider('arcgisAssistant', arcgisTreeProvider);
    vscode.commands.registerCommand('arcgisAssistant.refreshEntry', refresh);
    vscode.commands.registerCommand('arcgisAssistant.copy', copy);
    vscode.commands.registerCommand('arcgisAssistant.open', open);

    vscode.commands.registerCommand('arcgisAssistant.removePortal', (item) => {
        arcgisTreeProvider.removePortal(item);
    });
    vscode.commands.registerCommand('arcgisAssistant.addPortal', async () => {
        const url : string = await vscode.window.showInputBox({
            placeHolder: 'organization.maps.arcgis.com | webadaptor.website.com/portal',
            prompt: 'URL To ArcGIS Online or Portal'
        }) || '';
        const username : string = await vscode.window.showInputBox({
            placeHolder: 'Username',
            prompt: 'Portal Username'
        }) || '';

        arcgisTreeProvider.addPortal(`${url}/${username}`);
        context.workspaceState.update('portals', arcgisTreeProvider.serialize());
    });

    let fileSystemWatcher = vscode.workspace.createFileSystemWatcher(`${getWorkingDirectory()}/**`, true, false, true);
	context.subscriptions.push(fileSystemWatcher.onDidChange((filePath) => {
        save(filePath.fsPath);
    }));


    
    // const fs = new ArcGISFS();
    // vscode.workspace.registerFileSystemProvider(ArcGISFS.scheme, fs, { isCaseSensitive: false });
    

    // vscode.commands.registerCommand('arcgisAssistant.openWorkspace', async function() {
    //     const url : string = await vscode.window.showInputBox({
    //         placeHolder: 'organization.maps.arcgis.com | webadaptor.website.com/portal',
    //         prompt: 'URL To ArcGIS Online or Portal'
    //     }) || '';
    //     const user : string = await vscode.window.showInputBox({
    //         placeHolder: 'username',
    //         prompt: 'Portal or ArcGIS Username'
    //     }) || '';

    //     if(url){
    //         fs.entries.push(url);
    //     }
        
    //     vscode.workspace.updateWorkspaceFolders(0, 0, { 
    //         uri: vscode.Uri.parse(`${ArcGISFS.scheme}:/${url}?username=${user}&token=${token}`), name: 'ArcGIS'
    //     });
    // });
}

// this method is called when your extension is deactivated
export function deactivate() {
}