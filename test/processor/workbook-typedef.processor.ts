import * as xlsx from "../../";
let done = false;

export const makeTypename = (name: string) => {
    if (name === "items") {
        return "Items";
    }
    return name;
};

xlsx.registerProcessor(
    "workbook-typedef",
    async (workbook) => {
        if (done) {
            return;
        }
        done = true;
        xlsx.writeFile(
            "test/output/workbook-typedef.ts",
            xlsx.genWorkbookTypedef(workbook.context, (typename) => ({
                type: makeTypename(typename),
                path: "./client/define/index",
            }))
        );
    },
    {
        required: true,
        stage: "pre-parse",
    }
);
