import { removeLastArraySuffix, splitTupleTypename, splitTypename } from "../typename";
import { error } from "./errors";
import { converters } from "./registry";
import { Type, type TCell, type TValue } from "./schema";

const tokenizeArray = (str: string) => {
    str = str.trim();
    if (!str.startsWith("[") || !str.endsWith("]")) {
        error(`Invalid array string: '${str}'`);
    }

    const tokens: string[] = [];
    let current = "";
    let quote = "";
    let depth = 0;
    const content = str.slice(1, -1);
    for (let i = 0; i < content.length; i++) {
        const char = content[i];
        if (!quote) {
            if ((char === '"' || char === "'") && depth === 0) {
                quote = char;
                current = "";
            } else if (char === "{" || char === "[") {
                depth++;
                current += char;
            } else if (char === "}" || char === "]") {
                depth--;
                current += char;
            } else if (char === "," && depth === 0) {
                current = current.trim();
                if (current) {
                    tokens.push(current);
                    current = "";
                }
            } else {
                current += char;
            }
        } else {
            if (char === quote && content[i - 1] !== "\\") {
                quote = "";
            } else {
                current += char;
            }
        }
    }

    current = current.trim();
    if (current) {
        tokens.push(current);
    }

    return tokens;
};

const convertArray = (str: string, typename: string) => {
    const len = Number(typename.match(/\[(\d+)\]$/)?.[1]);
    const itemType = removeLastArraySuffix(typename);
    const tokens = tokenizeArray(str);
    const result = tokens.map((s) => convertValue(s, itemType));
    if (!isNaN(len) && result.length !== len) {
        error(`Array length mismatch: required ${len}, but got ${result.length}`);
    }
    return result;
};

const convertTuple = (str: string, typename: string) => {
    const tuple = splitTupleTypename(typename);
    if (tuple.length === 0) {
        return null;
    }
    const tokens = tokenizeArray(str);
    if (tokens.length !== tuple.length) {
        error(`Tuple length mismatch: required ${tuple.length}, but got ${tokens.length}`);
    }
    return tuple.map((member, index) => convertValue(tokens[index]!, member));
};

const convertScalar = (str: string, typename: string): TValue => {
    const tuple = splitTupleTypename(typename);
    if (tuple.length > 0) {
        try {
            return convertTuple(str, typename);
        } catch {
            return null;
        }
    }

    const base = splitTypename(typename).base;
    const converter = converters[base.match(/^\w+/)?.[0] ?? ""];
    if (!converter) {
        error(`Converter not found: '${typename}'`);
    }

    try {
        return converter(str) ?? null;
    } catch {
        return null;
    }
};

export function convertValue(cell: TCell, typename: string): TCell;
export function convertValue(value: string, typename: string): TValue;
export function convertValue(cell: TCell | string, typename: string) {
    const meta = splitTypename(typename);
    const rawtypename = meta.optional ? typename.slice(0, -1) : typename;
    let v = typeof cell === "string" ? cell : cell.v;

    if (typeof cell !== "string" && cell.t?.replace("?", "") === rawtypename) {
        return cell;
    }

    if (meta.optional && (v === "" || v === null)) {
        if (typeof cell === "string") {
            return null;
        } else {
            cell.s = "null";
            cell.v = null;
            return cell;
        }
    }

    if (typeof v === "object") {
        error(`cell value is an object: ${JSON.stringify(v)}`);
    }

    v = String(v).trim();

    let result: TValue = null;

    if (meta.array) {
        try {
            result = convertArray(v, rawtypename);
        } catch {
            /** keep the public error contract on array conversion failures */
        }
    } else {
        result = convertScalar(v, rawtypename);
    }

    if (result === null) {
        let r = "";
        if (typeof cell === "object" && cell.r) {
            r = `at '${cell.r}'`;
        }
        error(`Convert value error: '${v}' -> type '${typename}' ${r}`);
    }

    if (typeof cell === "string") {
        return result;
    } else {
        cell.s = v;
        cell.v = result;
        cell.t = typename;
        return cell;
    }
}

export const makeCell = (v: TValue, t?: string, r?: string, s?: string) => {
    return { "!type": Type.Cell, v: v ?? null, t, r, s } as TCell;
};
