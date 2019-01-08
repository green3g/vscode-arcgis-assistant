import axios from 'axios';
import {Memento} from 'vscode';
import * as param from 'can-param';
import getAuthToken, { ITokenAuthentication, refreshAccessToken } from './auth/oauth';
import serializeArcGISItem from './auth/serializeArcGISItem';

const DEFAULT_PARAMS = {
    f: 'json',
    num: 50,
};

export interface IPortalOptions {
    url: string;
    protocol? : string;
}

const REST = 'sharing/rest';
const CONTENT = `${REST}/content`;
const USERS = `${CONTENT}/users`;
const ITEMS = `${CONTENT}/items`;

let AUTH : ITokenAuthentication;


export default class PortalConnection {
    url : string = 'maps.arcgis.com';
    protocol : string = 'https';
    username! : string;
    store! : Memento;
    folderEndpoint : string = 'sharing/rest/content/users';
    searchEndpoint : string = 'sharing/rest/search';
    itemEndpoint : string = 'sharing/rest/content/items';


    public constructor(args : IPortalOptions){
        Object.assign(this, args);
    }

    public async getFolders() : Promise<any[]>{
        let token;
        try {
            token = await this.getAuthToken();
        } catch(e){
            console.warn(e);
        }
        const params = this.getURLParameters({token});
        const response = await axios(`${this.protocol}://${this.url}/${USERS}/${this.username}?${params}`);
        return this.getResponse(response, 'folders');
    }

    public async getItems(folderId : string = '') : Promise<any[]>{
        const portal = this.url;
        const token = await this.getAuthToken();
        const params = this.getURLParameters({token});
        const response = await axios(`${this.protocol}://${portal}/${USERS}/${this.username}/${folderId}/?${params}`);
        return this.getResponse(response, 'items');
    }

    
    public async getItem(item? : string): Promise<string> {
        const token = await this.getAuthToken();
        const params = this.getURLParameters({token});
        const result = await axios.get(`${this.protocol}://${this.url}/${ITEMS}/${item}/data?${params}`);
        return JSON.stringify(this.getResponse(result));
    }

    public async getItemMetadata(item? : string) : Promise<string>{
        const token = await this.getAuthToken();
        const params = this.getURLParameters({token});
        const result = await axios.get(`${this.protocol}://${this.url}/${ITEMS}/${item}?${params}`);
        return JSON.stringify(this.getResponse(result));
    }

    public async updateItem(itemId: string, folderId: string, content : string){
        try {
            content = JSON.parse(content);
        } catch(e){
            console.warn(e);
            throw new Error('Item contained invalid JSON');
        }
        const url = `${this.protocol}://${this.url}/${USERS}/${this.username}/${folderId}/items/${itemId}/update`;

        const token = await this.getAuthToken();
        const payload = {
            text: JSON.stringify(content),
            f: 'json',
            token,
        };
        await axios.post(url, serializeArcGISItem(payload), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        }).catch(e => {
            console.warn(e);
            throw new Error('Item could not be saved.');
        });
    
    }

    private async getAuthToken() : Promise<string>{
        let authentication : ITokenAuthentication;
        if(typeof AUTH !== 'undefined'){
            authentication = AUTH;
        } else {
            authentication = AUTH = await this.getAuthentication();
        }
        this.username = authentication.profile.username;
        return authentication.accessToken;
    }

    private async getAuthentication() : Promise<ITokenAuthentication> {
        const authentication : ITokenAuthentication = await getAuthToken(this.url);
        try {
            this.verifyAccessToken(authentication.accessToken);
        } catch(e){
            const result = await refreshAccessToken(this.url, authentication.refreshToken);
            if(result.data.error){
                throw new Error(result.data.error.message);
            }
            authentication.accessToken = result.data.accessToken;
        }
        return authentication;
    }

    private async verifyAccessToken(token : string) : Promise<Boolean>{
        const params = this.getURLParameters({token});
        const result = await axios(`${this.protocol}://${this.url}/${REST}?${params}`);
        if(result.data.error){
            throw new Error(result.data.error.message);
        }
        return true;
    }

    private getURLParameters(mixins : any) : string {
        const params = Object.assign({}, DEFAULT_PARAMS, mixins);
        return param(params);
    }

    private getResponse(response : any, propertyName? : string){
        if(response.data.error){
            console.warn(response.data.error);
            throw new Error(response.data.error.message);
        }

        if(!propertyName){
            return response.data;
        }
        
        if(!response.data[propertyName]){
            throw new Error(`Could not find ${propertyName}`);
        }

        return response.data[propertyName];
    }
}