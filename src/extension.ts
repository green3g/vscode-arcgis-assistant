'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { ArcGISTreeProvider } from './ArcGISTreeProvider';
import copy from './util/copy';
import refresh from './util/refresh';
import open from './util/open';
import getWorkingDirectory from './util/getWorkingDirectory';
import save from './util/save';
import getAuthToken from './util/auth/oauth';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
    
    let portals : string[] = context.workspaceState.get('portals') || ['maps.arcgis.com'];
    if(!Array.isArray(portals)){
        portals = [];
    }

    const arcgisTreeProvider = new ArcGISTreeProvider(context, portals);
    
    vscode.window.registerTreeDataProvider('arcgisAssistant', arcgisTreeProvider);
    vscode.commands.registerCommand('arcgisAssistant.refreshEntry', refresh);
    vscode.commands.registerCommand('arcgisAssistant.copy', copy);
    vscode.commands.registerCommand('arcgisAssistant.open', open);

    vscode.commands.registerCommand('arcgisAssistant.removePortal', (item) => {
        arcgisTreeProvider.removePortal(item);
        context.workspaceState.update('portals', arcgisTreeProvider.serialize());
    });
    vscode.commands.registerCommand('arcgisAssistant.addPortal', async () => {

        // get url from user
        const url : string = await vscode.window.showInputBox({
            placeHolder: 'organization.maps.arcgis.com | webadaptor.website.com/portal',
            prompt: 'URL To ArcGIS Online or Portal'
        }) || '';

        // fetch token and profile details
        getAuthToken(context, url)
            .then(({token, profile}) => {

                // add portal
                arcgisTreeProvider.addPortal(`${url}/${profile.username}`);
                context.workspaceState.update('portals', arcgisTreeProvider.serialize());

            }).catch(e => {
                console.warn(e);
            });

    });

    let fileSystemWatcher = vscode.workspace.createFileSystemWatcher(`${getWorkingDirectory()}/**`, true, false, true);
	context.subscriptions.push(fileSystemWatcher.onDidChange((filePath) => {
        save(context, filePath.fsPath);
    }));
}

// this method is called when your extension is deactivated
export function deactivate() {
}