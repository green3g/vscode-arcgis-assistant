import * as path from 'path';
import * as fs from 'fs';
import {ExtensionContext} from 'vscode';


export default async function save(context : ExtensionContext, filePath : string){
    const parts = filePath.split(path.sep);
    let id  = parts.pop() || '';
    id = id.split('.')[0];
    let data = fs.readFileSync(filePath, 'utf8');
    const json = JSON.parse(data);
    return json;
}