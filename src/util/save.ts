import * as path from 'path';
import * as fs from 'fs';
import axios from 'axios';
import * as qs from 'query-string';
import {token} from './token';
export default function save(filePath : string){
    const parts = filePath.split(path.sep);
    let id  = parts.pop() || '';
    id = id.split('.')[0];
    let data = fs.readFileSync(filePath, 'utf8');
    const json = JSON.parse(data);

    const folder = parts.pop();
    const username = parts.pop();
    const portal = parts.pop();

    axios.post(`https://${portal}/sharing/rest/content/users/${username}/${folder}/items/${id}/update`, {
        text: encodeURIComponent(json),
        f: 'json',
        token,
    }, {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    }).catch(e => {
        console.warn(e);
    }).then(result => {
    });
    
}