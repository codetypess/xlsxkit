import JSON5 from "json5";
import { convertValue } from "./core/conversion";
import { assert, error } from "./core/errors";
import { converters, registerType } from "./core/registry";
import { type Sheet, type TObject } from "./core/schema";
import { type Context, Workbook } from "./core/workbook";
import { StringBuffer } from "./stringify";
import { splitTupleTypename, splitTypename } from "./typename";
import { toPascalCase } from "./util";

export type TypedefLiteral = string | number;

export type TypedefField = {
    readonly name: string;
    readonly comment: string;
    readonly rawType: string;
    readonly type: string;
    readonly literal?: TypedefLiteral;
    readonly checkerSource?: string;
    readonly checkerLocation?: string;
};

export type TypedefObject = {
    readonly kind: "object";
    readonly name: string;
    readonly comment: string;
    readonly fields: readonly TypedefField[];
};

export type TypedefUnion = {
    readonly kind: "union";
    readonly name: string;
    readonly comment: string;
    readonly discriminator: string;
    readonly members: readonly string[];
};

export type TypedefEntry = TypedefObject | TypedefUnion;

export type TypedefWorkbook = {
    readonly path: string;
    readonly sheet: string;
    readonly types: readonly TypedefEntry[];
};

type TypedefOwner = {
    readonly key: string;
    readonly path: string;
    readonly sheet: string;
};

const typedefWorkbooks = new Map<string, TypedefWorkbook>();
const typedefWorkbookKeysByPath = new Map<string, Set<string>>();
const typedefEntries = new Map<string, TypedefEntry>();
const typedefOwners = new Map<string, TypedefOwner>();
const typedefCheckerPresence = new Map<string, boolean>();

const basicTypes = ["string", "number", "boolean", "unknown", "object"];
const emptyTypes = new Set<string>();

export { splitTypename } from "./typename";

const applyTsArraySuffix = (type: string, array: string, readonlyArray: boolean) => {
    if (!array) {
        return type;
    }
    const depth = array.length / 2;
    const wrap = /[|&]/.test(type) ? `(${type})` : type;
    let result = readonlyArray ? `readonly ${wrap}[]` : `${wrap}[]`;
    for (let i = 1; i < depth; i++) {
        result = readonlyArray ? `readonly (${result})[]` : `(${result})[]`;
    }
    return result;
};

const applyLuaArraySuffix = (type: string, array: string) => {
    if (!array) {
        return type;
    }
    return `${type.includes("|") ? `(${type})` : type}${array}`;
};

function resolveTsType(
    typename: string,
    localTypes: ReadonlySet<string>,
    importer: TypeImporter,
    readonlyArray = false
) {
    const meta = splitTypename(typename);
    const result = applyTsArraySuffix(
        resolveTsBaseType(meta.base, localTypes, importer),
        meta.array,
        readonlyArray
    );
    return {
        type: result,
        optional: meta.optional,
    };
}

function resolveTsBaseType(
    base: string,
    localTypes: ReadonlySet<string>,
    importer: TypeImporter
): string {
    const tuple = splitTupleTypename(base);
    if (tuple.length > 0) {
        const members = tuple.map((member) => {
            const resolved = resolveTsType(member, localTypes, importer);
            return resolved.optional ? `${resolved.type} | null` : resolved.type;
        });
        return `[${members.join(", ")}]`;
    }
    if (base.startsWith("#")) {
        return stringifyLiteral(tryParseLiteral(base) ?? base.slice(1));
    }
    if (base === "int" || base === "float" || base === "auto") {
        return "number";
    }
    if (base === "string") {
        return "string";
    }
    if (base === "bool") {
        return "boolean";
    }
    if (
        base.startsWith("json") ||
        base.startsWith("table") ||
        base.startsWith("unknown") ||
        base.startsWith("@")
    ) {
        return "unknown";
    }
    if (localTypes.has(base)) {
        return base;
    }
    return importer.resolve(base).type;
}

function resolveLuaType(
    typename: string,
    localTypes: ReadonlySet<string>,
    resolver: TypeResolver,
    atAsTable = false
) {
    const meta = splitTypename(typename);
    const result = applyLuaArraySuffix(
        resolveLuaBaseType(meta.base, localTypes, resolver, atAsTable),
        meta.array
    );
    return {
        type: result,
        optional: meta.optional,
    };
}

