import { ArcGISItem } from '../ArcGISTreeProvider';
import { Uri, workspace, window, commands} from 'vscode';

export default async function(item :ArcGISItem, scope : any){
    let data = await item.connection.getItem(item.id);
    const file = `memfs:/${item.id}.json`;
    scope.fs.writeFile(Uri.parse(file), Buffer.from(data), { 
        create: true, overwrite: true 
    });
    workspace.openTextDocument(Uri.parse(file)).then(doc => {
        window.showTextDocument(doc);
        commands.executeCommand('editor.action.format');
    }, (e: any) => console.warn(e));
    console.log(data);

}
        