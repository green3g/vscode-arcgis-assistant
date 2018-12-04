import * as vscode from 'vscode';

interface ArcGISItem {
    uri: String;
    type: String;
}

export class ArcGISProvider implements vscode.TreeDataProvider<ArcGISItem> {
    public getTreeItem(element: ArcGISItem): vscode.TreeItem{
        return new vscode.TreeItem('test');
    }

    public async getChildren(element?: ArcGISItem): Promise<ArcGISItem[]> {
        return Promise.resolve([{
            uri: 'test',
            type: 'portal item'
        }]);
    }
}