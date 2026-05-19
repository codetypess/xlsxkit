import { CheckerParser } from "../core/contracts";
import { type TCell } from "../core/schema";
import { ColumnIndexer } from "../indexer";

export const UniqueCheckerParser: CheckerParser = (ctx, arg) => {
    let columnIndex: ColumnIndexer | undefined;
    return ({ cell, row, field, errors, workbook, sheet }) => {
        if (!columnIndex) {
            columnIndex = new ColumnIndexer(ctx, workbook.path, sheet.name, field.name);
        }
        if (typeof cell.v !== "string" && typeof cell.v !== "number") {
            errors.push(`data type error: type=${typeof cell.v}`);
            return false;
        }
        const arr = columnIndex.get(cell.v);
        if (arr.length > 1) {
            for (const item of arr) {
                const otherCell = item[field.name] as TCell;
                if (item[field.name] !== cell) {
                    errors.push(`unique error: location=${otherCell.r}`);
                }
            }
            return false;
        } else {
            return true;
        }
    };
};
