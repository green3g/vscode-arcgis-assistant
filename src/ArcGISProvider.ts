import * as vscode from 'vscode';
import axios from 'axios';

enum ArcGISType {Portal, Folder, Item}

const token = 'kzF_xj58rjYjRz3tGZQp8yhP5vm_kBcBnlztikoL78CLDFvlfskUX1xg1jD2kmNxVsBkUZA9VDEFCum96gQht9mwKiixosG3Aoaxv9QS8KQAne4DgsslS8lfmllS61XidlzV7nES2IbfhVrHXZZfkbDlt452T-NhP8mD0cEk3DjGuMzo4j7hzBWlpPrEVufbrz3i6IIuNcKB577Se6npiEPfmzFEGcs7t9IBqf-fh44.';

interface ArcGISItem {
    title: string;
    type: ArcGISType;
    uri?: string;
    id?: string;
}

export class ArcGISProvider implements vscode.TreeDataProvider<ArcGISItem> {
    public getTreeItem(element: ArcGISItem): vscode.TreeItem{
        const state = element.type === ArcGISType.Item ? 
            vscode.TreeItemCollapsibleState.None
            : vscode.TreeItemCollapsibleState.Collapsed;
        return new vscode.TreeItem(element.title, state);
    }

    public async getChildren(element?: ArcGISItem): Promise<ArcGISItem[]> {
        if(!element){
            return Promise.resolve([{
                title: 'ArcGIS Online',
                uri: 'https://wsbeng.maps.arcgis.com',
                type: ArcGISType.Portal
            }]);
        }
        if(element.type === ArcGISType.Portal){
            return axios(`${element.uri}/sharing/rest/content/users/GRoemhildt_wsbeng?f=json&token=${token}`).then(response => {
                return response.data.folders.map((folder : any) => {
                    return {
                        id: folder.id,
                        title: folder.title,
                        type: ArcGISType.Folder,
                        uri: element.uri,
                    };
                });
            });
        }

        if(element.type === ArcGISType.Folder){
            const query = `ownerfolder:${element.id}`;
            return axios(`${element.uri}/sharing/rest/search?f=json&num=50&token=${token}&q=${query}`).then(response => {
                return response.data.results.map((result:any) => {
                    return {
                        uri: element.uri,
                        id: result.id,
                        title: result.title,
                        type: ArcGISType.Item
                    };
                });
            });
        }
        return Promise.resolve([]);
    }
}