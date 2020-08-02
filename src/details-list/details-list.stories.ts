import { FluentDesignSystemProvider } from "../design-system-provider";
import Examples from "./fixtures/details-list.html";
import { FluentDetailsList } from "../details-list";
import { FluentList } from "../list";



// Prevent tree-shaking
FluentDetailsList;
FluentList;
FluentDesignSystemProvider;

let loadList = (firstList:HTMLElement):void =>{
    let list =  firstList as FluentList<any>; //(ev.target as FluentList<any>);
  
    let items : any[] = [];
    for (var i = 0; i< 5000; i++){
        items.push({value: i.toString()});
        //items.push(i);
    }

    list.items = items;
}

export default {
    title: "DetailsList",
};

export const DetailsList = () => {
    let firstlist = document.getElementById("firstList");
     if (firstlist !== null){
            loadList(firstlist);

        // };
    } else {
        window.setTimeout(() =>{
            let firstlist = document.getElementById("firstList");
            if (firstlist !== null){
                loadList(firstlist);
            }
        },500);
    }
    return Examples;
}
