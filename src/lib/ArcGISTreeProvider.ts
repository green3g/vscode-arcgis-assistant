import {
    Event, EventEmitter, TreeDataProvider, TreeItemCollapsibleState,
    TreeItem, ExtensionContext, FileSystemProvider,
    window, Uri, workspace, TextDocument,
} from 'vscode';
import * as path from 'path';
import { SearchQueryBuilder, ICreateItemResponse } from '@esri/arcgis-rest-portal';
import PortalConnection from './PortalConnection';
import showUserMessages, { LevelOptions } from './util/showUserMessages';
import * as beautify from 'json-stringify-pretty-compact';
import { copy, paste } from './util/clipboard';
import getLogger, { LogFunction } from './util/logging';

const ICON_PATH = path.join('resources', 'icons');

export enum ArcGISType {
    Portal,
    Folder,
    Item,
    Group,

    // portal wrapper types
    ContentFolder,
    GroupFolder,
    UserFolder,
}

const SEP = '/';

export interface ArcGISItem {
    title: string;
    type: ArcGISType;
    connection: PortalConnection;
    id: string;
    folder?: ArcGISItem;
    owner?: ArcGISItem;
}

const TREE_ITEM_MIXINS :any = {
    [ArcGISType.Item]: {
        icon: 'file-alt-regular.svg',
        command: {
            command: 'arcgisAssistant.open',
            title: 'Open Item',
            tooltip: 'Opens this items json',
        }
    },
    [ArcGISType.Portal]: {
        collapsibleState: TreeItemCollapsibleState.Collapsed,
        icon: 'globe-americas-solid.svg'
    },
    [ArcGISType.Group]: {
        collapsibleState: TreeItemCollapsibleState.Collapsed,
        icon: 'folder-solid.svg',
    },
    [ArcGISType.Folder]: {
        collapsibleState: TreeItemCollapsibleState.Collapsed,
        icon: 'folder-solid.svg',
    },
    [ArcGISType.ContentFolder]: {
        icon: 'folder-solid.svg',
        collapsibleState: TreeItemCollapsibleState.Collapsed,
    },
    [ArcGISType.GroupFolder]: {
        icon: 'share-alt.svg',
        collapsibleState: TreeItemCollapsibleState.Collapsed,
    },
    [ArcGISType.UserFolder]: {
        icon: 'users-solid.svg',
        collapsibleState: TreeItemCollapsibleState.Collapsed,
    }
};


const PASTE_TYPES = [
    ArcGISType.Portal,
    ArcGISType.Folder,
];

const APP_TYPES = [
        'Web Mapping Application',
        'Workforce Project',
        'Dashboard',
]
const MAP_TYPES = [
    'Web Map',
    'Web Scene',
]

export class ArcGISTreeProvider implements TreeDataProvider<ArcGISItem> {
    private _onDidChangeTreeData: EventEmitter<ArcGISItem | undefined | null | void> = new EventEmitter<ArcGISItem | undefined | null | void>();
    readonly onDidChangeTreeData: Event<ArcGISItem | undefined | null | void> = this._onDidChangeTreeData.event;
    private context : ExtensionContext;
    private fs :FileSystemProvider;
    private logger : LogFunction;

