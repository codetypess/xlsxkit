import { Processor } from "../core/contracts";
import { assert } from "../core/errors";
import { type TObject } from "../core/schema";
import { Workbook } from "../core/workbook";
import { output } from "../io";
import { keys } from "../util";

export type StringifyRule = (workbook: Workbook) => object;

const stringifyRules: Record<string, StringifyRule> = {};

export const registerStringifyRule = (name: string, rule: StringifyRule) => {
    assert(!stringifyRules[name], `Stringify rule '${name}' already registered`);
    stringifyRules[name] = rule;
};

export const getStringifyRule = (name?: string) => {
    return stringifyRules[name ?? "simple"];
};

export const mergeSheets = (workbook: Workbook, sheetNames?: string[]) => {
    const result: TObject = {};
    for (const sheet of workbook.sheets) {
        if (!sheetNames || sheetNames.includes(sheet.name)) {
            for (const key of keys(sheet.data)) {
                const row = sheet.data[key];
                if (result[key]) {
                    throw new Error(`Duplicate key: ${key}`);
                }
                result[key] = row;
            }
        }
    }
    return result;
};

export const simpleSheets = (workbook: Workbook, sheetNames?: string[]) => {
    const result: TObject = {};
    for (const sheet of workbook.sheets) {
        if (!sheetNames || sheetNames.includes(sheet.name)) {
            result[sheet.name] = sheet.data;
        }
    }
    return result;
};

export const StringifyProcessor: Processor = async (workbook, sheet, ruleName) => {
    const rule = getStringifyRule(ruleName);
    if (!rule) {
        throw new Error(`Stringify rule not found: ${ruleName}`);
    }
    const data = rule(workbook);
    output(workbook, "stringify", data);
};
