function defaultValue (a: any, b: any): any {
    if (a !== undefined && a !== null) {
        return a;
    }
    return b;
}

defaultValue.EMPTY_OBJECT = Object.freeze({});

export { defaultValue };
