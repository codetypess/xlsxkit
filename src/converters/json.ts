import JSON5 from "json5";
import { Converter } from "../core/contracts";

export const jsonConverter: Converter = (str) => {
    try {
        return JSON5.parse(str);
        // eslint-disable-next-line no-empty
    } catch (_) {}
    try {
        return JSON.parse(str);
        // eslint-disable-next-line no-empty
    } catch (_) {}
    return null;
};
