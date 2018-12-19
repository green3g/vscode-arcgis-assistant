import { ArcGISItem } from '../ArcGISTreeProvider';

export default async function(item :ArcGISItem){
    // mkdirp.sync(output);
    // const localPath = `${output}/${item.id}.json`;
    if(!item.id){
        return;
    }
    let data = await item.connection.getItem(item.id);
    // const doc = await workspace.openTextDocument(localPath).then(doc => {
    //     window.showTextDocument(doc);
    //     commands.executeCommand('editor.action.format');
    // });
    console.log(data);

}
        