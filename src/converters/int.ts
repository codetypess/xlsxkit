import { Converter } from "../core/contracts";

export const intConverter: Converter = (str) => {
    if (str === "") {
        return null;
    }
    const result = Number(str);
    if (isNaN(result) || result !== (result | 0)) {
        return null;
    }
    return result;
};
