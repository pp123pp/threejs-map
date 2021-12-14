export class URI {
    constructor(uri?: any)
    
    scheme : any;
    authority : any;
    path : any;
    query : any;
    fragment: any;
    
    resolve(baseURI: any): async
    
    normalize(): void

    getAuthority(): string

    getScheme(): string
}
