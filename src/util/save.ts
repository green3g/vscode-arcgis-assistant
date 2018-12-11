import * as path from 'path';
import * as fs from 'fs';
import axios from 'axios';
import * as qs from 'query-string';
import * as FormData from 'form-data';

import {token} from './token';

function serialize(obj, prefix) {
    let str = [];
    for (let p in obj) {
        if (obj.hasOwnProperty(p)) {
            let k = prefix ? prefix + "[" + p + "]" : p;
            let v = obj[p];
            str.push(typeof v === "object" ?
                serialize(v, k) :
                encodeURIComponent(k) + "=" + encodeURIComponent(v));
        }
    }
    return str.join("&");
}


export default function save(filePath : string){
    const parts = filePath.split(path.sep);
    let id  = parts.pop() || '';
    id = id.split('.')[0];
    let data = fs.readFileSync(filePath, 'utf8');
    const json = JSON.parse(data);

    const folder = parts.pop();
    const username = parts.pop();
    const portal = parts.pop();
    const url = `https://${portal}/sharing/rest/content/users/${username}/${folder}/items/${id}/update`;

    const payload = {
        text: JSON.stringify(json),
        f: 'json',
        token,
    };
    axios.post(url, serialize(payload), {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    }).catch(e => {
        console.warn(e);
    }).then(result => {
        console.log(result);
    });
    
}