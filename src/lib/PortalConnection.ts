import * as authenticate from 'arcgis-node-util/src/auth/oauth';
import {
    searchItems, SearchQueryBuilder, ISearchOptions,
    IItem, getItem,getItemData, updateItem, createItem, IItemAdd, removeItem, searchGroups, getUser, searchUsers,
} from '@esri/arcgis-rest-portal';
import {UserSession} from '@esri/arcgis-rest-auth';
import { request } from '@esri/arcgis-rest-request';

const DEFAULT_PARAMS = {
    start: 1,
    num: 100,
};

const APPID = 'JYBrPM46vyNVTozY';
const PORTAL = 'https://maps.arcgis.com';
const REST_ENDPOINT = 'sharing/rest';

export interface PortalItemData {
    item: IItem;
    data: string;
}

export interface PortalOptions {
    portal: string;
    restEndpoint?: string;
    params?: ISearchOptions;
    authentication?: UserSession;
    appId? : string | undefined;
}

function getOrDefault(obj : any, prop : string, defaultVal : any) : any {
    return obj[prop] || defaultVal;
}

function sortObjectArray(array: any[], field: string){
    function compare(a : any, b : any) {
        const aVal : any = a[field];
        const bVal : any = b[field];

        // a is less than b
        if (aVal < bVal) {
          return -1;
        }
        // a is greater than b
        if (aVal > bVal) {
          return 1;
        }
        // a must be equal to b
        return 0;
      }

      return array.sort(compare);
}

async function queryAll(queryFunction : Function, params : any = {}){

    const {total} = await queryFunction({
        ...params,
        num: 0,
    });

    const pages = Math.round(total / params.num);
    const promises = [];
    for (let i = 0; i <= pages; i ++) {
        promises.push(queryFunction({
            ...params,
            start: 1 + (i * params.num),
        }).catch((e : any) => {
            console.log(`Error while searching items. \n ${e} \n`, params);
            return {};
        }));
    }

    return await Promise.all(promises).then((results) => {
        return results.reduce((previous : any, current : any) => {
            const features = current.results || [];
            return previous.concat(features);
        }, []);
    });
}

export default class PortalConnection {
    portal: string = PORTAL;
    appId: string | undefined = APPID;
    restEndpoint: string = REST_ENDPOINT;
    authentication!: UserSession;
    params!: ISearchOptions;
    authenticationPromise!: Promise<UserSession>;

    public constructor(options : PortalOptions){
        Object.assign(this, {
            appId: getOrDefault(options, 'appId', APPID),
            portal: getOrDefault(options, 'portal', PORTAL),
            restEndpoint: getOrDefault(options, 'restEndpoint', REST_ENDPOINT),
            params: {
                ...DEFAULT_PARAMS,
                ...options.params,
            }
        });
    }

    get portalName(){
        return this.portal.replace(/(https?|[/:])*/, '');
    }
    get restURL(){
        return `${this.portal}/${this.restEndpoint}`;
    }

    public authenticate() : Promise<UserSession>{
        if(typeof this.authentication === 'undefined'){
            this.authenticationPromise = new Promise((resolve, reject) => {
                authenticate({
                    appId: this.appId,
                    portalUrl: this.restURL,
                }).then(resolve);
                setTimeout(() => {
                    reject(new Error('Timeout Exceeded'));
                }, 1000 * 120);
            });
        }
        return this.authenticationPromise
            .then(result => this.authentication = result)
            .catch(e => {
                console.error(e);
                delete this.authenticationPromise;
                return this.authenticate();
            });
    }

    public async getFolders(username? : string) : Promise<any[]>{
        await this.authenticate();
        username = username || this.authentication.username;
        return request(`${this.restURL}/content/users/${username}`, {
            authentication: this.authentication,
            portal: this.restURL,
        }).then(result => {
            return result.folders;
        });
    }

    public async getGroups() : Promise<any[]> {
        await this.authenticate();
        return getUser({
            username: this.authentication.username,
            authentication: this.authentication,
            portal: this.restURL,
        }).then(user => sortObjectArray( user.groups || [], 'title'));
    }

    public async getUsers(params : any = {}) : Promise<any[]> {
        await this.authenticate();
        if(!params.q){
            const user = await this.authentication.getUser();
            params.q = new SearchQueryBuilder()
                .match(user.orgId || '')
                .in('orgid')
        }

        const query = {
            num: 1000,
            ...this.params,
            ...params,
            authentication: this.authentication,
            portal: this.restURL,
            // sortField: 'username',
        }

        return queryAll(searchUsers, query).then((users) => sortObjectArray(users, 'username'));
    }

    public async getItems(params : any = {}){
        await this.authenticate();
        if(!params.q){
            const user = await this.authentication.getUser();
            params.q = new SearchQueryBuilder()
                .match(user.orgId || '')
                .in('orgid')
                .and()
                .match('root')
                .in('ownerfolder')
                .and()
                .match(params.username || this.authentication.username)
                .in('owner');
        }
        const query = {
            num: 1000,
            sortField: 'username',
            ...this.params,
            ...params,
            authentication: this.authentication,
            portal: this.restURL,
        };

        return queryAll(searchItems, query).then(items => sortObjectArray(items, 'title'))

    }

    public async getItem(itemId : string) : Promise<PortalItemData>{
        const item = await getItem(itemId, {
            portal: this.restURL,
            authentication: this.authentication,
        });
        const itemData = await getItemData(itemId, {
            authentication: this.authentication,
            portal: this.restURL,
        });

        let data;
        if(typeof itemData === 'string'){
            try {
                data = JSON.parse(itemData);
            } catch(e){
                data = itemData;
            }
        } else {
            data = itemData;
        }

        return {item, data};
    }

    public async updateItem(item: IItem, data : any){
        return updateItem({
            item: {
                owner: item.owner,
                id: item.id,
                text: this.getSafeData(data),
            },
            portal: this.restURL,
            authentication: this.authentication,
        });
    }

    public createItem( item : IItem, content: any, folder?: string){
        return createItem({
            item: item,
            text: this.getSafeData(content),
            folderId: folder,
            authentication: this.authentication,
            portal: this.restURL,
        });
    }

    public deleteItem(id : string){
        return removeItem({
            id: id,
            authentication: this.authentication,
            portal: this.restURL,
        });
    }

    private getSafeData(data: any){
        if(typeof data === 'object'){
            return JSON.stringify(data);
        }
        try {
            return JSON.stringify(JSON.parse(data));
        } catch(e){
            if(typeof data !== 'string'){
                return JSON.stringify(data);
            }

            return data;
        }
    }
}