import * as xlsx from "../../";

export const defines: Set<string> = new Set();
export const types: Set<string> = new Set();

let done = false;

const writeDefines = () => {
    const imports = Array.from(defines).sort();
    xlsx.writeFile(
        `test/output/client/define/index.ts`,

        xlsx.format(
            `
            // AUTO GENERATED, DO NOT MODIFY!

            %{defines}
            export * from "./custom";
            `,
            {
                defines: imports.map((d) => `export * from "./${d}";`).join("\n"),
            }
        )
    );
};

const writeTypes = () => {
    const imports = Array.from(types).sort();
    xlsx.writeFile(
        `test/output/client/types/index.ts`,
        xlsx.format(
            `
            // AUTO GENERATED, DO NOT MODIFY!

            export * from "../define/index";
            %{types}
            `,
            {
                types: imports.map((t) => `export * from "./${t}";`).join("\n"),
            }
        )
    );
};

xlsx.registerProcessor(
    "post_stringify",
    async (workbook) => {
        if (done) {
            return;
        }
        done = true;
        writeDefines();
        writeTypes();
    },
    {
        stage: "after-stringify",
        required: true,
    }
);
