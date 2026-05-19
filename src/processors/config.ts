import { Processor } from "../core/contracts";
import { convertValue } from "../core/conversion";
import { assert, error } from "../core/errors";
import { type Sheet, type TCell, type TObject, type TRow, Type } from "../core/schema";
import { checkType } from "../core/value";
import { Workbook } from "../core/workbook";
import { values } from "../util";

export const configSheet = (
    workbook: Workbook,
    sheet: Sheet,
    nameKey = "key",
    valueKey = "value",
    typeKey = "value_type",
    commentKey = "value_comment"
) => {
    checkType(sheet.data, Type.Sheet);

    const result: TObject = {};
    result["!name"] = `${workbook.name}.${sheet.name}`;
    result["!type"] = Type.Config;
    const rows = values<TObject>(sheet.data).map((value) => checkType<TRow>(value, Type.Row));
    for (const row of rows) {
        assert(row[nameKey]?.v !== undefined, `Key '${nameKey}' is not found`);
        assert(row[valueKey]?.v !== undefined, `Value '${valueKey}' is not found`);
        assert(row[typeKey]?.v !== undefined, `Type '${typeKey}' is not found`);
        assert(row[commentKey]?.v !== undefined, `Comment '${commentKey}' is not found`);
        const key = row[nameKey].v as string;
        const typename = row[typeKey].v as string;
        assert(!typename.endsWith("?"), `Type '${typename}' is not valid`);
        const value = convertValue(row[valueKey], typename);
        value["!comment"] = row[commentKey].v as string;
        if (result[key] !== undefined) {
            const last = result[key] as TCell;
            error(
                `Key '${key}' is already defined, last defined at ${last.r}, current at ${value.r}`
            );
        }
        result[key] = value;
    }
    return result;
};

export const ConfigProcessor: Processor = async (workbook, sheet) => {
    const data = configSheet(workbook, sheet);
    sheet.data = data;
    sheet.ignore = true;
};
