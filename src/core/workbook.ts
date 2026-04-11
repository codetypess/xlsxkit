import { basename, extname } from "path";
import { keys } from "../util";
import { assert, error } from "./errors";
import { DEFAULT_WRITER } from "./registry";
import { type Sheet, type TObject, type TRow, type TValue } from "./schema";
import { copyTag } from "./value";

export class Workbook {
    readonly path: string;
    readonly name: string;
    readonly context: Context;

    private readonly _sheets: Record<string, Sheet>;

    constructor(context: Context, path: string) {
        this.path = path;
        this.name = basename(path, extname(path));
        this._sheets = {};
        this.context = context;
    }

    get sheets(): readonly Sheet[] {
        return Object.values(this._sheets).sort((a, b) => a.name.localeCompare(b.name));
    }

    add(sheet: Sheet) {
        this._sheets[sheet.name] = sheet;
    }

    remove(name: string) {
        delete this._sheets[name];
    }

    has(name: string) {
        return !!this._sheets[name];
    }

    get(name: string) {
        if (!this._sheets[name]) {
            throw new Error(`Sheet not found: ${name}`);
        }
        return this._sheets[name];
    }

    clone(ctx: Context) {
        const newWorkbook = new Workbook(ctx, this.path);

        const includeWriters = (writers: string[]) => {
            if (ctx.writer === DEFAULT_WRITER || writers.length === 0) {
                return true;
            } else {
                return writers.includes(ctx.writer);
            }
        };

        const deepCopy = <T extends TValue>(value: T): T => {
            if (value && typeof value === "object") {
                const obj: TObject = (Array.isArray(value) ? [] : {}) as TObject;
                for (const k in value) {
                    let v = (value as TObject)[k];
                    if (!k.startsWith("!")) {
                        v = deepCopy(v);
                    }
                    obj[k] = v;
                }
                return obj as T;
            } else {
                return value;
            }
        };

        for (const sheet of this.sheets) {
            if (includeWriters(sheet.fields[0].writers)) {
                const newSheet: Sheet = {
                    name: sheet.name,
                    ignore: sheet.ignore,
                    processors: structuredClone(sheet.processors),
                    fields: structuredClone(sheet.fields).filter((f) => includeWriters(f.writers)),
                    data: {},
                };
                copyTag(sheet.data, newSheet.data);
                newWorkbook.add(newSheet);
                for (const key of keys(sheet.data)) {
                    const row = sheet.data[key] as TRow;
                    const newRow: TRow = {};
                    copyTag(row, newRow);
                    newSheet.data[key] = newRow;
                    for (const field of newSheet.fields) {
                        newRow[field.name] = deepCopy(row[field.name]);
                    }
                }
            }
        }

        return newWorkbook;
    }
}

export class Context {
    readonly writer: string;
    readonly tag: string;

    private readonly _workbooks: Record<string, Workbook> = {};

    constructor(writer: string, tag: string) {
        this.writer = writer;
        this.tag = tag;
    }

    get workbooks(): readonly Workbook[] {
        return Object.values(this._workbooks).sort((a, b) =>
            a.path.localeCompare(b.path)
        ) as readonly Workbook[];
    }

    add(workbook: Workbook) {
        assert(workbook.context === this, `Context mismatch`);
        assert(!this._workbooks[workbook.path], `Workbook already added: ${workbook.path}`);
        this._workbooks[workbook.path] = workbook;
    }

    remove(path: string): void;
    remove(workbook: Workbook): void;
    remove(pathOrWorkbook: Workbook | string) {
        if (typeof pathOrWorkbook === "string") {
            delete this._workbooks[pathOrWorkbook];
        } else {
            delete this._workbooks[pathOrWorkbook.path];
        }
    }

    get(path: string) {
        const found = Object.keys(this._workbooks)
            .filter((file) => file.endsWith(path))
            .filter((file) => basename(file) === basename(path));
        if (found.length === 0) {
            error(`File not found: ${path}`);
        } else if (found.length > 1) {
            error(`Multiple files found: ${found.join(", ")}`);
        }
        return this._workbooks[found[0]];
    }
}

const contexts: Context[] = [];
let runningContext: Context | undefined;

export const setRunningContext = (context: Context) => {
    runningContext = context;
};

export const clearRunningContext = () => {
    runningContext = undefined;
};

export const getRunningContext = () => {
    if (!runningContext) {
        throw new Error(`No running context`);
    }
    return runningContext;
};

export const getContexts = (): readonly Context[] => {
    return contexts;
};

export const getContext = (writer: string, tag: string) => {
    return contexts.find((c) => c.writer === writer && c.tag === tag);
};

export const addContext = (context: Context) => {
    if (getContext(context.writer, context.tag)) {
        throw new Error(`Context already exists: writer=${context.writer}, tag=${context.tag}`);
    }
    contexts.push(context);
    return context;
};

export const removeContext = (context: Context) => {
    const index = contexts.indexOf(context);
    if (index !== -1) {
        contexts.splice(index, 1);
    }
};
