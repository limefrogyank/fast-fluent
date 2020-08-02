import { children, html, when, ref, repeat, slotted, SyntheticViewTemplate, ViewTemplate } from "@microsoft/fast-element";
import { FluentList } from "./list";

var generateTemplateString = (function(){
    var cache = {};

    function generateTemplate(template){
        var fn = cache[template];

        if (!fn){
            // Replace ${expressions} (etc) with ${map.expressions}.

            var sanitized = template
                .replace(/\$\{([\s]*[^;\s\{]+[\s]*)\}/g, function(_, match){
                    return `\$\{map.${match.trim()}\}`;
                    })
                // Afterwards, replace anything that's not ${map.expressions}' (etc) with a blank string.
                .replace(/(\$\{(?!map\.)[^}]+\})/g, '');

            fn = Function('map', `return \`${sanitized}\``);
        }

        return fn;
    }

    return generateTemplate;
})();

export const ListTemplate = html<FluentList<any>>`
    <template>

        <div ${ref('_root')} role="list" style="overflow-y:hidden;height:100%;width:100%;">
            <div ${ref('scrollElement')} ${children('_refs')} style="overflow-y:auto;height:100%;width:100%;">
                <div ${ref('spacerBefore')} class="spacer" data-List-spacer="before" style="height:${x => x.virtualizedData.numItemsToSkipBefore * x.averageHeight}px;"></div> 
                ${repeat((x) => x.virtualizedData.subSetOfItems, html<any>`
                <div role='listitem'
                    class='ms-List-cell'  
                    style="height:50px;" 
                    data-list-key="${(x,c) => {
                        let fluentList = c.parent as FluentList<any>;
                        let itemKey = fluentList.getKey ? fluentList.getKey(x.item, x.index) : x && (x as any).key;
                        if (itemKey === null || itemKey === undefined) {
                            itemKey= x.index;
                        }
                        return itemKey;            
                    }}"
                    data-list-index="${(x,c) => x.index}">

                    ${(x,c)=> {
                        try{
                        let fluentList = c.parent as FluentList<any>;
                        let template : HTMLDivElement;
                        for (let i=0; i< fluentList.children.length; i++){
                            template = fluentList.children.item(i) as HTMLDivElement;
                            if (template !== undefined){
                                
                                break;
                            }
                        }
                        //fluentList.children.item(0) as HTMLTemplateElement; 
                            
                        if (template! !== undefined) {
                            //let template = fluentList.slottedNodes.find(x=>x.nodeName.toLowerCase() === "template") as HTMLTemplateElement; //.filter(v => v.nodeType === 1)[0] as HTMLTemplateElement;
                            try{
                                console.log(x);
                                var replaced = generateTemplateString(template.innerHTML)(x);
                                console.log(replaced);
                                //if (template !== undefined){
                                return html<any>`${replaced}`;
                            } catch (ex){
                                console.log(ex);
                                html<any>`${JSON.stringify(ex)}`;
                            }
                            //}
                            //return "template undefined";
                        }
                        return "template undefined";
                    } catch (ex){
                        return "BIG ERROR";
                    }
                    }}
                   
<!--                     
                    <fast-fluent-list-item index="${x=>x.index}">
                        ${x => x.item.value}
                        <slot name="itemTemplate">
                
                        </slot>
                    </fast-fluent-list-item> -->
    
                </div>
                `, {positioning:false})}
                <div ${ref('spacerAfter')} class="spacer" data-List-spacer="after" style="height:${x => x.virtualizedData.numItemsToSkipAfter * x.averageHeight}px;"></div> 
            </div>

            
            
        </div>
        <slot ${slotted('slottedNodes')}></slot>
        
    </template>
`;

