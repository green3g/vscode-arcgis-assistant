import {workspace, window, commands, ExtensionContext} from 'vscode';
import { ArcGISItem } from './types';
import * as fs from 'fs';
import axios from 'axios';
import getWorkingDirectory from './getWorkingDirectory';
import mkdirp = require('mkdirp');
import * as path from 'path';
import getAuthToken from './auth/oauth';

function getArcGISItem(context : ExtensionContext, baseUrl : string, item : ArcGISItem): Promise<string> {
    let url = `https://${baseUrl}/sharing/rest/content/items/${item.id}`;
    url = url.replace('.json', '');
    return getAuthToken(context, baseUrl).then(({token}) => {
        return axios.get(`${url}/data?f=json&token=${token}`).then(result => {
            return JSON.stringify(result.data);
        }).catch(e => {
            throw e;
        });
    });
}

export default function(context: ExtensionContext, item :ArcGISItem){
    const portal = item.portal ? item.portal : item;
    const folder = item.folder ? path.join(portal.uri, item.folder.id || '') : portal.uri;
    const output = path.join(getWorkingDirectory(), folder);
    const [baseUrl] = portal.uri.split('/');
    mkdirp.sync(output);
    const localPath = `${output}/${item.id}.json`;

    getArcGISItem(context, baseUrl, item).then(data => {
        data = data.replace(/[\n\t]/, '');
        try {
            fs.writeFileSync(localPath, data,);
        } catch(e){
            console.warn(e);
        }
        return workspace.openTextDocument(localPath).then(doc => {
            window.showTextDocument(doc);
            commands.executeCommand('editor.action.format');
        });
    }).catch(e => {
        console.warn(e);
    });
}