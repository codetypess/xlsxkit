import * as xlsx from "../../index";

xlsx.registerStringifyRule("task", (workbook: xlsx.Workbook) => {
    return xlsx.simpleSheets(workbook);
});
