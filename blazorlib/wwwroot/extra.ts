//import { FluentList } from "../../src/list";

namespace BlazorFluentUiList {

    export function setList(listRef:HTMLElement, listArray: any[]){
        let fluentList = listRef as any;
        if (fluentList !== undefined){
            fluentList.items = listArray;
        }

    }    
    let x=3;


}

//declare global{
    interface Window {
        BlazorFluentUiList: typeof BlazorFluentUiList
    }
//}

window.BlazorFluentUiList = BlazorFluentUiList;


//(<any>window)['BlazorFluentUiList'] = BlazorFluentUiList || {};