function resolveLuaBaseType(
    base: string,
    localTypes: ReadonlySet<string>,
    resolver: TypeResolver,
    atAsTable: boolean
): string {
    const tuple = splitTupleTypename(base);
    if (tuple.length > 0) {
        return "table";
    }
    if (base.startsWith("#")) {
        return stringifyLiteral(tryParseLiteral(base) ?? base.slice(1));
    }
    if (base === "int" || base === "auto") {
        return "integer";
    }
    if (base === "float") {
        return "number";
    }
    if (base === "string") {
        return "string";
    }
    if (base.startsWith("@")) {
        return atAsTable ? "table" : "string";
    }
    if (base === "bool") {
        return "boolean";
    }
    if (base.startsWith("json") || base.startsWith("table") || base.startsWith("unknown")) {
        return "table";
    }
    if (localTypes.has(base)) {
        return base;
    }
    return resolver(base).type;
}

const ensureRuntimeTypeSupported = (typename: string, where: string) => {
    const meta = splitTypename(typename);
    const tuple = splitTupleTypename(meta.base);
    if (tuple.length > 0) {
        tuple.forEach((member) => ensureRuntimeTypeSupported(member, where));
        return;
    }

    if (
        meta.base.startsWith("@") ||
        meta.base === "int" ||
        meta.base === "float" ||
        meta.base === "auto" ||
        meta.base === "string" ||
        meta.base === "bool" ||
        meta.base.startsWith("json") ||
        meta.base.startsWith("table") ||
        meta.base.startsWith("unknown")
    ) {
        return;
    }

    if (!converters[meta.base]) {
        throw new Error(`converter not found: ${meta.base} (${where})`);
    }
};

const tryParseLiteral = (typename: string): TypedefLiteral | null => {
    if (!typename.startsWith("#")) {
        return null;
    }
    const raw = typename.slice(1).trim();
    if (raw.match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/)) {
        return Number(raw);
    }
    return raw;
};

const stringifyLiteral = (value: TypedefLiteral) => {
    return typeof value === "number" ? String(value) : JSON.stringify(value);
};

const makeLiteralKey = (value: TypedefLiteral) => {
    return `${typeof value}:${String(value)}`;
};

const makeTypedefWorkbookKey = (path: string, sheet: string) => {
    return `${path}#${sheet}`;
};

const formatTypedefOwner = (owner: TypedefOwner) => {
    return `${owner.path}#${owner.sheet}`;
};

export const registerTypedefWorkbook = (typedefWorkbook: TypedefWorkbook) => {
    const key = makeTypedefWorkbookKey(typedefWorkbook.path, typedefWorkbook.sheet);
    const previous = typedefWorkbooks.get(key);
    const nextOwners = new Map<string, TypedefOwner>();

    for (const type of typedefWorkbook.types) {
        const previousOwner = typedefOwners.get(type.name);
        if (previousOwner && previousOwner.key !== key) {
            throw new Error(
                `Typedef '${type.name}' is already defined at ${formatTypedefOwner(previousOwner)} ` +
                    `and duplicated at ${typedefWorkbook.path}#${typedefWorkbook.sheet}`
            );
        }
        nextOwners.set(type.name, {
            key,
            path: typedefWorkbook.path,
            sheet: typedefWorkbook.sheet,
        });
    }

    if (previous) {
        for (const type of previous.types) {
            if (typedefOwners.get(type.name)?.key === key) {
                typedefEntries.delete(type.name);
                typedefOwners.delete(type.name);
            }
        }
    }

    typedefWorkbooks.set(key, typedefWorkbook);
    typedefWorkbookKeysByPath.set(
        typedefWorkbook.path,
        (typedefWorkbookKeysByPath.get(typedefWorkbook.path) ?? new Set()).add(key)
    );
    for (const type of typedefWorkbook.types) {
        typedefEntries.set(type.name, type);
        typedefOwners.set(type.name, nextOwners.get(type.name)!);
    }
    typedefCheckerPresence.clear();
};

const parseTypedefJson = (str: string) => {
    try {
        return JSON5.parse(str);
    } catch {
        return JSON.parse(str);
    }
};

