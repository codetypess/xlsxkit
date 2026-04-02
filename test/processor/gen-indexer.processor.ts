import * as xlsx from "../../index.js";
import { makeTypename } from "./workbook-typedef.processor.js";

let done = false;

xlsx.registerProcessor(
    "workbook-indexer",
    async (workbook) => {
        if (done) {
            return;
        }
        done = true;
        const content = xlsx.genWorkbookIndexer(workbook.context, (typename) => {
            if (["ColumnIndexer", "RowIndexer", "Context"].includes(typename)) {
                return {
                    type: typename,
                    path: "../../index.js",
                };
            } else {
                return {
                    type: makeTypename(typename),
                    path: "./workbook-typedef.js",
                };
            }
        });
        xlsx.writeFile("test/output/workbook-indexer.ts", content);
    },
    {
        required: true,
        stage: "pre-parse",
    }
);
