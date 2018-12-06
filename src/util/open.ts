import {workspace, Uri, window, commands} from 'vscode';
import { ArcGISItem } from './types';

export default function(item :ArcGISItem){
    const portal = item.portal ? item.portal.uri : 'https://maps.arcgis.com/';
    const uri :Uri = Uri.parse(`arcgis:${portal}/sharing/rest/content/items/${item.id}.json`);
    return workspace.openTextDocument(uri).then(doc => {
        window.showTextDocument(doc);
        commands.executeCommand('editor.action.formatDocument');
    });
}