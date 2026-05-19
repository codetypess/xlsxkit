import { convertValue } from "../core/conversion";
import { error } from "../core/errors";
import { type TCell, type TObject, type TRow, type TValue } from "../core/schema";
import { Context } from "../core/workbook";
import { keys } from "../util";

export type IndexerFilterExpr = {
    file: string;
    sheet: string;
    key: string;
    filter: string;
};

type ParsedValueResolver = (
    value: TValue,
    errors: string[],
    walker: (value: string | number) => boolean
) => boolean;

export type ParsedFilter = {
    key: string;
    literal?: string | number;
    refer?: string;
    resolveFromCell?: ParsedValueResolver;
    source: string;
};

const parseResolver = (expr: IndexerFilterExpr) => {
    type Collector = (value: TValue, collector: TValue[]) => void;
    const collectors: Collector[] = [];
    let str = expr.key.trim().replaceAll(" ", "");

    while (str.length) {
        const [match, query, optional] = str.match(/^(\.\w+|\[\d+\]|\[\*\]|\[\.\])([?]?)/) ?? [];
        if (match) {
            str = str.slice(match.length);
            if (query.startsWith(".")) {
                const key = query.slice(1);
                collectors.push((value, arr) => {
                    if (value && typeof value === "object") {
                        const v = (value as TObject)[key];
                        if (v !== undefined || !optional) {
                            arr.push(v);
                        }
                    } else {
                        arr.push(null);
                    }
                });
            } else if (query === "[*]") {
                collectors.push((value, arr) => {
                    if (Array.isArray(value)) {
                        for (const item of value) {
                            arr.push(item);
                        }
                    } else {
                        arr.push(null);
                    }
                });
            } else if (query === "[.]") {
                collectors.push((value, arr) => {
                    if (value && typeof value === "object") {
                        arr.push(...keys(value as TObject));
                    } else {
                        arr.push(null);
                    }
                });
            } else {
                const index = Number(query.slice(1, -1));
                collectors.push((value, arr) => {
                    if (Array.isArray(value)) {
                        const v = value[index];
                        if (v !== undefined || !optional) {
                            arr.push(v);
                        }
                    } else {
                        arr.push(null);
                    }
                });
            }
        } else {
            throw new Error(`Invalid query: ${expr}`);
        }
    }

    const arr: TValue[] = [];
    return (value: TValue, errors: string[], walker: (value: string | number) => boolean) => {
        arr.length = 0;
        arr.push(value);
        let start = 0;
        for (const query of collectors) {
            const length = arr.length;
            for (let i = start; i < length; i++) {
                query(arr[i], arr);
            }
            start = length;
        }
        for (let i = start; i < arr.length; i++) {
            const v = arr[i];
            if (!(typeof v === "string" || typeof v === "number")) {
                errors.push(`data type error: data=${v} type=${typeof v}`);
                return false;
            } else if (!walker(v)) {
                errors.push(`${v}`);
                return false;
            }
        }
        return true;
    };
};

const parseFilter = (ctx: Context, expr: IndexerFilterExpr) => {
    const workbook = ctx.get(expr.file);
    const findField = (name: string) => {
        if (expr.sheet === "*") {
            for (const sheet of workbook.sheets) {
                const field = sheet.fields.find((f) => f.name === name);
                if (field) {
                    return field;
                }
            }
        } else {
            const sheet = workbook.get(expr.sheet);
            return sheet.fields.find((f) => f.name === name);
        }
    };
    return expr.filter
        .replaceAll(" ", "")
        .split("&")
        .filter((s) => s.length)
        .map((s) => {
            const [, key, value] = s.match(/^(\w+)=(.+)$/) ?? [];
            if (key && value) {
                const field = findField(key);
                if (!field) {
                    error(`Field not found: ${key}`);
                }
                if (value.startsWith("@")) {
                    return {
                        key,
                        refer: value.slice(1),
                        source: value,
                    } satisfies ParsedFilter;
                }

                if (value.startsWith("$")) {
                    return {
                        key,
                        resolveFromCell: parseResolver({ ...expr, key: value.slice(1) }),
                        source: value,
                    } satisfies ParsedFilter;
                }

                const v = convertValue(value, field.typename);
                return {
                    key,
                    literal: v as string | number,
                    source: value,
                } satisfies ParsedFilter;
            } else {
                error(`Invalid filter: ${expr.filter}`);
            }
        }) as readonly ParsedFilter[];
};

export const resolveFilterValue = (
    entry: ParsedFilter,
    row: TRow,
    cellValue: TValue,
    errors: string[]
) => {
    if (entry.resolveFromCell) {
        const values: Array<string | number> = [];
        const ok = entry.resolveFromCell(cellValue, errors, (value) => {
            values.push(value);
            return true;
        });
        if (!ok) {
            return undefined;
        }
        if (values.length !== 1) {
            errors.push(`filter value error: ${entry.source}`);
            return undefined;
        }
        return values[0];
    }

    if (entry.refer) {
        const refer = row[entry.refer] as TCell | undefined;
        if (!refer || refer.v === null || refer.v === undefined) {
            errors.push(`not found ${entry.refer} in row`);
            return undefined;
        }
        if (typeof refer.v !== "string" && typeof refer.v !== "number") {
            errors.push(`refer type error: data=${refer.v} type=${typeof refer.v}`);
            return undefined;
        }
        return refer.v;
    }

    if (entry.literal === undefined) {
        errors.push(`filter value error: ${entry.source}`);
        return undefined;
    }
    return entry.literal;
};

export const parseIndexerAst = (
    ctx: Context,
    rowExpr: IndexerFilterExpr,
    colExpr: IndexerFilterExpr
) => {
    return {
        value: {
            key: rowExpr.key,
            resolve: parseResolver(rowExpr),
            filter: parseFilter(ctx, rowExpr),
        },
        target: {
            key: colExpr.key,
            filter: parseFilter(ctx, colExpr),
        },
    };
};
