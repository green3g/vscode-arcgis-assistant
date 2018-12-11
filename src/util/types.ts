
export enum ArcGISType {Portal, Folder, Item}
export interface ArcGISItem {
    title: string;
    type: ArcGISType;
    uri: string;
    id?: string;
    portal?: ArcGISItem;
    folder?: ArcGISItem;
}