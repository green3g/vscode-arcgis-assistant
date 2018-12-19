import * as vscode from 'vscode';
import { ArcGISTreeProvider, ArcGISItem } from '../ArcGISTreeProvider';

export default function refresh(context: vscode.ExtensionContext, item : ArcGISItem, tree : ArcGISTreeProvider){
    tree.refreshItem(item);
}