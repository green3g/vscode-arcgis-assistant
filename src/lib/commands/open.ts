import { ArcGISItem, ArcGISType } from '../ArcGISTreeProvider';
import { Uri, workspace, window, commands} from 'vscode';

export default async function(item :ArcGISItem, scope : any){
    let data = await item.connection.getItem(item.id);
    const directory = `memfs:/${item.connection.url}`;
    const folder = item.folder && item.folder.type === ArcGISType.Folder ? 
        `${directory}/${item.folder.id}` : undefined;
    const file = folder ? `${directory}/${folder}/${item.id}.json`
        : `${directory}/${folder}/${item.id}.json`;
    scope.fs.createDirectory(Uri.parse(directory));
    if(folder){
        scope.fs.createDirectory(folder);
    }
    scope.fs.writeFile(Uri.parse(file), Buffer.from(data), { 
        create: true, overwrite: true 
    });
    workspace.openTextDocument(Uri.parse(file)).then(doc => {
        window.showTextDocument(doc);
        commands.executeCommand('editor.action.format');
    }, (e: any) => console.warn(e));
    console.log(data);

}
        