const stringifyNestedValue = (value: unknown) => {
    if (typeof value === "string") {
        return value;
    }
    if (typeof value === "number" || typeof value === "boolean") {
        return String(value);
    }
    return JSON.stringify(value);
};

export const registerTypedefConverters = (typedefWorkbook: TypedefWorkbook) => {
    const convertObject = (type: TypedefObject, raw: unknown) => {
        assert(
            !!raw && typeof raw === "object" && !Array.isArray(raw),
            `Typedef '${type.name}' expects an object`
        );
        const source = raw as Record<string, unknown>;
        const result: TObject = {};
        const rest = new Set(Object.keys(source));

        for (const field of type.fields) {
            rest.delete(field.name);
            const meta = splitTypename(field.type);
            const value = source[field.name];
            if (value === undefined || value === null) {
                if (meta.optional) {
                    continue;
                }
                error(`Typedef '${type.name}.${field.name}' is required`);
            }
            if (field.literal !== undefined) {
                assert(
                    value === field.literal,
                    `Typedef '${type.name}.${field.name}' expects literal ${stringifyLiteral(
                        field.literal
                    )}`
                );
                result[field.name] = field.literal;
                continue;
            }
            result[field.name] = convertValue(stringifyNestedValue(value), field.type);
        }

        assert(
            rest.size === 0,
            `Typedef '${type.name}' has unexpected fields: ${Array.from(rest).sort().join(", ")}`
        );

        return result;
    };

    for (const type of typedefWorkbook.types) {
        registerType(type.name, (value) => {
            const raw = parseTypedefJson(value);
            const current = getTypedef(type.name);
            assert(!!current, `Typedef '${type.name}' is not registered`);
            return convertObject(resolveTypedefObject(current, raw), raw);
        });
    }
};

export const getTypedefWorkbook = (pathOrWorkbook: string | Workbook, sheet?: string) => {
    const path = typeof pathOrWorkbook === "string" ? pathOrWorkbook : pathOrWorkbook.path;
    if (sheet) {
        return typedefWorkbooks.get(makeTypedefWorkbookKey(path, sheet)) ?? null;
    }
    const keys = Array.from(typedefWorkbookKeysByPath.get(path) ?? []);
    if (keys.length === 0) {
        return null;
    }
    assert(keys.length === 1, `Multiple typedef sheets found in '${path}', specify the sheet name`);
    return typedefWorkbooks.get(keys[0]) ?? null;
};

export const getTypedef = (typename: string) => {
    return typedefEntries.get(typename) ?? null;
};

export const getTypedefOwner = (typename: string) => {
    const owner = typedefOwners.get(typename);
    if (!owner) {
        return null;
    }
    return {
        path: owner.path,
        sheet: owner.sheet,
    };
};

const resolveUnionMembers = (union: TypedefUnion) => {
    const members = new Map<string, TypedefObject>();
    for (const member of union.members) {
        const objectType = getTypedef(member);
        assert(
            !!objectType && objectType.kind === "object",
            `Typedef union '${union.name}' member '${member}' must be an object type`
        );
        const discriminatorField = objectType.fields.find(
            (field) => field.name === union.discriminator
        );
        assert(
            !!discriminatorField?.literal,
            `Typedef union '${union.name}' member '${member}' must define ` +
                `literal field '${union.discriminator}'`
        );
        members.set(makeLiteralKey(discriminatorField.literal), objectType);
    }
    return members;
};

export const resolveTypedefObject = (type: TypedefEntry, raw: unknown) => {
    if (type.kind === "object") {
        return type;
    }
    assert(
        !!raw && typeof raw === "object" && !Array.isArray(raw),
        `Typedef '${type.name}' expects an object`
    );
    const source = raw as Record<string, unknown>;
    const member = resolveUnionMembers(type).get(
        makeLiteralKey(source[type.discriminator] as TypedefLiteral)
    );
    assert(
        !!member,
        `Typedef union '${type.name}' cannot resolve discriminator '${type.discriminator}'`
    );
    return member;
};

export const resolveTypedefObjectByTypename = (typename: string, raw: unknown) => {
    const optional = typename.endsWith("?");
    const clean = optional ? typename.slice(0, -1) : typename;
    const array = clean.match(/(?:\[\d*\])+$/)?.[0] ?? "";
    const base = clean.slice(0, clean.length - array.length);
    const type = getTypedef(base);
    if (!type) {
        return null;
    }
    return resolveTypedefObject(type, raw);
};

