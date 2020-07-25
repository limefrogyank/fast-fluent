import { attr, customElement, DOM, FASTElement } from "@microsoft/fast-element";
import {LabelTemplate as template} from "./label.template";
import { LabelStyles as styles } from "./label.styles";


@customElement({
    name: "fast-fluent-label",
    template,
    styles,
    shadowOptions: {
        delegatesFocus: true,
    },
})
export class FluentLabel extends FASTElement {

/**
     * The element is required.
     *
     * @public
     * @remarks
     * HTML Attribute: required
     */
    @attr({mode: "boolean"})
    public required: boolean;

    private requiredChanged(): void {
        console.log("required");
        DOM.queueUpdate(() => this.classList.toggle("required", this.required));
    }

    /**
     * The element is disabled.
     *
     * @public
     * @remarks
     * HTML Attribute: disabled
     */
    @attr({mode: "boolean"})
    public disabled: boolean;

    private disabledChanged(): void {
        console.log("disabled");
        DOM.queueUpdate(() => this.classList.toggle("disabled", this.disabled));
    }

     /**
     * The label is for element with id.
     *
     * @public
     * @remarks
     * HTML Attribute: for
     */
    @attr
    public for: string;

    /**
     * @internal
     */
    public connectedCallback() {
        super.connectedCallback();

        
    }

}
