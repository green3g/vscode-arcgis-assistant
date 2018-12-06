import {TreeDataProvider, TreeItemCollapsibleState, TreeItem, ThemeIcon, ExtensionContext} from 'vscode';
import axios from 'axios';
import { ArcGISType, ArcGISItem } from './util/types';
import { token } from './util/token';
import * as path from 'path';

const ICON_PATH = path.join('resources', 'icons');

const TREE_ITEM_MIXINS :any = {
    [ArcGISType.Item]: {
        iconPath: ThemeIcon.File,
        command: {
            command: 'arcgisAssistant.open',
            title: 'Open Item', 
            tooltip: 'Opens this items json',
        }
    },
    [ArcGISType.Folder]: {
        iconPath: ThemeIcon.Folder,
        collapsibleState: TreeItemCollapsibleState.Collapsed,
    },
    [ArcGISType.Portal]: {
        collapsibleState: TreeItemCollapsibleState.Collapsed,
        icon: 'file_type_map.svg'
    }
};



export class ArcGISTreeProvider implements TreeDataProvider<ArcGISItem> {

    context : ExtensionContext;
    constructor(context : ExtensionContext){
        this.context = context;
    }

    public getTreeItem(element: ArcGISItem): TreeItem{
        const mixin = TREE_ITEM_MIXINS[element.type];
        const treeItem = new TreeItem(element.title);
        if(mixin){
            if(mixin.icon){
                mixin.iconPath = this.context.asAbsolutePath(path.join(ICON_PATH, mixin.icon));
                delete mixin.icon;
            }
            Object.assign(treeItem, mixin);
        }
        return treeItem;
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
                        portal: element,
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
                        type: ArcGISType.Item,
                        portal: element.portal,
                    };
                });
            });
        }
        return Promise.resolve([]);
    }
}