const hasTypedefCheckerEntry = (type: TypedefEntry, visiting: Set<string>) => {
    const cached = typedefCheckerPresence.get(type.name);
    if (cached !== undefined) {
        return cached;
    }
    if (visiting.has(type.name)) {
        return false;
    }
    visiting.add(type.name);
    let result = false;
    if (type.kind === "union") {
        result = type.members.some((member) => {
            const entry = getTypedef(member);
            return !!entry && hasTypedefCheckerEntry(entry, visiting);
        });
    } else {
        result = type.fields.some((field) => {
            if (field.checkerSource) {
                return true;
            }
            return hasTypedefChecker(field.type, visiting);
        });
    }
    visiting.delete(type.name);
    typedefCheckerPresence.set(type.name, result);
    return result;
};

export const hasTypedefChecker = (typename: string, visiting: Set<string> = new Set()) => {
    const type = getTypedef(splitTypename(typename).base);
    if (!type) {
        return false;
    }
    return hasTypedefCheckerEntry(type, visiting);
};

export const hasTypedefWorkbook = (pathOrWorkbook: string | Workbook) => {
    const path = typeof pathOrWorkbook === "string" ? pathOrWorkbook : pathOrWorkbook.path;
    return (typedefWorkbookKeysByPath.get(path)?.size ?? 0) > 0;
};

export type TypeResolver = (typename: string) => { type: string; path?: string };

export class TypeImporter {
    private readonly _namedTypes: Record<string, Set<string>> = {};

    constructor(readonly resolver: TypeResolver) {}

    resolve(typename: string) {
        const ret = this.resolver(typename);
        const basic = ret.type.match(/^[a-zA-Z_][a-zA-Z0-9_]+/)?.[0] ?? "";
        if (ret.path && !basicTypes.includes(basic)) {
            this._namedTypes[ret.path] ||= new Set();
            this._namedTypes[ret.path].add(ret.type.replaceAll("[]", ""));
        }
        return ret;
    }

    toString() {
        const arr = Object.entries(this._namedTypes)
            .filter(([_, types]) => types.size > 0)
            .map(([path, types]) => ({ path, items: Array.from(types).sort() }));
        const buffer: string[] = [];
        for (const entry of arr) {
            buffer.push(`import {`);
            for (const typename of entry.items) {
                buffer.push(`    ${typename},`);
            }
            buffer.push(`} from "${entry.path}";`);
        }
        return buffer.join("\n");
    }
}

export const getTsRowTypeName = (workbookName: string, sheetName: string) => {
    return toPascalCase(`Generated_${workbookName}_${sheetName}_Row`);
};

const writeTsRowType = (
    typeBuffer: StringBuffer,
    workbook: Workbook,
    sheet: Sheet,
    typeImporter: TypeImporter
) => {
    const className = getTsRowTypeName(workbook.name, sheet.name);
    typeBuffer.writeLine(`export interface ${className} {`);
    typeBuffer.indent();
    for (const field of sheet.fields.filter((f) => !f.ignore)) {
        const checker = field.checkers.map((v) => v.source).join(";");
        const comment = field.comment.replaceAll(/[\r\n]+/g, " ");
        typeBuffer.writeLine(`/**`);
        typeBuffer.writeLine(
            ` * ${comment} (location: ${field.location}) (checker: ${checker || "x"})`
        );
        typeBuffer.writeLine(` */`);
        const resolved = resolveTsType(
            field.realtype ?? field.typename,
            emptyTypes,
            typeImporter,
            true
        );
        typeBuffer.padding();
        typeBuffer.writeString(`readonly ${field.name}${resolved.optional ? "?" : ""}: `);
        typeBuffer.writeString(`${resolved.type};`);
        typeBuffer.linefeed();
    }
    typeBuffer.unindent();
    typeBuffer.writeLine(`}`);
    typeBuffer.writeLine("");
};

