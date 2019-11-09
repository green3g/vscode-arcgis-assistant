import {
    Event, EventEmitter, TreeDataProvider, TreeItemCollapsibleState,
    TreeItem, ThemeIcon, ExtensionContext, FileSystemProvider,
    window, Uri, workspace,
} from 'vscode';
import * as path from 'path';
import { SearchQueryBuilder } from '@esri/arcgis-rest-portal';
import {copy, paste} from 'copy-paste';
import PortalConnection from './PortalConnection';
import showUserMessages, { LevelOptions } from './util/showUserMessages';

const ICON_PATH = path.join('resources', 'icons');

export enum ArcGISType {Portal, Folder, Item}

export interface ArcGISItem {
    title: string;
    type: ArcGISType;
    connection: PortalConnection;
    id: string;
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


const PASTE_TYPES = [
    ArcGISType.Portal,
    ArcGISType.Folder,
];

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
            title: connection.portal,
            connection,
            type: ArcGISType.Portal,
            id: connection.portal,
        }));

        // listen to file changes
        fs.onDidChangeFile((events) => {

            const fileChangeEvent = events.filter(e => e.uri.path.indexOf('json') > -1)[0];
            if(!fileChangeEvent){
                return;
            }

            const parts = fileChangeEvent.uri.path.split('/');
            const fileName = parts[parts.length - 1];
            const itemId = fileName.split('.')[0];
            const url = parts[1];
            let folder = parts[parts.length - 2];
            if(folder === url){
                folder = '';
            }

            const portal = this.portals.find(p => p.connection.portalName === url);
            if(!portal){
                return;
            }
            const content = fs.readFile(fileChangeEvent.uri).toString();
            this.saveItem(itemId, content, portal.connection);
        });
    }


    ///////////////////////////////////////////////////////////////////////////////////
    // Portal methods
    ///////////////////////////////////////////////////////////////////////////////////
    public async addPortal(){
        // get url from user
        let url : string = await window.showInputBox({
            placeHolder: 'organization.maps.arcgis.com | webadaptor.website.com/portal',
            prompt: 'URL To ArcGIS Online or Portal',
            value: 'https://maps.arcgis.com',
        }) || '';

        if(!url){
            return;
        }

        // standardize url
        url = url.replace(/(https?:\/\/|\/?rest\/sharing)/g, '');
        url = `https://${url}`;

        const connection = new PortalConnection({portal: url});

        this.portals.push({
            title: connection.portal,
            connection,
            type: ArcGISType.Portal,
            id: connection.portal,
        });
		this._onDidChangeTreeData.fire();
    }

    ///////////////////////////////////////////////////////////////////////////////////
    // Tree methods
    ///////////////////////////////////////////////////////////////////////////////////
    public refreshItem(item? :ArcGISItem){
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
            const q = new SearchQueryBuilder().match(element.id || '').in('ownerfolder');
            const results = await element.connection.getItems({q});
            return this.mapItems(results, element);
        }

        return Promise.resolve([]);
    }
    ///////////////////////////////////////////////////////////////////////////////////
    // Commands methods
    ///////////////////////////////////////////////////////////////////////////////////
    public copyItem(item : ArcGISItem){
        let prop  : string = '';
        if(item.type === ArcGISType.Item || item.type === ArcGISType.Folder){
            prop = item.id || '';
        } else if(item.type === ArcGISType.Portal){
            prop = item.connection.portal || '';
        }

        copy(prop, () => {
            window.showInformationMessage('Success! Item was copied to the clipboard');
        });
    }

    public async pasteItem(treeItem : ArcGISItem){
        if(!treeItem){
            return;
        }

        if(!PASTE_TYPES.includes(treeItem.type)){
            window.showErrorMessage('This type of folder is not supported for pasting.');
            return;
        }

        const pasteData: string = await new Promise(resolve => {
            paste((err, pasteData : string) => resolve(pasteData));
        });
        const folderId = treeItem.type === ArcGISType.Folder ? treeItem.id : undefined;
        const portal = treeItem.connection;
        const {data, item} = await portal.getItem(pasteData);

        showUserMessages({
            callback: () => portal.createItem(item, data, folderId),
            successMessage: 'Item was successfully copied',
            successCallback: () => this.refreshItem(treeItem),
            errorMessage: 'Item could not be created'
        });
    }



    ///////////////////////////////////////////////////////////////////////////////////
    // File System Operations
    ///////////////////////////////////////////////////////////////////////////////////
    public async openItem(item :ArcGISItem){
        if(!item.id){
            return;
        }
        let {data} = await item.connection.getItem(item.id);
        if(!data){
            window.showInformationMessage(`${item.title} does not have any data to edit.`);
            return;
        }
        const directory = `memfs:/${item.connection.portalName}`;
        const folder = item.folder && item.folder.type === ArcGISType.Folder ?
            item.folder.id : undefined;
        const path = folder ? `${directory}/${folder}/${item.id}.json`
            : `${directory}/${item.id}.json`;
        this.fs.createDirectory(Uri.parse(directory));
        if(folder){
            this.fs.createDirectory(Uri.parse(`${directory}/${folder}`));
        }
        this.fs.writeFile(Uri.parse(path), Buffer.from(data), {
            create: true, overwrite: true
        });
        workspace.openTextDocument(Uri.parse(path)).then(doc => {
            window.showTextDocument(doc);
        }, (e: any) => console.warn(e));
    }

    public async saveItem (itemId: string, content: string, portal : PortalConnection) {

        const {data, item} = await portal.getItem(itemId);
        if(data === content){
            return;
        }


        return showUserMessages({
            promptMessage: `You've made some changes.
            Do you want to upload ${itemId} to your portal?`,
            pendingMessage: 'Saving item...please wait.',
            callback: () => {
                //validate json
                JSON.parse(content);
                return portal.updateItem(item, content);
            },
            successMessage: 'Item saved successfully!',
            errorMessage: 'Error while saving. The item JSON syntax may not valid. Please fix your content first.',
        });
    }

    public async deleteItem(item : ArcGISItem){
        if(item.type === ArcGISType.Folder){
            window.showErrorMessage(`You cannot delete folders yet.`);
            return;
        }
        if(item.type === ArcGISType.Portal){
            const index = this.portals.indexOf(item);
            if(index > -1){
                this.portals.splice(index, 1);
            }
            return;
        }

        return showUserMessages({
            promptMessage:  `${item.title} will be permanantly deleted.
                        Are you sure you want to proceed?`,
            promptLevel: LevelOptions.warn,
            pendingMessage: 'Deleting item...please wait',
            callback: () => item.connection.deleteItem(item.id),
            successCallback: () => this.refreshItem(item.folder),
            successMessage: 'Item has been deleted',
            errorMessage: 'Item could not be deleted',
        });
    }

    ///////////////////////////////////////////////////////////////////////////////////
    // Private
    ///////////////////////////////////////////////////////////////////////////////////
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