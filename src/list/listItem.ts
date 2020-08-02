import { attr, css, customElement, DOM, FASTElement,html, observable, Observable, ref, repeat, ViewTemplate } from "@microsoft/fast-element";
import {IndexedItem} from './interface';

const itemTemplate = html<FluentListItem<IndexedItem<any>>>`
    <template>
        <slot name="internalItemTemplate">
            <slot>
        
            <slot>

        </slot>
    </template>
`;

const itemStyles = css`
    :host {
        width:100%;
    }
`;


@customElement({
    name: "fast-fluent-list-item",
    template: itemTemplate,
    styles: itemStyles,
    shadowOptions: {
        delegatesFocus: true,
    },
})
export class FluentListItem<T> extends FASTElement {


}