import {window} from 'vscode';
import PortalConnection from '../PortalConnection';


export default async function saveItem (itemId: string, content: string, portal : PortalConnection) {

    const {data} = await portal.getItem(itemId);
    if(data === content){
        return;
    }

    const result = await window.showInformationMessage(`You've made some changes.
        Do you want to upload ${itemId} to your portal?`, 'Yes', 'Not Yet');

    if(result !== 'Yes'){
        return;
    }


    window.showInformationMessage('Saving item...please wait.');
    try {
        JSON.parse(content);
    } catch(e){
        window.showErrorMessage('The item JSON is not valid. Please fix your content first.');
        console.warn(e);
        return;
    }
    portal.updateItem(itemId, content).then(() => {
        window.showInformationMessage('Item saved successfully!');
    }).catch(e => {
        window.showErrorMessage('The item could not be saved. Check to ensure your JSON is valid');
    });
}