export const genTsSheetType = (workbook: Workbook, sheet: Sheet, resolver: TypeResolver) => {
    const buffer = new StringBuffer(4);
    buffer.writeLine(`// AUTO GENERATED, DO NOT MODIFY!`);
    buffer.writeLine(`// file: ${workbook.path}#${sheet.name}`);
    buffer.writeLine("");

    const typeImporter = new TypeImporter(resolver);
    const typeBuffer = new StringBuffer(4);
    writeTsRowType(typeBuffer, workbook, sheet, typeImporter);

    const imports = typeImporter.toString();
    if (imports.length > 0) {
        buffer.writeLine(imports);
        buffer.writeLine("");
    }

    buffer.writeString(typeBuffer.toString());
    return buffer.toString();
};

export const genTsType = (workbook: Workbook, resolver: TypeResolver) => {
    const buffer = new StringBuffer(4);
    buffer.writeLine(`// AUTO GENERATED, DO NOT MODIFY!`);
    buffer.writeLine(`// file: ${workbook.path}`);
    buffer.writeLine("");

    const typeImporter = new TypeImporter(resolver);
    const sheets = workbook.sheets.filter((s) => !s.ignore);
    const typeBuffer = new StringBuffer(4);
    for (const sheet of sheets) {
        writeTsRowType(typeBuffer, workbook, sheet, typeImporter);
    }

    const imports = typeImporter.toString();
    if (imports.length > 0) {
        buffer.writeLine(imports);
        buffer.writeLine("");
    }

    buffer.writeString(typeBuffer.toString());

    return buffer.toString();
};

export const genLuaType = (workbook: Workbook, resolver: TypeResolver) => {
    const sheets = workbook.sheets.filter((s) => !s.ignore);
    const buffer = new StringBuffer(4);
    for (const sheet of sheets) {
        const className =
            `xlsx.${workbook.context.writer}.` + toPascalCase(`${workbook.name}_${sheet.name}`);
        buffer.writeLine(`---file: ${workbook.path}`);
        buffer.writeLine(`---@class ${className}`);
        for (const field of sheet.fields.filter((f) => !f.ignore)) {
            const comment = field.comment.replaceAll(/[\r\n]+/g, " ");
            const resolved = resolveLuaType(field.typename, emptyTypes, resolver, true);
            buffer.writeLine(
                `---@field ${field.name}${resolved.optional ? "?" : ""} ${resolved.type} ${comment}`
            );
        }
        buffer.writeLine("");
    }
    return buffer.toString();
};

const defaultTypeResolver: TypeResolver = (typename) => ({ type: typename });

const isTypedefWorkbook = (value: Workbook | TypedefWorkbook): value is TypedefWorkbook => {
    return "types" in value && "sheet" in value;
};

const resolveTypedefWorkbook = (value: Workbook | TypedefWorkbook) => {
    if (isTypedefWorkbook(value)) {
        return value;
    }
    return getTypedefWorkbook(value);
};

export const genTsTypedef = (
    workbook: Workbook | TypedefWorkbook,
    resolver: TypeResolver = defaultTypeResolver
) => {
    const typedefWorkbook = resolveTypedefWorkbook(workbook);
    if (!typedefWorkbook) {
        return "";
    }

    const importer = new TypeImporter(resolver);
    const localTypes = new Set(typedefWorkbook.types.map((type) => type.name));
    const buffer = new StringBuffer(4);
    const typeBuffer = new StringBuffer(4);

    buffer.writeLine(`// AUTO GENERATED, DO NOT MODIFY!`);
    buffer.writeLine(`// file: ${typedefWorkbook.path}`);
    buffer.writeLine("");

    for (const type of typedefWorkbook.types) {
        if (type.comment) {
            typeBuffer.writeLine(`/** ${type.comment} */`);
        }
        if (type.kind === "union") {
            const members = type.members.map((member) => {
                if (localTypes.has(member)) {
                    return member;
                }
                return importer.resolve(member).type;
            });
            typeBuffer.writeLine(`export type ${type.name} = ${members.join(" | ")};`);
            typeBuffer.writeLine("");
            continue;
        }

        typeBuffer.writeLine(`export interface ${type.name} {`);
        typeBuffer.indent();
        for (const field of type.fields) {
            if (field.comment) {
                typeBuffer.writeLine(`/** ${field.comment} */`);
            }
            const resolved = resolveTsType(field.type, localTypes, importer);
            typeBuffer.writeLine(`${field.name}${resolved.optional ? "?" : ""}: ${resolved.type};`);
        }
        typeBuffer.unindent();
        typeBuffer.writeLine(`}`);
        typeBuffer.writeLine("");
    }

    const imports = importer.toString();
    if (imports) {
        buffer.writeLine(imports);
        buffer.writeLine("");
    }
    buffer.writeString(typeBuffer.toString());
    return buffer.toString();
};

