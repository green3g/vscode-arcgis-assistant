import axios from 'axios';
import {Memento} from 'vscode';
import * as param from 'can-param';
import serializeArcGISItem from './auth/serializeArcGISItem';
import * as authenticate from 'arcgis-node-util/src/auth/oauth';
import {searchUsers, searchItems, SearchQueryBuilder, ISearchOptions, getItemData, updateItem} from '@esri/arcgis-rest-portal';
import {UserSession} from '@esri/arcgis-rest-auth';
import { request } from '@esri/arcgis-rest-request';

const DEFAULT_PARAMS = {
        start: 1,
        num: 100,    
};

const APPID = 'JYBrPM46vyNVTozY';

export default class PortalConnection {
    portal: string = 'https://maps.arcgis.com'
    restEndpoint: string = 'sharing/rest';
    authentication!: UserSession;
    params: ISearchOptions;
    authenticationPromise: Promise<UserSession>;

    public constructor(options : Object){
        Object.assign(this, {
            ...options,
            params: {
                ...DEFAULT_PARAMS,
                ...options.params,
            }
        });
    }


    
    public async getFolders() : Promise<any[]>{
        await this.authenticate();
        return request(`${this.restURL}/content/users/${this.authentication.username}`, {
            authentication: this.authentication,
            portal: this.restURL,
        }).then(result => {
            return result.folders;
        })
    }

    public async getItems(params : ISearchOptions = {}){
        await this.authenticate();
        if(!params.q){
            const user = await this.authentication.getUser()
            params.q = new SearchQueryBuilder()
                .match(user.orgId)
                .in('orgid')
                .and()
                .match('root')
                .in('ownerfolder')
                .and()
                .match(this.authentication.username)
                .in('owner');
        }
        const query = {
            ...this.params,
            ...params,
            authentication: this.authentication,
            portal: this.restURL,
        };
    
        const {total} = await searchItems({
            ...query,
            num: 0,
        });
    
        const pages = Math.round(total / query.num);
        const promises = [];
        for (let i = 0; i <= pages; i ++) {
            promises.push(searchItems({
                ...query,
                start: 1 + (i * query.num),
            }).catch((e) => {
                console.log(`Error while searching items. \n ${e} \n`, query);
                return {};
            }));
        }
    
        return await Promise.all(promises).then((results) => {
            return results.reduce((previous, current) => {
                const features = current.results || [];
                return previous.results.concat(features);
            }, {results: []});
        });

    }

    public async getItem(itemId : string) : Promise<Object>{
        return getItemData(itemId, {
            authentication: this.authentication,
            portal: this.restURL,
        }).then(data => JSON.stringify(data, null, 4));
    }

    public async updateItem(itemId, data){
        return updateItem({
            item: {
                id: itemId,
                text: typeof data !== 'string' ? JSON.stringify(data) : data,
            },
            portal: this.restURL,
            authentication: this.authentication, 
        })
    }

    private authenticate() : Promise<UserSession>{
        if(typeof this.authentication === 'undefined'){
            this.authenticationPromise = authenticate({
                appId: APPID,
                portalUrl: this.portal,
            });
        }
        return this.authenticationPromise.then(result => this.authentication = result);
    }

    get portalName(){
        return this.portal.replace(/(https?|[/:])*/, '');
    }
    get restURL(){
        return `${this.portal}/${this.restEndpoint}`;
    }
}