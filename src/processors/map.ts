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

export const mapSheet = (workbook: Workbook, sheet: Sheet, value: string, ...keys: string[]) => {
    checkType(sheet.data, Type.Sheet);

    const queryValue = (() => {
        if (value === "*") {
            return (row: TRow) => row;
        } else if (value.startsWith(".")) {
            return (row: TRow) => row[value.slice(1)];
        } else if (
            (value.startsWith("{") && value.endsWith("}")) ||
            (value.startsWith("[") && value.endsWith("]"))
        ) {
            const isObject = value.startsWith("{");
            const ks = value
                .slice(1, -1)
                .split(",")
                .map((key) => key.trim());
            return (row: TRow) => {
                const result: TObject | TArray = isObject ? {} : [];
                for (const key of ks) {
                    const cell = row[key];
                    if (!cell) {
                        throw new Error(
                            `${workbook.context.tag} ${workbook.name}.${sheet.name} Key '${key}' is not found`
                        );
                    }
                    if (isObject) {
                        (result as TObject)[key] = cell;
                    } else {
                        (result as TArray).push(cell);
                    }
                }
                return result;
            };
        } else {
            throw new Error(
                `${workbook.context.tag} ${workbook.name}.${sheet.name} Invalid value query: ${value}`
            );
        }
    })();

    const result: { [key: string]: TValue } = {};
    const rows = values<TObject>(sheet.data).map((entry) => checkType<TRow>(entry, Type.Row));
    for (const row of rows) {
        let target = result;
        for (let i = 0; i < keys.length; i++) {
            const key = (row[keys[i]]?.v ?? "") as string;
            if (key === "") {
                throw new Error(
                    `${workbook.context.tag} ${workbook.name}.${sheet.name} Key '${keys[i]}' is not found`
                );
            }
            if (i === keys.length - 1) {
                target[key] = queryValue(row);
            } else {
                if (!target[key]) {
                    target[key] = {};
                }
                target = target[key] as TObject;
            }
        }
    }
    return result;
};

export const MapProcessor: Processor = async (workbook, sheet, value, ...ks) => {
    sheet.data = mapSheet(workbook, sheet, value, ...ks);
};
