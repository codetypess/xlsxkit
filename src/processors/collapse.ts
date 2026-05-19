import { Processor } from "../core/contracts";
import {
    type Sheet,
    type TArray,
    type TObject,
    type TRow,
    type TValue,
    Type,
} from "../core/schema";
import { checkType } from "../core/value";
import { Workbook } from "../core/workbook";
import { values } from "../util";

export const collapseSheet = (workbook: Workbook, sheet: Sheet, ...keys: string[]) => {
    checkType(sheet.data, Type.Sheet);
    const result: { [key: string]: TValue } = {};
    const rows = values<TObject>(sheet.data).map((value) => checkType<TRow>(value, Type.Row));
    for (const row of rows) {
        let target = result;
        for (let i = 0; i < keys.length; i++) {
            const key = (row[keys[i]]?.v ?? "") as string;
            if (key === "") {
                throw new Error(`Key '${keys[i]}' is not found`);
            }

            if (!target[key]) {
                target[key] = i === keys.length - 1 ? [] : {};
            }
            target = target[key] as TObject;
            if (i === keys.length - 1) {
                (target as unknown as TArray).push(row);
            }
        }
    }
    return result;
};

export const CollapseProcessor: Processor = async (workbook, sheet, ...ks) => {
    sheet.data = collapseSheet(workbook, sheet, ...ks);
};
