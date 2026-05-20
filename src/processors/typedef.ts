import { Processor } from "../core/contracts";
import { assert } from "../core/errors";
import { type Sheet, type TRow, Type } from "../core/schema";
import { checkType, toString } from "../core/value";
import { Workbook } from "../core/workbook";
import {
    registerTypedefConverters,
    registerTypedefWorkbook,
    TypedefField,
    TypedefObject,
    TypedefUnion,
    TypedefWorkbook,
} from "../typedef";
import { splitTypename } from "../typename";
import { values } from "../util";

type TypedefDraftField = {
    readonly name: string;
    readonly comment: string;
    readonly rawType: string;
    readonly checkerSource?: string;
    readonly checkerLocation?: string;
};

type TypedefDraftObject = {
    kind: "object";
    name: string;
    comment: string;
    fields: TypedefDraftField[];
};

type TypedefDraftUnion = {
    kind: "union";
    name: string;
    comment: string;
    discriminator: string;
    members: string[];
};

type TypedefDraft = TypedefDraftObject | TypedefDraftUnion;

const tryParseLiteral = (typename: string) => {
    if (!typename.startsWith("#")) {
        return null;
    }
    const raw = typename.slice(1).trim();
    if (raw.match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/)) {
        return Number(raw);
    }
    return raw;
};

const resolveTypedefType = (rawType: string) => {
    const meta = splitTypename(rawType);
    if (meta.base.startsWith("#")) {
        assert(
            meta.array.length === 0 && !meta.optional,
            `Literal typedef field '${rawType}' is not allowed to use array or optional suffix`
        );
    }
    return rawType;
};

export const typedefSheet = (workbook: Workbook, sheet: Sheet): TypedefWorkbook => {
    checkType(sheet.data, Type.Sheet);

    for (const key of ["comment", "key1", "key2", "value_type", "value_comment"]) {
        assert(
            sheet.fields.some((field) => field.name === key),
            `Typedef field '${key}' is required in ${workbook.path}#${sheet.name}`
        );
    }

    const drafts = new Map<string, TypedefDraft>();
    const order: string[] = [];

    for (const row of values<TRow>(sheet.data)) {
        const key1 = toString(row["key1"]).trim();
        if (!key1) {
            continue;
        }

        const comment = toString(row["comment"]).trim();
        const key2 = toString(row["key2"]).trim();
        const valueType = toString(row["value_type"]).trim();
        const valueComment = toString(row["value_comment"]).trim();
        const valueChecker = toString(row["value_checker"]).trim();

        if (!drafts.has(key1)) {
            order.push(key1);
        }

        if (key2.includes("|")) {
            const members = key2
                .split("|")
                .map((member) => member.trim())
                .filter((member) => member);
            assert(members.length > 0, `Typedef union '${key1}' has no members`);
            assert(valueType, `Typedef union '${key1}' is missing discriminator`);

            const previous = drafts.get(key1);
            assert(
                !previous || previous.kind === "union",
                `Typedef '${key1}' cannot mix object fields and union members`
            );

            if (!previous) {
                drafts.set(key1, {
                    kind: "union",
                    name: key1,
                    comment,
                    discriminator: valueType,
                    members,
                });
            } else {
                const unionDraft = previous as TypedefDraftUnion;
                assert(
                    unionDraft.discriminator === valueType,
                    `Typedef union '${key1}' discriminator mismatch: ` +
                        `'${unionDraft.discriminator}' !== '${valueType}'`
                );
                unionDraft.members = members;
                if (comment && !unionDraft.comment) {
                    unionDraft.comment = comment;
                }
            }
            continue;
        }

        assert(key2, `Typedef '${key1}' field name is required`);
        assert(valueType, `Typedef '${key1}.${key2}' field type is required`);

        const previous = drafts.get(key1);
        assert(
            !previous || previous.kind === "object",
            `Typedef '${key1}' cannot mix union members and object fields`
        );

        const draft =
            previous ??
            ({
                kind: "object",
                name: key1,
                comment,
                fields: [],
            } satisfies TypedefDraftObject);
        const objectDraft = draft as TypedefDraftObject;
        if (!previous) {
            drafts.set(key1, objectDraft);
        } else if (comment && !objectDraft.comment) {
            objectDraft.comment = comment;
        }
        assert(
            !objectDraft.fields.some((field) => field.name === key2),
            `Typedef '${key1}' has duplicate field '${key2}'`
        );
        objectDraft.fields.push({
            name: key2,
            comment: valueComment,
            rawType: valueType,
            checkerSource: valueChecker || undefined,
            checkerLocation: valueChecker ? row["value_checker"]?.r : undefined,
        });
    }

    const types = order.map((name) => {
        const draft = drafts.get(name)!;
        if (draft.kind === "union") {
            return {
                kind: "union",
                name: draft.name,
                comment: draft.comment,
                discriminator: draft.discriminator,
                members: draft.members.slice(),
            } satisfies TypedefUnion;
        }
        return {
            kind: "object",
            name: draft.name,
            comment: draft.comment,
            fields: draft.fields.map((field) => {
                const type = resolveTypedefType(field.rawType);
                return {
                    name: field.name,
                    comment: field.comment,
                    rawType: field.rawType,
                    type,
                    literal: tryParseLiteral(type) ?? undefined,
                    checkerSource: field.checkerSource,
                    checkerLocation: field.checkerLocation,
                } satisfies TypedefField;
            }),
        } satisfies TypedefObject;
    });

    return {
        path: workbook.path,
        sheet: sheet.name,
        types,
    };
};

export const TypedefProcessor: Processor = async (workbook, sheet) => {
    const typedefWorkbook = typedefSheet(workbook, sheet);
    registerTypedefWorkbook(typedefWorkbook);
    registerTypedefConverters(typedefWorkbook);
    if (!sheet.processors.some((processor) => processor.name === "typedef-write")) {
        sheet.processors.push({
            name: "typedef-write",
            args: [],
        });
    }
    sheet.data = {};
    sheet.ignore = true;
};
