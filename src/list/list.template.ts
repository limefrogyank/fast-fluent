import { children, html, ref, repeat, slotted, SyntheticViewTemplate, ViewTemplate } from "@microsoft/fast-element";
import { endTemplate, startTemplate } from "../patterns";
import { FluentList } from "./list";
import { IPage } from "@fluentui/react";

interface IPage2<T> extends IPage<T>{
    getKey?: (item: T, index?: number) => string;
    onRenderCell?: (item?: T, index?: number, isScrolling?: boolean) => ViewTemplate;
}

const ItemTemplate = html<any>`
    <div role='listitem'
        class='ms-List-cell'   
        key=${(x,c) => {
            let page = c.parent as IPage2<any>;
            let itemKey = page.getKey ? page.getKey(x, page.startIndex + c.index) : x && (x as any).key;
            if (itemKey === null || itemKey === undefined) {
                itemKey=page.startIndex + c.index;
            }
            return itemKey;            
        }}
        data-list-index=${(x,c) => (c.parent as IPage2<any>).startIndex + c.index}>
        ${x=>x}
        ${(x,c)=>c.index}
        ${(x,c)=>c.isEven}
        ${(x,c)=>(c.parent as IPage2<any>).onRenderCell ? (c.parent as IPage2<any>).onRenderCell!(x,(c.parent as IPage2<any>).startIndex + c.index): ""}
    </div>
`;

const PageTemplate = html<IPage2<any>>`
    <div data-page-key=${x => x.key} 
         class="ms-List-page"
         key="1"
         role="presentation"
         style="height:${x=> x.isSpacer ? x.height + "px" : "auto"};">
        ${repeat((x,c)=> x.items as any[], ItemTemplate, {positioning: true})}
    </div>
`;


export const ListTemplate = html<FluentList<any>>`
    <template>
        <div ${ref('_root')}>
            <div ${ref('_surface')} ${children('_refs')}>
                ${repeat((x) => x.state.pages, PageTemplate)}
            </div>
        </div>

    </template>
`;
