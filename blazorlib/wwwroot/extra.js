//import { FluentList } from "../../src/list";
var BlazorFluentUiList;
(function (BlazorFluentUiList) {
    function setList(listRef, listArray) {
        let fluentList = listRef;
        if (fluentList !== undefined) {
            fluentList.items = listArray;
        }
    }
    BlazorFluentUiList.setList = setList;
    let x = 3;
})(BlazorFluentUiList || (BlazorFluentUiList = {}));
//}
window.BlazorFluentUiList = BlazorFluentUiList;
//(<any>window)['BlazorFluentUiList'] = BlazorFluentUiList || {};
//# sourceMappingURL=extra.js.map