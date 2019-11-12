export default function cleanString(str : string | undefined) : string {
    if(!str){
        return '';
    }

    return str.replace(/\s+/g, '');
}