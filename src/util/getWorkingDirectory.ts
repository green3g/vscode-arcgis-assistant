import * as vscode from 'vscode';
import * as path from 'path';
import * as mkdirp from 'mkdirp';

const TEMP = '.arcgis';

export default function getWorkingDirectory(){
    

    let folder : string = path.join(
        vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders[0].uri.fsPath : '',
        TEMP
    );

    mkdirp.sync(folder);
    

    return folder;    
}