import {window} from 'vscode';

function argsToString(args : any[]){
    return args.map(a => '' + a).join(', ');
}

export interface LogFunction {
    (...args : any[]): void;
}


export default function createLogger(name : string) : LogFunction {
    const channel = window.createOutputChannel(name);

    return (...args : any[]) => {
        channel.show();
        channel.appendLine(`${name}: ${argsToString(args)}`)
    }
}