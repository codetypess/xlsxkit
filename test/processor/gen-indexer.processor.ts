import { basename } from "path";
import * as xlsx from "../..";

let done = false;

const genDesignIndexer = () => {
    const typeBuffer = new xlsx.StringBuffer(4);

    const types: Set<string> = new Set();
    const files = xlsx.getWorkbooks();
    for (const path of Object.keys(files).sort()) {
        const workbook = files[path];
        const name = xlsx.filename(path);
        const fileClassName = xlsx.toPascalCase(`${name}_indexer`);
        const sheets: string[] = [];
        const sheetClasses: string[] = [];
        const rowIndexerBuffer = new xlsx.StringBuffer(4);
        const colIndexerBuffer = new xlsx.StringBuffer(4);
        for (const k of Object.keys(workbook.sheets).sort()) {
            const sheet = workbook.sheets[k];
            const className = xlsx.toPascalCase(`${name}_${sheet.name}`);
            types.add(className);
            sheets.push(sheet.name);
            sheetClasses.push(className);
            rowIndexerBuffer.writeLine(
                xlsx.format(
                    `static createRowIndexer(sheet: %{sheet}, filter?: %{filter}): %{ret};`,
                    {
                        sheet: `"${sheet.name}"`,
                        filter: `Filter<${className}>`,
                        ret: `RowIndexer<${className}>`,
                    }
                )
            );
            colIndexerBuffer.writeLine(
                xlsx.format(
                    `static createColumnIndexer(sheet: %{sheet}, field: %{field}, filter?: %{filter}): %{ret};`,
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
                static createRowIndexer(sheet: %{sheets}, filter?: %{filters}): unknown {
                    return new RowIndexer("${basename(path)}", sheet, filter as Filter<${sheetClasses.join(" | ")}>);
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
                static createColumnIndexer(sheet: %{sheets}, field: %{fields}, filter?: %{filters}): unknown {
                    return new ColumnIndexer("${basename(path)}", sheet, field, filter as Filter<${sheetClasses.join(" | ")}>);
                }`,
                {
                    sheets: sheets.map((v) => `"${v}"`).join(" | "),
                    filters: sheetClasses.map((v) => `Filter<${v}>`).join(" | "),
                    fields: "string",
                }
            )
        );

        typeBuffer.writeLine(`// file: ${path}`);
        typeBuffer.writeLine(`export class ${fileClassName} {`);
        typeBuffer.indent();
        typeBuffer.writeLines(rowIndexerBuffer.toString());
        typeBuffer.writeLines(colIndexerBuffer.toString());
        typeBuffer.unindent();
        typeBuffer.writeLine("}\n");
    }

    const buffer = new xlsx.StringBuffer(4);
    buffer.writeLine(`// AUTO GENERATED, DO NOT MODIFY!\n`);
    buffer.writeLine(`import { ColumnIndexer, RowIndexer } from "../..";`);
    buffer.writeLine("import {");
    for (const type of types) {
        buffer.writeLine(`    ${type},`);
    }
    buffer.writeLine(`} from "./workbook-typedef";\n`);
    buffer.writeLine("type Filter<T> = (row: T) => boolean;\n");
    buffer.writeLines(typeBuffer.toString());
    xlsx.writeFile("test/output/workbook-indexer.ts", buffer.toString());
};

xlsx.registerProcessor(
    "workbook-indexer",
    async () => {
        if (done) {
            return;
        }
        done = true;
        genDesignIndexer();
    },
    {
        required: true,
        stage: "pre-parse",
    }
);