    private portals : ArcGISItem[];
    constructor(context: ExtensionContext, portalConnections : PortalConnection[], fs : FileSystemProvider){
        this.context = context;
        this.fs = fs;
        this.portals = portalConnections.map(connection => ({
            title: connection.portalName,
            connection,
            type: ArcGISType.Portal,
            id: connection.portal,
        }));

        // logging
        this.logger = getLogger('Arcgis Assistant');

        // listen to file changes
        workspace.onDidSaveTextDocument((document: TextDocument) => {
            // only use memfs scheme
            if(document.uri.scheme !== 'memfs'){
                return;
            }

            // get the item id/folder etc
            const parts = document.uri.path.split('/');
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

            // read/save the content
            const content = fs.readFile(document.uri).toString();
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


        // standardize url
        url = url.replace(/(https?:\/\/|\/?rest\/sharing)/g, '');
        if(url.lastIndexOf('/') === url.length - 1){
            url = url.substring(0, url.length - 1);
        }

        if(!url){
            return;
        }

        url = `https://${url}`;


        // get appId from user
        const appId : string | undefined = await window.showInputBox({
            placeHolder: 'Enter appId - for Portal (optional)',
            prompt: 'abc123',
            value: '',
        });

        if(this.portals.find(p => p.id === url)){
            window.showInformationMessage('This portal is already in your list');
            return;
        }

        this.logger(`Creating new portal connection to url: ${url}, app: ${appId}`)
        const connection = new PortalConnection({portal: url, appId});
        await connection.authenticate();
        this.logger(`Authentication successful. Username: ${connection.authentication.username}`)

        this.portals.push({
            title: connection.portal,
            connection,
            type: ArcGISType.Portal,
            id: connection.portal,
        });

		this.refreshItem();
    }

    ///////////////////////////////////////////////////////////////////////////////////
    // Tree methods
    ///////////////////////////////////////////////////////////////////////////////////
    public refreshItem(item? :ArcGISItem){
        this._onDidChangeTreeData.fire(item);
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
        this.logger(`Fetching children for: ${element.type}: ${element.id}`);

        if(element.type === ArcGISType.Portal){
            return this.getPortalFolders(element);
        }

        if(element.type === ArcGISType.ContentFolder){
            const user = element.id === 'CONTENT' ? undefined : element.id;
            const folders = await element.connection.getFolders(user);
            const items = await element.connection.getItems({username: user});
            return this.mapFolders(folders, element)
                .concat(this.mapItems(items, element));
        }

        if(element.type === ArcGISType.GroupFolder) {
            return this.getGroups(element);
        }

        if(element.type === ArcGISType.Group){
            const query = new SearchQueryBuilder().match(element.id || '').in('group');
            return this.getItems(element, query);
        }

        if(element.type === ArcGISType.Folder){
            const q = new SearchQueryBuilder().match(element.id || '').in('ownerfolder');
            return this.getItems(element, q);
        }

        if(element.type === ArcGISType.UserFolder){
            return this.getUsers(element);
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
                    return copy(JSON.stringify({
                        item: result.item,
                        data: result.data,
                        type: item.type,
                    }));
                });
            },
            successMessage: 'Success! Item data was copied to the clipboard'
        }).catch(e => {
            this.logger(`Copy error: ${e}. You may be missing a dependency. See README for details.`);
            window.showErrorMessage('Item could not be copied. See error logs for details.');
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

        const pasteData: string = await paste();

        const userId = treeItem.owner?.id === 'CONTENT' ? 
            treeItem.connection.authentication.username : 
            treeItem.owner?.id;

        const folderId = treeItem.type === ArcGISType.Folder ? treeItem.id : undefined;
        const portal = treeItem.connection;
        let data:any, item:any, type:any;
        try {
            ({data, item, type} = JSON.parse(pasteData));
        } catch(e){
            this.logger(`Error while pasting: ${e.toString()}`);
            this.logger(`Paste Data: ${pasteData}`);
            window.showWarningMessage('An invalid item was pasted.');
            return;
        }

        if(type !== ArcGISType.Item){
            window.showWarningMessage('This item cannot be pasted here.');
        }

        delete item.ownerFolder;
        delete item.owner;
        showUserMessages({
            callback: () => portal.createItem(item, data, folderId, userId),
            pendingMessage: 'Creating item...please wait.',
            successMessage: 'Item was successfully copied',
            successCallback: () => this.refreshItem(treeItem),
            errorMessage: 'Item could not be created'
        }).catch(e => {
            this.logger(`Paste error: ${e} You may be missing a dependency. See README for details.`);
            window.showErrorMessage('Item could not be pasted. See error logs for details.');
        });

    }

    async createNewItem(treeItem : ArcGISItem) : Promise<ICreateItemResponse | void> {
        const ValidLocationTypes = [ArcGISType.ContentFolder, ArcGISType.Folder]
        if(!ValidLocationTypes.includes(treeItem.type)){
            window.showInformationMessage('You can only create new apps in your content folders');
            return;
        }

        const itemName = await window.showInputBox({
            placeHolder: 'My sweet app',
            prompt: 'Application Name',
            value: '',
        })
        const descripton = await window.showInputBox({
            placeHolder: 'My sweet app',
            prompt: 'Description',
            value: '',
        }) 
        const type = await window.showQuickPick([
            ...APP_TYPES,
            ...MAP_TYPES,
        ], {})
        const tags = await window.showInputBox({
            placeHolder: 'app',
            prompt: 'Application Tags',
            value: 'app',
        })

        const url = APP_TYPES.includes(type || '') ? await window.showInputBox({
            placeHolder: 'https://my.app.com/?id={}',
            prompt: 'Enter URL. Use {} to substitute item ID after it is created',
            value: '',
        }) : undefined;

        const item : any = {
            title: itemName || '(None)',
            owner: treeItem.connection.authentication.username,
            folder: treeItem.folder?.id,
            tags: tags?.replace(/ +/g, '').split(',') || [],
            description: descripton,
            url,
            type,
        };
        const content = '{}'
        this.logger(`Creating new item ${itemName}`)
        window.showInformationMessage('Creating item, please wait...')
        return treeItem.connection.createItem(item, content, treeItem.id !== 'CONTENT' ? treeItem.id : undefined)
        .then((result) => {
            this.logger(`Item created: ${result.id}`)
            const replaceId = /\{\}/;
            if(url?.match(replaceId)){
                const replacement = item.url.replace(replaceId, result.id)
                const updates : any = {
                    id: result.id,
                    folder: result.folder,
                    ...item,
                    url : replacement,
                }
                this.logger(`Updating item with new URL: ${replacement}`)
                return treeItem.connection.updateItem(updates, content).then(() => result);
            }
            return result;
        })
        .then((newItem : ICreateItemResponse) => {
            window.showInformationMessage(`Item was successfully created: ${treeItem.connection.portal}/home/item.html?id=${newItem.id}`)
            this.refreshItem(treeItem);
            return newItem;
        }).catch(e => this.logger(e))
        
    }



    ///////////////////////////////////////////////////////////////////////////////////
    // File System Operations
    ///////////////////////////////////////////////////////////////////////////////////
    public async openItem(item :ArcGISItem){
        if(!item.id){
            return;
        }
        this.logger(`Fetching item data for: ${item.id}`);
        let {data} = await showUserMessages({
            callback: () => item.connection.getItem(item.id)
                .catch(e => this.logger(e)),
            pendingMessage: 'Fetching item...please wait.',
        });
        const directory = ['memfs:', item.connection.portalName].join(SEP);
        const folder = item.folder && item.folder.type === ArcGISType.Folder ?
            item.folder.id : undefined;

        const filePath = folder ?
            [directory, folder, `${item.id}.json`].join(SEP) :
            [directory, `${item.id}.json`].join(SEP);

        this.checkDirectoryExists(filePath);

        if(!data){
            this.logger(`${item.title} does not have any data yet.`);
        }

        let content;
        if(typeof data === 'string'){
            try {
                data = JSON.parse(data);
            } catch(e){
                this.logger(`Parse error: ${e}`);
            }
        }

        content = typeof data === 'string' ? data : beautify(data, {maxLength: 100});

        this.fs.writeFile(Uri.parse(filePath), Buffer.from(content), {
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
            window.showWarningMessage(`An error occured while parsing your file.  
            Please fix any JSON syntax issues to save your item: ${itemId}`);
            return;
        }

        this.logger(`Attempting save: ${itemId}`);

        // compare to existing data
        const {data, item} = await portal.getItem(itemId);
        const minSource = JSON.stringify(JSON.parse(content));
        const minUpdated = JSON.stringify(data);
        if(minSource === minUpdated){
            this.logger(`Content has not been modified: ${itemId}`);
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
        }).catch(e => {
            this.logger(`Save Error: ${e}`)
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
        this.logger(`Removing item: ${item.id}`);
        if(item.type === ArcGISType.Portal){
            const index = this.portals.indexOf(item);
            if(index > -1){
                this.portals.splice(index, 1);
            }
            this.refreshItem();
            return;
        }

        const userId = item.owner?.id === 'CONTENT' ? 
            item.connection.authentication.username : 
            item.owner?.id;

        return showUserMessages({
            promptMessage:  `${item.title} will be permanantly deleted.
                        Are you sure you want to proceed?`,
            promptLevel: LevelOptions.warn,
            pendingMessage: 'Deleting item...please wait',
            callback: () => item.connection.deleteItem(item.id, userId),
            successCallback: () => this.refreshItem(item.folder),
            successMessage: 'Item has been deleted',
            errorMessage: 'Item could not be deleted',
        }).catch(e => {
            this.logger(`Delete error: ${e}`)
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
                this.logger(`Creating directory: ${uri}`);
            } catch(e){
                this.fs.createDirectory(uri);
            }
        }
    }

    private getPortalFolders(portal: ArcGISItem) : ArcGISItem[] {
        return [
            {
                id: 'CONTENT',
                title: 'Content',
                type: ArcGISType.ContentFolder,
                connection: portal.connection,
            },
            {
                id: 'GROUPS',
                title: 'Groups',
                type: ArcGISType.GroupFolder,
                connection: portal.connection,
            },
            {
                id: 'USERS',
                title: 'Users',
                type: ArcGISType.UserFolder,
                connection: portal.connection,
            },
        ];
    }

    private async getGroups(element: ArcGISItem): Promise<ArcGISItem[]> {
        return element.connection.getGroups()
            .then((groups) => this.mapGroups(groups, element));
    }

    private async getUsers(element: ArcGISItem): Promise<ArcGISItem[]> {
        return element.connection.getUsers()
            .then((users) => this.mapUsers(users, element));
    }

    private async getItems(element: ArcGISItem, q : SearchQueryBuilder) : Promise<ArcGISItem[]> {
        const results = await element.connection.getItems({q});
        return this.mapItems(results, element);
    }

    private mapUsers(users: any[], parent: ArcGISItem) : ArcGISItem[] {
        return users.map((user) => {
            return {
                id: user.username,
                title: user.username, 
                type: ArcGISType.ContentFolder,
                connection: parent.connection,
            };
        });
    }
    
    private mapGroups(groups: any[], parent: ArcGISItem) : ArcGISItem[] {
        return groups.map((group) => {
            return {
                id: group.id,
                title: group.title, 
                type: ArcGISType.Group,
                connection: parent.connection,
            };
        });
    }

    private mapFolders(folders: any[], parent: ArcGISItem) : ArcGISItem[] {
        return folders.map((folder) => {
            return {
                id: folder.id,
                title: folder.title,
                type: ArcGISType.Folder,
                connection: parent.connection,
                owner: parent,
            };
        });
    }

    private mapItems(items : any, parent : ArcGISItem) : ArcGISItem[] {
        return items.map((item:any) => {
            return {
                owner: parent.owner,
                folder: parent,
                id: item.id,
                title: `${item.title} (${item.type})`,
                type: ArcGISType.Item,
                connection: parent.connection,
            };
        });
    }
}