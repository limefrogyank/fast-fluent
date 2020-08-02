import { html, ref, slotted, when } from "@microsoft/fast-element";
import { FluentDetailsList } from "./details-list";

const ListTemplate = html<FluentDetailsList<any>>`
  
`;

export const DetailsListTemplate = html<FluentDetailsList<any>>`
<template
    tabindex="0"
>
    <div class="ms-DetailsList"
     style="overflow-y:hidden;height:100%;"
     aria-label=@AriaLabel
     >
        <div role="grid"
            aria-label=@AriaLabel
            aria-rowcount=""
            aria-colcount=""
            aria-readonly=true
            style="overflow-y:hidden;height:100%;display:flex;flex-direction:column;">
            <div 
                role="presentation"
                class="ms-DetailsList-headerWrapper">
                ${when(x => x.isHeaderVisible, html<FluentDetailsList<any>>`
                    <!-- @if (HeaderTemplate != null)
                    {
                        @HeaderTemplate
                    }
                    else
                    {
                        <BFUDetailsHeader Columns=@_adjustedColumns
                                    TItem="TItem"
                                    IsAllSelected=@(ShouldAllBeSelected())
                                    OnAllSelected=@OnAllSelected
                                    OnColumnAutoResized=@OnColumnAutoResized
                                    OnColumnResized=@OnColumnResizedInternal
                                        CheckboxVisibility=@CheckboxVisibility
                                        SelectAllVisibility=@selectAllVisibility />
                    } -->
                `)}
            </div>
        <div 
             role="presentation"
             class="ms-DetailsList-contentWrapper"
             style="overflow-y:hidden;height:100%;">
            <div class="ms-DetailsList-focusZone"
                       Direction="FocusZoneDirection.Vertical"
                       InnerZoneKeystrokeTriggers="new System.Collections.Generic.List<ConsoleKey> { ConsoleKey.RightArrow }"
                       Style="height:100%;overflow-y:hidden;">
                ${when(x=>!x.disableSelectionZone, html<FluentDetailsList<any>>`
                    <fast-fluent-list ${ref('internalList')}>
                        <div id="itemTemplate" >
                            <div style="background-color:yellow">
                                and something else!
            
                            </div>                
                        </div>
                    </fast-fluent-list>  
                `)}
                ${when(x=>x.disableSelectionZone, html<FluentDetailsList<any>>`
                    <fast-fluent-list ${ref('internalList')}>
                        <div id="itemTemplate" >
                            <div style="background-color:yellow">
                                and something else!
            
                            </div>                
                        </div>
                    </fast-fluent-list>  
                `)}
            </div>
        </div>
    </div>
</template>
`;
