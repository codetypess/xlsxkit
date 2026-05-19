import { Processor } from "../core/contracts";
import { convertValue } from "../core/conversion";
import { assert } from "../core/errors";
import { type Sheet, type TObject, type TRow, Type } from "../core/schema";
import { checkType, toString } from "../core/value";
import { Workbook } from "../core/workbook";
import { RowIndexer } from "../indexer";
import { output } from "../io";
import { values } from "../util";

export const defineSheet = (workbook: Workbook, sheet: Sheet) => {
    checkType(sheet.data, Type.Sheet);

    const config: TObject = {};

    config["!name"] = `${workbook.name}.${sheet.name}`;
    config["!type"] = Type.Define;

    const rows = values<TObject>(sheet.data).map((value) => checkType<TRow>(value, Type.Row));
    for (const row of rows) {
        const typename = row["value_type"].v as string;
        assert(!typename.endsWith("?"), `Type '${typename}' is not valid`);
        const value = convertValue(row["value"], typename);

        if (!row["key1"] && row["key"]) {
            row["key1"] = row["key"];
        }

        let target = config;
        for (let n = 1; n <= 10; n++) {
            const key = toString(row[`key${n}`]);
            if (key) {
                const nextKey = toString(row[`key${n + 1}`]);
                if (nextKey) {
                    target[key] ||= {};
                    target = target[key] as TObject;
                } else {
                    if (target[key]) {
                        throw new Error(`Key '${key}' is already defined`);
                    }
                    target[key] = value;
                    if (row["value_comment"]?.v) {
                        value["!comment"] = toString(row["value_comment"]);
                    } else if (n === 1 && row["comment"]?.v) {
                        value["!comment"] = toString(row["comment"]);
                    }
                }
            } else {
                if (!target["!enum"]) {
                    const enumName = toString(row["enum"]);
                    if (enumName) {
                        target["!enum"] = enumName;
                    }
                }
                if (!target["!comment"]) {
                    const comment = toString(row["comment"]);
                    if (comment) {
                        target["!comment"] = comment;
                    }
                }
                break;
            }
        }
    }

    return config;
};

export const resolveDefineType = <T>(
    workbook: Workbook,
    path: string,
    sheetName: string,
    typeValue: string,
    typeKey: string = "key1",
    fieldKey: string = "key2"
) => {
    const types: Record<string, T> = {};
    const indexer = new RowIndexer<TRow>(workbook.context, path, sheetName);
    for (const row of indexer.rows) {
        const key1 = row[typeKey];
        const key2 = row[fieldKey];
        const value = row["value"];
        const type = row["value_type"];
        if (key1.v === typeValue) {
            types[String(key2.v)] = convertValue(value, type.v as string).v as T;
        }
    }
    return types;
};

export const DefineProcessor: Processor = async (workbook, sheet) => {
    const data = defineSheet(workbook, sheet);
    output(workbook, "define", data);
    sheet.data = {};
    sheet.ignore = true;
};
