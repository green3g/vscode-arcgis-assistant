import * as authenticate from 'arcgis-node-util/src/auth/oauth';
import {
    searchItems, SearchQueryBuilder, ISearchOptions,
    IItem, getItem,getItemData, updateItem, createItem, IItemAdd, removeItem, searchGroups, getUser,
} from '@esri/arcgis-rest-portal';
import {UserSession} from '@esri/arcgis-rest-auth';
import { request } from '@esri/arcgis-rest-request';

const DEFAULT_PARAMS = {
    start: 1,
    num: 100,
    sortField: 'title',
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

    public async getFolders() : Promise<any[]>{
        await this.authenticate();
        return request(`${this.restURL}/content/users/${this.authentication.username}`, {
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
        }).then(user => user.groups || []);
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
                .match(this.authentication.username)
                .in('owner');
        }
        const query = {
            num: 100,
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
            return results.reduce((previous : any, current : any) => {
                const features = current.results || [];
                return previous.concat(features);
            }, []);
        });

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