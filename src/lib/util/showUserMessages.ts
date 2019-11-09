import {window} from 'vscode';

export enum LevelOptions {
    error = 'showErrorMessage',
    info = 'showInformationMessage',
    warn = 'showWarningMessage',
}

export interface MessageOptions {
    data?: any;

    promptLevel? : LevelOptions;
    cancelLevel? : LevelOptions;
    successLevel? : LevelOptions;
    errorLevel?: LevelOptions;
    pendingLevel?: LevelOptions;

    promptMessage? : string;
    cancelMessage?: string;
    successMessage?: string;
    errorMessage?: string;
    pendingMessage?: string;

    confirmAction?: string;
    rejectAction?: string;

    callback : Function;
    successCallback?: Function;
    errorCallback?: Function;
}

/**
 * An async messaging helper for running tasks before and after a callback
 *  with success and error messages.
 * @param options {MessageOptions} User dialog options
 */
export default async function showUserMessages(options : MessageOptions){

    const confirmAction = options.confirmAction || 'Yes';
    const rejectAction = options.rejectAction || 'No';

    if(options.promptMessage){
        const result = await window[options.promptLevel || LevelOptions.info](
            options.promptMessage,
            confirmAction,
            rejectAction
        );

        if(result !== confirmAction) {
            if(options.cancelMessage){
                window[options.cancelLevel || LevelOptions.warn](options.cancelMessage);
            }
            return;
        }
    }

    if(options.pendingMessage){
        window[options.pendingLevel || LevelOptions.info](options.pendingMessage);
    }

    return new Promise(resolve => {
        resolve(options.callback(options.data));
    }).then((result) => {
            if(options.successMessage){
                window[options.successLevel || LevelOptions.info](options.successMessage);
            }

            if(options.successCallback){
                options.successCallback(options.data);
            }

            return result;
        }).catch(e => {
            if(options.errorMessage){
                window[options.pendingLevel || LevelOptions.error](options.errorMessage);
            }

            if(options.errorCallback){
                options.errorCallback(options.data);
            }
            console.error(e);
        });


}