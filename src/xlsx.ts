import * as xlsx from "fastxlsx";
import { convertBody, loadBody, loadHeader } from "./core/parser";
import { copyWorkbook, performChecker, performProcessor, resolveChecker } from "./core/pipeline";
import { DEFAULT_TAG, DEFAULT_WRITER } from "./core/registry";
import { addContext, Context, Workbook } from "./core/workbook";

export const build = async (fs: string[], headerOnly: boolean = false) => {
    const ctx = addContext(new Context(DEFAULT_WRITER, DEFAULT_TAG));
    for (const file of fs) {
        ctx.add(new Workbook(ctx, file));
    }
    for (const file of fs) {
        console.log(`reading: '${file}'`);
        const data = await xlsx.Workbook.open(file);
        loadHeader(file, data);
        if (!headerOnly) {
            loadBody(file, data);
        }
    }
    await performProcessor("after-read", DEFAULT_WRITER);
    if (!headerOnly) {
        await performProcessor("pre-parse", DEFAULT_WRITER);
        convertBody();
        await performProcessor("after-parse", DEFAULT_WRITER);
        copyWorkbook();
        await performProcessor("pre-check");
        resolveChecker();
        performChecker();
        await performProcessor("after-check");
        await performProcessor("pre-stringify");
        await performProcessor("stringify");
        await performProcessor("after-stringify");
    }
};
