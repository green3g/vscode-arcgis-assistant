import { window, ProgressLocation } from "vscode";

export interface PromiseFunc {
    (args : any) : Promise<any>;
}

export interface PromiseItem {
    execute: PromiseFunc;
    increment?: number;
    args?: any;
    message?: string;
}

export interface ProgressOptions {
    location?: ProgressLocation;
    title?: string;

    tasks: PromiseItem[];
    sync?: Boolean;
    cancelCallback?: Function;
}

export async function showProgress(options : ProgressOptions) : Promise<any> {
    return window.withProgress({
        location: options.location || ProgressLocation.Notification,
        title: options.title || 'Please wait...',
        cancellable: !!options.cancelCallback,
    }, async (progress, token) => {

        const promises = [];
        for(let i = 0; i < options.tasks.length; i ++){
            const task = options.tasks[i]
            const promise = task.execute(task.args);
            const increment = task.increment ? task.increment : Math.round(100 /options.tasks.length);
            promise.then(() => progress.report({message: task.message, increment}));
            promises.push(promise);
            if(options.sync){
                await promise;
            } 
        }

        return Promise.all(promises);
    });
}