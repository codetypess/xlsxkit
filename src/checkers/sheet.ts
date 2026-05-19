import { CheckerParser } from "../core/contracts";
import { parseIndexerAst } from "./shared";

export const SheetCheckerParser: CheckerParser = (
    ctx,
    rowFile,
    rowSheet,
    rowKey,
    rowFilter,
    file
) => {
    const ast = parseIndexerAst(
        ctx,
        { file: rowFile, sheet: rowSheet, key: rowKey, filter: rowFilter },
        { file: file, sheet: "", key: "", filter: "" }
    );
    const path = file.replace(/\.xlsx$/, "") + ".xlsx";
    const target = ctx.get(path);
    return ({ cell, errors }) => {
        return ast.value.resolve(cell.v, errors, (value) => {
            const sheet = target.get(value as string);
            return sheet !== undefined;
        });
    };
};
