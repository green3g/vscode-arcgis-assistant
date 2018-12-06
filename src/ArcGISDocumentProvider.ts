import { TextDocumentContentProvider, Uri, ProviderResult } from 'vscode';
import axios from 'axios';
import { token } from './util/token';

export class ArcGISDocumentProvider implements TextDocumentContentProvider {
    static scheme = 'arcgis';

    private getArcGISItem(itemUrl: string): Thenable<string> {
        itemUrl = itemUrl.replace('.json', '');
        return axios.get(`${itemUrl}/data?f=json&token=${token}`).then(result => {
            return JSON.stringify(result.data);
        });
    }

    public provideTextDocumentContent(uri: Uri): ProviderResult<string> {
        return this.getArcGISItem(uri.path);
    }
}