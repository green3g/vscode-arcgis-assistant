import {paste} from 'copy-paste';
import { ArcGISItem, ArcGISType } from '../ArcGISTreeProvider';
import {window} from 'vscode';

const PASTE_TYPES = [
    ArcGISType.Portal,
    ArcGISType.Folder,
];


export default async function pasteItem(treeItem : ArcGISItem){
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
    portal.createItem(item, data, folderId).then(() => {
        window.showInformationMessage('Item was successfully copied');
    }).catch(e => {
        window.showErrorMessage('Item could not be created');
    });
}