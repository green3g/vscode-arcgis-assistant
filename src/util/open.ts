import {workspace, window, commands} from 'vscode';
import { ArcGISItem } from './types';
import * as fs from 'fs';
import axios from 'axios';
import { token } from './token';
import getWorkingDirectory from './getWorkingDirectory';
import mkdirp = require('mkdirp');
import * as path from 'path';

function getArcGISItem(itemUrl: string): Thenable<string> {
    itemUrl = itemUrl.replace('.json', '');
    return axios.get(`${itemUrl}/data?f=json&token=${token}`).then(result => {
        return JSON.stringify(result.data);
    }).catch(e => {
        throw e;
    });
}

export default function(item :ArcGISItem){
    const portal = item.portal ? item.portal : item;
    const folder = item.folder ? path.join(portal.uri, item.folder.id || '') : portal.uri;
    const output = path.join(getWorkingDirectory(), folder);
    const [baseUrl] = portal.uri.split('/');
    mkdirp.sync(output);
    const url = `https://${baseUrl}/sharing/rest/content/items/${item.id}`;
    const localPath = `${output}/${item.id}.json`;

    getArcGISItem(url).then(data => {
        data = data.replace(/[\n\t]/, '');
        try {
            fs.writeFileSync(localPath, data,);
        } catch(e){
            console.warn(e);
        }
        return workspace.openTextDocument(localPath).then(doc => {
            window.showTextDocument(doc);
            commands.executeCommand('editor.action.formatDocument', [doc]);
        });
    });
}