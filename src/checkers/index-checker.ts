import { CheckerParser } from "../core/contracts";
import { type TCell } from "../core/schema";
import { ColumnIndexer, RowFilter } from "../indexer";
import { parseIndexerAst, resolveFilterValue } from "./shared";

export const IndexCheckerParser: CheckerParser = (
    ctx,
    rowFile,
    rowSheet,
    rowKey,
    rowFilter,
    colFile,
    colSheet,
    colKey,
    colFilter
) => {
    const ast = parseIndexerAst(
        ctx,
        {
            file: rowFile,
            sheet: rowSheet,
            key: rowKey,
            filter: rowFilter,
        },
        {
            file: colFile,
            sheet: colSheet,
            key: colKey,
            filter: colFilter,
        }
    );
    const filter: RowFilter[] = ast.target.filter.map((entry) => {
        return { key: entry.key, value: "" };
    });

    const indexer = new ColumnIndexer(ctx, colFile, colSheet, ast.target.key);

    return ({ cell, row, field, errors, workbook, sheet }) => {
        if (cell.v === null || cell.v === undefined) {
            throw new Error(`Invalid value at ${cell.r} in ${workbook.path}#${sheet.name}`);
        }

        if (ast.value.filter.length > 0) {
            for (const entry of ast.value.filter) {
                const rowCell = row[entry.key] as TCell | undefined;
                if (!rowCell) {
                    throw new Error(
                        `field '${entry.key}' not found in ${workbook.path}#${sheet.name}`
                    );
                }
                const value = resolveFilterValue(entry, row, cell.v, errors);
                if (value === undefined) {
                    return false;
                }
                if (rowCell.v !== value) {
                    return true;
                }
            }
        }

        return ast.value.resolve(cell.v, errors, (value) => {
            if (ast.target.filter.length === 0) {
                return indexer.has(value);
            }

            let i = 0;
            for (const entry of ast.target.filter) {
                const filterValue = resolveFilterValue(entry, row, cell.v, errors);
                if (filterValue === undefined) {
                    return false;
                }
                filter[i++].value = filterValue;
            }

            return indexer.has(value, filter);
        });
    };
};
