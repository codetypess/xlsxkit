import * as xlsx from "../../index.js";

xlsx.registerStringify("task", (workbook: xlsx.Workbook) => {
    return xlsx.simpleSheet(workbook);
});
