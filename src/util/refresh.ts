import * as vscode from 'vscode';
import { ArcGISItem } from './types';
import { ArcGISTreeProvider } from '../ArcGISTreeProvider';

export default function refresh(context: vscode.ExtensionContext, item : ArcGISItem, tree : ArcGISTreeProvider){
    tree.refreshItem(item);
}