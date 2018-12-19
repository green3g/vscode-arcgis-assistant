import {Event, EventEmitter, TreeDataProvider, TreeItemCollapsibleState, TreeItem, ThemeIcon, ExtensionContext, FileSystemProvider} from 'vscode';
import * as path from 'path';
import PortalConnection from './PortalConnection';

const ICON_PATH = path.join('resources', 'icons');

export enum ArcGISType {Portal, Folder, Item}

export interface ArcGISItem {
    title: string;
    type: ArcGISType;
    connection: PortalConnection;
    id?: string;
    portal?: ArcGISItem;
    folder?: ArcGISItem;
}

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
    private context : ExtensionContext;
    private fs :FileSystemProvider;
    
    private portals : ArcGISItem[];
    constructor(context: ExtensionContext, portalConnections : PortalConnection[], fs : FileSystemProvider){
        this.context = context;
        this.fs = fs;
        this.portals = portalConnections.map(connection => ({
            title: connection.url,
            connection,
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

    public addPortal(connection : PortalConnection){
        this.portals.push({
            title: connection.url,
            connection,
            type: ArcGISType.Portal,
        });
		this._onDidChangeTreeData.fire();
    }

    public refreshItem(item :ArcGISItem){
        this._onDidChangeTreeData.fire();
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
            treeItem.command.arguments = [element, this];
        }
        return treeItem;
    }

    public async getChildren(element?: ArcGISItem): Promise<ArcGISItem[]> {
        if(!element){
            return Promise.resolve(this.portals);
        }
        if(element.type === ArcGISType.Portal){
            const folders = await element.connection.getFolders();
            const items = await element.connection.getItems();
            return this.mapFolders(folders, element)
                .concat(this.mapItems(items, element)); 
        }

        if(element.type === ArcGISType.Folder){
            const results = await element.connection.getItems(element.id);
            return this.mapItems(results, element);
        }

        return Promise.resolve([]);
    }

    private mapFolders(folders: any[], parent: ArcGISItem) : ArcGISItem[] {
        return folders.map((folder) => {
            return {
                id: folder.id,
                title: folder.title,
                type: ArcGISType.Folder,
                connection: parent.connection,
            };
        });
    }

    private mapItems(items : any, parent : ArcGISItem) : ArcGISItem[] {
        return items.map((item:any) => {
            return {
                folder: parent,
                id: item.id,
                title: `${item.title} (${item.type})`,
                type: ArcGISType.Item,
                connection: parent.connection,
            };
        });
    }
}