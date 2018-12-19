
import * as vscode from 'vscode';
import getTokenServer from './server';
import axios from 'axios';
    
export interface ITokenAuthentication {
    accessToken: string;
    refreshToken: string;
    profile: any;
}
const APPID = 'JYBrPM46vyNVTozY';
// const SECRET = '7820dfc5c3254f2b91a095db827a3556';

export default function getAuthToken(url : string) : Promise<ITokenAuthentication>{

    let server : any;

    return new Promise<ITokenAuthentication>(resolve => {
        server = getTokenServer(url, resolve);
        vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(`http://lvh.me:3000/authenticate`));
    }).then((response) => {
        
        setTimeout(() => {
            console.log('Shutting down server...');
            server.close();
        }, 5000);

        return response;

    });

}

export function refreshAccessToken(url : string, refreshToken: string){
    return axios.post(`https://${url}/sharing/oauth2/token`, {
        client_id: APPID,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
    });
}