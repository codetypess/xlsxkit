import { Processor } from "../core/contracts";
import { trace } from "../core/errors";
import { converters, registerChecker, registerType } from "../core/registry";
import { type TRow, type TValue } from "../core/schema";
import { keys, values } from "../util";
import { resolveDefineType } from "./define";

export const AutoRegisterProcessor: Processor = async (workbook) => {
    for (const sheet of workbook.sheets) {
        if (!sheet.processors.find((p) => p.name === "define")) {
            continue;
        }
        for (const row of values<TRow>(sheet.data)) {
            const enumName = row["enum"]?.v as string;
            const key1 = row["key1"]?.v as string;
            const key2 = row["key2"]?.v as string;
            const value = row["value"]?.v as string;
            const value_type = row["value_type"]?.v as string;
            if (enumName && key1 && key2 && value !== undefined && value_type) {
                using _ = trace(
                    `Registering type '${enumName}' in '${workbook.path}#${sheet.name}'`
                );
                const typeKeys: Record<string, TValue> = resolveDefineType(
                    workbook,
                    workbook.path,
                    sheet.name,
                    key1
                );
                const typeValues: Record<string, string> = keys(typeKeys).reduce(
                    (acc, key) => {
                        acc[String(typeKeys[key])] = key;
                        return acc;
                    },
                    {} as Record<string, string>
                );

                if (!converters[enumName]) {
                    registerType(enumName, (str) => typeKeys[str]);
                    registerChecker(enumName, () => {
                        return ({ cell }) => typeValues[cell.v as string] !== undefined;
                    });
                }
            }
        }
    }
};
