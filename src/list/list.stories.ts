import { FluentDesignSystemProvider } from "../design-system-provider";
import { html } from "@microsoft/fast-element";
import Examples from "./fixtures/list.html";
import { FluentList } from "../list";



// Prevent tree-shaking
FluentList;
FluentDesignSystemProvider;

export default {
    title: "List",
};

let loadList = (firstList:HTMLElement):void =>{
    let list =  firstList as FluentList<any>; //(ev.target as FluentList<any>);
        
    list.onRenderCell = (item,index,isScrolling) => html<any>`
        <div>
            item is ${x => item.value}
            index is ${x => index}
        </div>
    `;
    let items : any[] = [];
    for (var i = 0; i< 50; i++){
        items.push({value: i.toString()});
        //items.push(i);
    }

    list.items = items;
}
  
export const List = () => {  

    console.log("running script here");
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
};
