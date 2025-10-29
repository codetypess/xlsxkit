import { basename } from "path";
import * as xlsx from "../..";

let done = false;

const genDesignIndexer = (ctx: xlsx.Context) => {
    const typeBuffer = new xlsx.StringBuffer(4);

    const filter: Record<string, boolean> = {};

    const types: Set<string> = new Set();
    for (const workbook of ctx.workbooks) {
        const name = xlsx.basename(workbook.path);

        if (filter[name]) {
            continue;
        }
        filter[name] = true;

        const fileClassName = xlsx.toPascalCase(`${name}_indexer`);
        const sheets: string[] = [];
        const sheetClasses: string[] = [];
        const rowIndexerBuffer = new xlsx.StringBuffer(4);
        const colIndexerBuffer = new xlsx.StringBuffer(4);
        for (const sheet of workbook.sheets) {
            const className = xlsx.toPascalCase(`${name}_${sheet.name}_row`);
            types.add(className);
            sheets.push(sheet.name);
            sheetClasses.push(className);
            rowIndexerBuffer.writeLine(
                xlsx.format(
                    `static getRowIndexer(ctx: Context, sheet: %{sheet}, filter?: %{filter}): %{ret};`,
                    {
                        sheet: `"${sheet.name}"`,
                        filter: `Filter<${className}>`,
                        ret: `RowIndexer<${className}>`,
                    }
                )
            );
            colIndexerBuffer.writeLine(
                xlsx.format(
                    `static getColumnIndexer(ctx: Context, sheet: %{sheet}, field: %{field}, filter?: %{filter}): %{ret};`,
                    {
                        sheet: `"${sheet.name}"`,
                        field: `keyof ${className}`,
                        filter: `Filter<${className}>`,
                        ret: `ColumnIndexer<${className}>`,
                    }
                )
            );
        }
        rowIndexerBuffer.writeLines(
            xlsx.format(
                `
                static getRowIndexer(ctx: Context, sheet: %{sheets}, filter?: %{filters}): unknown {
                    return createRowIndexer(ctx, "${basename(workbook.path)}", sheet, filter as Filter<unknown>);
                }`,
                {
                    sheets: sheets.map((v) => `"${v}"`).join(" | "),
                    filters: sheetClasses.map((v) => `Filter<${v}>`).join(" | "),
                }
            )
        );
        colIndexerBuffer.writeLines(
            xlsx.format(
                `
                static getColumnIndexer(ctx: Context, sheet: %{sheets}, field: %{fields}, filter?: %{filters}): unknown {
                    return createColumnIndexer(ctx, "${basename(workbook.path)}", sheet, field, filter as Filter<unknown>);
                }`,
                {
                    sheets: sheets.map((v) => `"${v}"`).join(" | "),
                    filters: sheetClasses.map((v) => `Filter<${v}>`).join(" | "),
                    fields: "string",
                }
            )
        );

        typeBuffer.writeLine(`// file: ${workbook.path}`);
        typeBuffer.writeLine(`export class ${fileClassName} {`);
        typeBuffer.indent();
        typeBuffer.writeLines(rowIndexerBuffer.toString());
        typeBuffer.writeLines(colIndexerBuffer.toString());
        typeBuffer.unindent();
        typeBuffer.writeLine("}\n");
    }

    const buffer = new xlsx.StringBuffer(4);
    buffer.writeLine(
        xlsx.format(
            `
            // AUTO GENERATED, DO NOT MODIFY!

            import { ColumnIndexer, RowIndexer, Context } from "../../";
            import {
                %{types}
            } from "./workbook-typedef";

            type Filter<T> = (row: T) => boolean;

            const cacheRowIndexers = new Map<string, RowIndexer<unknown>>();
            const cacheColumnIndexers = new Map<string, ColumnIndexer<unknown>>();

            const createRowIndexer = <T>(
                ctx: Context,
                path: string,
                sheet: string,
                filter?: Filter<unknown>
            ) => {
                if (filter) {
                    return new RowIndexer(ctx, path, sheet, filter);
                } else {
                    const key = \`\${ctx.writer}:\${ctx.tag}:\${path}:\${sheet}\`;
                    let indexer = cacheRowIndexers.get(key);
                    if (!indexer) {
                        indexer = new RowIndexer(ctx, path, sheet);
                        cacheRowIndexers.set(key, indexer as RowIndexer<unknown>);
                    }
                    return indexer as RowIndexer<T>;
                }
            };

            const createColumnIndexer = <T>(
                ctx: Context,
                path: string,
                sheet: string,
                field: string,
                filter?: Filter<unknown>
            ) => {
                if (filter) {
                    return new ColumnIndexer(ctx, path, sheet, field, filter);
                } else {
                    const key = \`\${ctx.writer}:\${ctx.tag}:\${path}:\${sheet}:\${field}\`;
                    let indexer = cacheColumnIndexers.get(key);
                    if (!indexer) {
                        indexer = new ColumnIndexer(ctx, path, sheet, field);
                        cacheColumnIndexers.set(key, indexer as ColumnIndexer<unknown>);
                    }
                    return indexer as ColumnIndexer<T>;
                }
            };

            `,
            {
                types: Array.from(types)
                    .map((v) => `${v},`)
                    .join("\n"),
            }
        )
    );
    buffer.writeLines(typeBuffer.toString());
    xlsx.writeFile("test/output/workbook-indexer.ts", buffer.toString());
};

xlsx.registerProcessor(
    "workbook-indexer",
    async (workbook) => {
        if (done) {
            return;
        }
        done = true;
        genDesignIndexer(workbook.context);
    },
    {
        required: true,
        stage: "pre-parse",
    }
);
