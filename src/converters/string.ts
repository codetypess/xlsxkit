import { Converter } from "../core/contracts";

export const stringConverter: Converter = (str) => {
    return str === "" ? null : str;
};
