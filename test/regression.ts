import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import * as xlsx from "../index.js";
import {
    ExprCheckerParser,
    IndexCheckerParser,
    SheetCheckerParser,
} from "../src/builtins/checkers.js";
import { mergeTypeFile } from "../src/tooling/validate.js";

const makeField = (name: string) => {
    return {
        index: 0,
        name,
        typename: "string",
        writers: [],
        checkers: [],
        comment: "",
        location: "A1",
        ignore: false,
    };
};

const makeSheet = (name: string, fields: string[]) => {
    const data: xlsx.TObject = {};
    data["!type"] = xlsx.Type.Sheet;
    data["!name"] = name;
    return {
        name,
        ignore: false,
        processors: [],
        fields: fields.map(makeField),
        data,
    } satisfies xlsx.Sheet;
};

const makeRow = (cells: Record<string, xlsx.TCell>) => {
    return {
        "!type": xlsx.Type.Row,
        ...cells,
    } as xlsx.TRow;
};

export const runRegressionTests = async () => {
    await xlsx.parse(["test/res/item.xlsx"], true);
    await xlsx.parse(["test/res/item.xlsx"], true);

    {
        const ctx = new xlsx.Context("test-sheet-checker", "regression-sheet-checker");
        const sourceWorkbook = new xlsx.Workbook(ctx, "src.xlsx");
        const targetWorkbook = new xlsx.Workbook(ctx, "ref.xlsx");
        const sourceSheet = makeSheet("main", ["id"]);
        const targetSheet = makeSheet("existing", ["id"]);
        ctx.add(sourceWorkbook);
        ctx.add(targetWorkbook);
        sourceWorkbook.add(sourceSheet);
        targetWorkbook.add(targetSheet);

        const checker = SheetCheckerParser(ctx, "src.xlsx", "main", "", "", "ref.xlsx");
        const errors: string[] = [];
        const ok = checker({
            workbook: sourceWorkbook,
            sheet: sourceSheet,
            field: sourceSheet.fields[0],
            row: makeRow({}),
            cell: xlsx.makeCell("missing", "string", "A1", "missing"),
            errors,
        });

        assert.equal(ok, false);
        assert.deepEqual(errors, ["missing"]);
        xlsx.removeContext(ctx);
    }

    {
        const ctx = new xlsx.Context("test-index-checker", "regression-index-checker");
        const targetWorkbook = new xlsx.Workbook(ctx, "target.xlsx");
        const sourceWorkbook = new xlsx.Workbook(ctx, "source.xlsx");

        const targetSheet = makeSheet("main", ["id", "kind"]);
        const sourceSheet = makeSheet("main", ["id", "kind"]);

        const targetRow = makeRow({
            id: xlsx.makeCell(1, "int", "A1", "1"),
            kind: xlsx.makeCell("A", "string", "B1", "A"),
        });
        targetSheet.data["1"] = targetRow;

        ctx.add(targetWorkbook);
        ctx.add(sourceWorkbook);
        targetWorkbook.add(targetSheet);
        sourceWorkbook.add(sourceSheet);

        const checker = IndexCheckerParser(
            ctx,
            "source.xlsx",
            "main",
            "",
            "",
            "target.xlsx",
            "main",
            "id",
            "kind=@kind"
        );

        const firstErrors: string[] = [];
        const firstOk = checker({
            workbook: sourceWorkbook,
            sheet: sourceSheet,
            field: sourceSheet.fields[0],
            row: makeRow({
                id: xlsx.makeCell(1, "int", "A1", "1"),
                kind: xlsx.makeCell("A", "string", "B1", "A"),
            }),
            cell: xlsx.makeCell(1, "int", "A1", "1"),
            errors: firstErrors,
        });
        assert.equal(firstOk, true);
        assert.deepEqual(firstErrors, []);

        const secondErrors: string[] = [];
        const secondOk = checker({
            workbook: sourceWorkbook,
            sheet: sourceSheet,
            field: sourceSheet.fields[0],
            row: makeRow({
                id: xlsx.makeCell(1, "int", "A2", "1"),
                kind: xlsx.makeCell(null, "string?", "B2", ""),
            }),
            cell: xlsx.makeCell(1, "int", "A2", "1"),
            errors: secondErrors,
        });
        assert.equal(secondOk, false);
        assert.ok(secondErrors.includes("not found kind in row"));

        xlsx.removeContext(ctx);
    }

    {
        const checker = ExprCheckerParser(
            {} as xlsx.Context,
            "$.length == arr1.length && $[0] > min && enabled == true"
        );
        const errors: string[] = [];
        const ok = checker({
            workbook: {} as xlsx.Workbook,
            sheet: {} as xlsx.Sheet,
            field: makeField("arr2"),
            row: makeRow({
                arr1: xlsx.makeCell([1, 2], "int[]", "A1", "[1,2]"),
                min: xlsx.makeCell(0, "int", "B1", "0"),
                enabled: xlsx.makeCell(true, "bool", "C1", "true"),
            }),
            cell: xlsx.makeCell([2, 3], "int[]", "D1", "[2,3]"),
            errors,
        });
        assert.equal(ok, true);
        assert.deepEqual(errors, []);

        assert.throws(
            () =>
                ExprCheckerParser(
                    {} as xlsx.Context,
                    'constructor.constructor("return process")()'
                ),
            /Unexpected token|Invalid token/
        );
    }

    {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), "xlsx-regression-"));
        const autoPath = path.join(dir, "auto.ts");
        const mergedPath = path.join(dir, "merged.ts");

        fs.writeFileSync(
            autoPath,
            `import { BarType, FooType } from "../define/index";

export interface GeneratedDemoRow {
    /**
     * auto comment
     */
    readonly id: number;
    /**
     * auto args
     */
    readonly args: Record<string, number>;
    /**
     * auto optional
     */
    readonly optional?: FooType;
}
`
        );

        fs.writeFileSync(
            mergedPath,
            `import type { ExtraType } from "./extra";
import { FooType } from "../define/index";

type LocalAlias =
    | "a"
    | "b";

export interface GeneratedDemoRow {
    readonly id: number;
    readonly args: Record<string, number | string>; // override
}

export interface CustomExtra {
    readonly extra: ExtraType;
    readonly local: LocalAlias;
}
`
        );

        mergeTypeFile(autoPath, mergedPath);
        const merged = fs.readFileSync(mergedPath, "utf-8");
        assert.match(merged, /import type \{ ExtraType \} from "\.\/extra\.js";/);
        assert.match(merged, /BarType/);
        assert.match(merged, /readonly args: Record<string, number \| string>; \/\/ override/);
        assert.match(merged, /readonly optional\?: FooType;/);
        assert.match(merged, /type LocalAlias =\s+\| "a"\s+\| "b";/);
        assert.match(merged, /export interface CustomExtra/);
    }
};
