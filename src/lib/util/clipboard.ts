import {copy as c, paste as p} from 'copy-paste'

export function copy(data : any) : Promise<any> {
    return new Promise((resolve, reject) => {
        c(data, (err)  => {
            if(err){
                reject(err)
            } else {
                resolve();
            }
        });
    });
}

export function paste() : Promise<any> {
    return new Promise((resolve, reject) => {
        p((err, content) => {
            if(err){
                reject(err);
            } else {
                resolve(content);
            }
        });
    });
}