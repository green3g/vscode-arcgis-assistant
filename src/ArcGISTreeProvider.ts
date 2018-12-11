import {Event, EventEmitter, TreeDataProvider, TreeItemCollapsibleState, TreeItem, ThemeIcon, ExtensionContext} from 'vscode';
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
	private _onDidChangeTreeData: EventEmitter<any> = new EventEmitter<any>();
    readonly onDidChangeTreeData: Event<any> = this._onDidChangeTreeData.event;
    
    private portals : ArcGISItem[];
    context : ExtensionContext;
    constructor(context : ExtensionContext, portals : string[]){
        this.context = context;
        this.portals = portals.map(str => ({
            title: str,
            uri: str,
            type: ArcGISType.Portal,
        }));
    }

    public removePortal(element : ArcGISItem){
        const index = this.portals.indexOf(element);
        if(index > -1){
            this.portals.splice(index, 1);
        }

        this._onDidChangeTreeData.fire();
    }

    public addPortal(portal : string){
        this.portals.push({
            title: portal,
            uri: portal,
            type: ArcGISType.Portal,
        });
		this._onDidChangeTreeData.fire();
    }

    public serialize() : string {
        return this.portals.map(portal => portal.title).join(',');
    }

    public getTreeItem(element: ArcGISItem): TreeItem{
        const mixin = TREE_ITEM_MIXINS[element.type];
        const treeItem = new TreeItem(element.title);
        if(mixin){
            if(mixin.icon){
                mixin.iconPath = this.context.asAbsolutePath(path.join(ICON_PATH, mixin.icon));
                delete mixin.icon;
            }
            Object.assign(treeItem, mixin, {
                command: mixin.command ? Object.assign({}, mixin.command) : undefined
            });
        }

        if(treeItem.command){
            treeItem.command.arguments = [element];
        }
        return treeItem;
    }

    public async getChildren(element?: ArcGISItem): Promise<ArcGISItem[]> {
        if(!element){
            return Promise.resolve(this.portals);
        }
        if(element.type === ArcGISType.Portal){
            const [portal, username] = element.uri.split('/');
            return axios(`https://${portal}/sharing/rest/content/users/${username}?f=json&token=${token}`).then(response => {
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
            const portal = element.uri.split('/')[0];
            return axios(`https://${portal}/sharing/rest/search?f=json&num=50&token=${token}&q=${query}`).then(response => {
                return response.data.results.map((result:any) => {
                    return {
                        folder: element,
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