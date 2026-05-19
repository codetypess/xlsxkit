import { Converter } from "../core/contracts";

export const floatConverter: Converter = (str) => {
    if (str === "") {
        return null;
    }
    const result = Number(str);
    if (isNaN(result)) {
        return null;
    }
    return result;
};