export const genLuaTypedef = (
    workbook: Workbook | TypedefWorkbook,
    resolver: TypeResolver = defaultTypeResolver
) => {
    const typedefWorkbook = resolveTypedefWorkbook(workbook);
    if (!typedefWorkbook) {
        return "";
    }

    const localTypes = new Set(typedefWorkbook.types.map((type) => type.name));
    const buffer = new StringBuffer(4);
    for (const type of typedefWorkbook.types) {
        buffer.writeLine(`---file: ${typedefWorkbook.path}`);
        if (type.comment) {
            buffer.writeLine(`---${type.comment}`);
        }
        if (type.kind === "union") {
            const members = type.members.map((member) => {
                if (localTypes.has(member)) {
                    return member;
                }
                return resolver(member).type;
            });
            buffer.writeLine(`---@alias ${type.name} ${members.join("|")}`);
            buffer.writeLine("");
            continue;
        }

        buffer.writeLine(`---@class ${type.name}`);
        for (const field of type.fields) {
            const resolved = resolveLuaType(field.type, localTypes, resolver);
            buffer.writeLine(
                `---@field ${field.name}${resolved.optional ? "?" : ""} ${resolved.type}` +
                    (field.comment ? ` ${field.comment}` : "")
            );
        }
        buffer.writeLine("");
    }
    return buffer.toString();
};

export const genXlsxType = (ctx: Context, resolver: TypeResolver) => {
    const buffer = new StringBuffer(4);
    buffer.writeLine(`// AUTO GENERATED, DO NOT MODIFY!\n`);

    const typeBuffer = new StringBuffer(4);
    const typeImporter = new TypeImporter(resolver);
    typeImporter.resolve("TCell");

    for (const workbook of ctx.workbooks) {
        for (const sheet of workbook.sheets) {
            const className = toPascalCase(`${workbook.name}_${sheet.name}_Row`);

            // row
            typeBuffer.writeLine(`// file: ${workbook.path}`);
            if (sheet.processors.length > 0) {
                typeBuffer.writeLine(`// processors:`);
                const processors = sheet.processors
                    .slice()
                    .sort((a, b) => a.name.localeCompare(b.name));
                for (const p of processors) {
                    typeBuffer.writeString(`//  - @${p.name}`);
                    if (p.args.length > 0) {
                        typeBuffer.writeString(`(${p.args.join(", ")})`);
                    }
                    typeBuffer.writeLine("");
                }
            }
            typeBuffer.writeLine(`export interface ${className} {`);
            typeBuffer.indent();
            for (const field of sheet.fields) {
                if (field.name.startsWith("-")) {
                    continue;
                }
                const checker = field.checkers.map((v) => v.source).join(";");
                const comment = field.comment.replaceAll(/[\r\n]+/g, " ");
                const where = `file: ${workbook.path}#${sheet.name}#${field.location}:${field.name}`;
                const resolved = resolveTsType(field.typename, emptyTypes, typeImporter);
                ensureRuntimeTypeSupported(field.typename, where);
                typeBuffer.writeLine(`/**`);
                typeBuffer.writeLine(
                    ` * ${comment} (location: ${field.location}) (type: ${field.typename}) ` +
                        `(checker: ${checker.replaceAll("@", "\\@") || "x"}) ` +
                        `(writer: ${field.writers.join("|")})`
                );
                typeBuffer.writeLine(` */`);
                typeBuffer.padding();
                typeBuffer.writeString(`${field.name}: { v${resolved.optional ? "?" : ""}: `);
                typeBuffer.writeString(`${resolved.type} } & TCell;`);
                typeBuffer.linefeed();
            }
            typeBuffer.unindent();
            typeBuffer.writeLine(`}`);
            typeBuffer.writeLine("");
        }
    }

    const imports = typeImporter.toString();
    if (imports.length > 0) {
        buffer.writeLine(imports);
        buffer.writeLine("");
    }

    buffer.writeLine(`type TCell = Omit<_TCell, "v">;`);
    buffer.writeLine("");
    buffer.writeLine(typeBuffer.toString());

    return buffer.toString();
};
