import {copy as c, paste as p} from 'copy-paste'

import {env} from 'vscode';

export function copy(data : string) : Thenable<void> {
    return env.clipboard.writeText(data);
}

export function paste() : Thenable<string> {
    return env.clipboard.readText();
}