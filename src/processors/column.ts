import { Processor } from "../core/contracts";
import { type Sheet, type TArray, type TObject, type TRow, Type } from "../core/schema";
import { checkType, isNotNull } from "../core/value";
import { Workbook } from "../core/workbook";
import { values } from "../util";

export const columnSheet = (
    workbook: Workbook,
    sheet: Sheet,
    idxKey: string,
    ...foldKeys: string[]
) => {
    checkType(sheet.data, Type.Sheet);

    const rows = values<TObject>(sheet.data).map((value) => checkType<TRow>(value, Type.Row));

    const result: { [key: string]: TObject } = {};
    for (const row of rows) {
        const idx = (row[idxKey]?.v ?? "") as string;
        if (idx === "") {
            throw new Error(`Key '${idxKey}' is not found`);
        }
        let entry = result[idx];
        if (!entry) {
            result[idx] = { ...row };
            entry = result[idx];
            delete entry[sheet.fields[0].name];
            for (const key of foldKeys) {
                entry[key] = [];
            }
        }
        for (const key of foldKeys) {
            const value = row[key];
            if (isNotNull(value)) {
                (entry[key] as TArray).push(value);
            }
        }
    }

    for (const field of sheet.fields) {
        if (foldKeys.includes(field.name)) {
            field.realtype = field.typename.replaceAll("?", "") + "[]";
        }
    }

    return result;
};

export const ColumnProcessor: Processor = async (workbook, sheet, idxKey, ...foldKeys) => {
    sheet.data = columnSheet(workbook, sheet, idxKey, ...foldKeys);
};
