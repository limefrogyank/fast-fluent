import { attr, customElement, DOM, FASTElement, observable } from "@microsoft/fast-element";
import { DetailsListTemplate as template} from "./details-list.template";
import { DetailsListStyles as styles } from "./details-list.styles";
import { FluentList} from "../list";


@customElement({
    name: "fast-fluent-details-list",
    template,
    styles,
    shadowOptions: {
        delegatesFocus: true,
    },
})
export class FluentDetailsList<T> extends FASTElement {

    public internalList :FluentList<T>;

    @attr({mode: "boolean"})
    public required: boolean;

    private requiredChanged(): void {
        console.log("required");
        DOM.queueUpdate(() => this.classList.toggle("required", this.required));
    }


    @attr({mode: "boolean"})
    public disabled: boolean;

    private disabledChanged(): void {
        console.log("disabled");
        DOM.queueUpdate(() => this.classList.toggle("disabled", this.disabled));
    }

    @observable 
    public items:T[];
    private itemsChanged(oldValue: T[], newValue: T[]) {
         if (oldValue !== newValue){
             this.internalList.items = newValue;
         }
    }

    private propertyChanged(needsReset: boolean):void {
        if (needsReset){
            //this.initialListDrawing();

        }
    }


    @attr
    public for: string;

    @attr
    public disableSelectionZone:boolean;

    public isHeaderVisible :boolean;

    public connectedCallback() {
        super.connectedCallback();

        
    }

}
