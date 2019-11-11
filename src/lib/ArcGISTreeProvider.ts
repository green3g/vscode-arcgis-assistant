import {
    Event, EventEmitter, TreeDataProvider, TreeItemCollapsibleState,
    TreeItem, ThemeIcon, ExtensionContext, FileSystemProvider,
    window, Uri, workspace,
} from 'vscode';
import * as path from 'path';
import { SearchQueryBuilder } from '@esri/arcgis-rest-portal';
import * as clipboardy from 'clipboardy';
import PortalConnection from './PortalConnection';
import showUserMessages, { LevelOptions } from './util/showUserMessages';
import * as beautify from 'json-stringify-pretty-compact';

const ICON_PATH = path.join('resources', 'icons');

export enum ArcGISType {Portal, Folder, Item}

const SEP = '/';

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
    public async copyItem(item : ArcGISItem){
        if(item.type === ArcGISType.Portal){
            window.showInformationMessage('Copying a portal is not yet supported');
            return;
        }
        if(item.type === ArcGISType.Folder){
            window.showInformationMessage('Copying a folder is not yet supported');
            return;
        }


        showUserMessages({
            pendingMessage: 'Fetching item, please wait...',
            callback: () => {
                return item.connection.getItem(item.id).then(result => {
                    return clipboardy.write(JSON.stringify({
                        item: result.item,
                        data: result.data,
                        type: item.type,
                    }));
                });
            },
            successMessage: 'Success! Item data was copied to the clipboard'
        });
    }

    public async pasteItem(treeItem : ArcGISItem){
        if(!treeItem){
            return;
        }

        if(!PASTE_TYPES.includes(treeItem.type)){
            window.showErrorMessage('You can only paste items in a Portal or Folder.');
            return;
        }

        const pasteData: string = await clipboardy.read();

        const folderId = treeItem.type === ArcGISType.Folder ? treeItem.id : undefined;
        const portal = treeItem.connection;
        let data:any, item:any, type:any;
        try {
            ({data, item, type} = JSON.parse(pasteData));
        } catch(e){
            window.showWarningMessage('An invalid item was pasted.')
            return
        }

        if(type !== ArcGISType.Item){
            window.showWarningMessage('This item cannot be pasted here.');
            console.warn('Invalid paste type: pasteData');
        }

        delete item.ownerFolder;
        delete item.owner;
        console.log(item, data);
        showUserMessages({
            callback: () => portal.createItem(item, data, folderId),
            pendingMessage: 'Creating item...please wait.',
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
        let {data} = await showUserMessages({
            callback: () => item.connection.getItem(item.id),
            pendingMessage: 'Fetching item...please wait.',
        });
        if(!data){
            window.showInformationMessage(`${item.title} does not have any data to edit.`);
            return;
        }
        const directory = ['memfs:', item.connection.portalName].join(SEP);
        const folder = item.folder && item.folder.type === ArcGISType.Folder ?
            item.folder.id : undefined;

        const filePath = folder ?
            [directory, folder, `${item.id}.json`].join(SEP) :
            [directory, `${item.id}.json`].join(SEP);

        this.checkDirectoryExists(filePath);

        const replacer : any = null;
        this.fs.writeFile(Uri.parse(filePath), Buffer.from(beautify(data, {maxLength: 100})), {
            create: true, overwrite: true
        });
        workspace.openTextDocument(Uri.parse(filePath)).then(doc => {
            window.showTextDocument(doc);
        }, (e: any) => console.warn(e));
    }

    public async saveItem (itemId: string, content: string, portal : PortalConnection) {
        try {
            JSON.parse(content);
        } catch(e){
            window.showWarningMessage('An error occured while parsing your file. Please fix any JSON syntax issues to save your item.')
            return;
        }

        // compare to existing data
        const {data, item} = await portal.getItem(itemId);
        const minSource = JSON.stringify(JSON.parse(content));
        const minUpdated = JSON.stringify(data);
        if(minSource === minUpdated){
            return;
        }


        return showUserMessages({
            promptMessage: `You've made some changes.
            Do you want to upload ${itemId} to your portal?`,
            pendingMessage: 'Saving item...please wait.',
            callback: () => {
                //validate json
                const text = JSON.stringify(JSON.parse(content));
                return portal.updateItem(item, text);
            },
            successMessage: 'Item saved successfully!',
            errorMessage: 'Error while saving. The item JSON syntax may not valid. Please fix your content first.',
        });
    }

    public async deleteItem(item : ArcGISItem){
        if(!item){
            return;
        }
        if(item.type === ArcGISType.Folder){
            window.showErrorMessage(`You cannot delete folders yet.`);
            return;
        }
        if(item.type === ArcGISType.Portal){
            const index = this.portals.indexOf(item);
            if(index > -1){
                this.portals.splice(index, 1);
            }
            this.refreshItem(item);
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

    private checkDirectoryExists(directory : string){
        const parts = directory.split(SEP);
        for(let i = 2; i < parts.length; i ++){
            const dir = parts.slice(0, i).join(SEP);
            const uri = Uri.parse(dir);
            try {
                this.fs.readDirectory(uri);
            } catch(e){
                this.fs.createDirectory(uri);
            }
        }
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