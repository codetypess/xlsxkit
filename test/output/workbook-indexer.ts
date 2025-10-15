// AUTO GENERATED, DO NOT MODIFY!

import { ColumnIndexer, RowIndexer } from "../..";
import {
    ItemDefine,
    ItemFollow,
    ItemItem,
    ItemMap,
    ItemMapArr,
    ItemMapField,
    ItemMapObj,
    TaskBranch,
    TaskConf,
    TaskDefine,
    TaskEvents,
    TaskExchange,
    TaskMain,
    TaskWeekly,
} from "./workbook-typedef";

type Filter<T> = (row: T) => boolean;

// file: test/res/item.xlsx
export class ItemIndexer {
    static createRowIndexer(sheet: "define", filter?: Filter<ItemDefine>): RowIndexer<ItemDefine>;
    static createRowIndexer(sheet: "follow", filter?: Filter<ItemFollow>): RowIndexer<ItemFollow>;
    static createRowIndexer(sheet: "item", filter?: Filter<ItemItem>): RowIndexer<ItemItem>;
    static createRowIndexer(sheet: "map", filter?: Filter<ItemMap>): RowIndexer<ItemMap>;
    static createRowIndexer(sheet: "map_arr", filter?: Filter<ItemMapArr>): RowIndexer<ItemMapArr>;
    static createRowIndexer(sheet: "map_field", filter?: Filter<ItemMapField>): RowIndexer<ItemMapField>;
    static createRowIndexer(sheet: "map_obj", filter?: Filter<ItemMapObj>): RowIndexer<ItemMapObj>;
    static createRowIndexer(sheet: "define" | "follow" | "item" | "map" | "map_arr" | "map_field" | "map_obj", filter?: Filter<ItemDefine> | Filter<ItemFollow> | Filter<ItemItem> | Filter<ItemMap> | Filter<ItemMapArr> | Filter<ItemMapField> | Filter<ItemMapObj>): unknown {
        return new RowIndexer("item.xlsx", sheet, filter as Filter<ItemDefine | ItemFollow | ItemItem | ItemMap | ItemMapArr | ItemMapField | ItemMapObj>);
    }
    
    static createColumnIndexer(sheet: "define", field: keyof ItemDefine, filter?: Filter<ItemDefine>): ColumnIndexer<ItemDefine>;
    static createColumnIndexer(sheet: "follow", field: keyof ItemFollow, filter?: Filter<ItemFollow>): ColumnIndexer<ItemFollow>;
    static createColumnIndexer(sheet: "item", field: keyof ItemItem, filter?: Filter<ItemItem>): ColumnIndexer<ItemItem>;
    static createColumnIndexer(sheet: "map", field: keyof ItemMap, filter?: Filter<ItemMap>): ColumnIndexer<ItemMap>;
    static createColumnIndexer(sheet: "map_arr", field: keyof ItemMapArr, filter?: Filter<ItemMapArr>): ColumnIndexer<ItemMapArr>;
    static createColumnIndexer(sheet: "map_field", field: keyof ItemMapField, filter?: Filter<ItemMapField>): ColumnIndexer<ItemMapField>;
    static createColumnIndexer(sheet: "map_obj", field: keyof ItemMapObj, filter?: Filter<ItemMapObj>): ColumnIndexer<ItemMapObj>;
    static createColumnIndexer(sheet: "define" | "follow" | "item" | "map" | "map_arr" | "map_field" | "map_obj", field: string, filter?: Filter<ItemDefine> | Filter<ItemFollow> | Filter<ItemItem> | Filter<ItemMap> | Filter<ItemMapArr> | Filter<ItemMapField> | Filter<ItemMapObj>): unknown {
        return new ColumnIndexer("item.xlsx", sheet, field, filter as Filter<ItemDefine | ItemFollow | ItemItem | ItemMap | ItemMapArr | ItemMapField | ItemMapObj>);
    }
    
}

// file: test/res/task.xlsx
export class TaskIndexer {
    static createRowIndexer(sheet: "branch", filter?: Filter<TaskBranch>): RowIndexer<TaskBranch>;
    static createRowIndexer(sheet: "conf", filter?: Filter<TaskConf>): RowIndexer<TaskConf>;
    static createRowIndexer(sheet: "define", filter?: Filter<TaskDefine>): RowIndexer<TaskDefine>;
    static createRowIndexer(sheet: "events", filter?: Filter<TaskEvents>): RowIndexer<TaskEvents>;
    static createRowIndexer(sheet: "exchange", filter?: Filter<TaskExchange>): RowIndexer<TaskExchange>;
    static createRowIndexer(sheet: "main", filter?: Filter<TaskMain>): RowIndexer<TaskMain>;
    static createRowIndexer(sheet: "weekly", filter?: Filter<TaskWeekly>): RowIndexer<TaskWeekly>;
    static createRowIndexer(sheet: "branch" | "conf" | "define" | "events" | "exchange" | "main" | "weekly", filter?: Filter<TaskBranch> | Filter<TaskConf> | Filter<TaskDefine> | Filter<TaskEvents> | Filter<TaskExchange> | Filter<TaskMain> | Filter<TaskWeekly>): unknown {
        return new RowIndexer("task.xlsx", sheet, filter as Filter<TaskBranch | TaskConf | TaskDefine | TaskEvents | TaskExchange | TaskMain | TaskWeekly>);
    }
    
    static createColumnIndexer(sheet: "branch", field: keyof TaskBranch, filter?: Filter<TaskBranch>): ColumnIndexer<TaskBranch>;
    static createColumnIndexer(sheet: "conf", field: keyof TaskConf, filter?: Filter<TaskConf>): ColumnIndexer<TaskConf>;
    static createColumnIndexer(sheet: "define", field: keyof TaskDefine, filter?: Filter<TaskDefine>): ColumnIndexer<TaskDefine>;
    static createColumnIndexer(sheet: "events", field: keyof TaskEvents, filter?: Filter<TaskEvents>): ColumnIndexer<TaskEvents>;
    static createColumnIndexer(sheet: "exchange", field: keyof TaskExchange, filter?: Filter<TaskExchange>): ColumnIndexer<TaskExchange>;
    static createColumnIndexer(sheet: "main", field: keyof TaskMain, filter?: Filter<TaskMain>): ColumnIndexer<TaskMain>;
    static createColumnIndexer(sheet: "weekly", field: keyof TaskWeekly, filter?: Filter<TaskWeekly>): ColumnIndexer<TaskWeekly>;
    static createColumnIndexer(sheet: "branch" | "conf" | "define" | "events" | "exchange" | "main" | "weekly", field: string, filter?: Filter<TaskBranch> | Filter<TaskConf> | Filter<TaskDefine> | Filter<TaskEvents> | Filter<TaskExchange> | Filter<TaskMain> | Filter<TaskWeekly>): unknown {
        return new ColumnIndexer("task.xlsx", sheet, field, filter as Filter<TaskBranch | TaskConf | TaskDefine | TaskEvents | TaskExchange | TaskMain | TaskWeekly>);
    }
    
}


