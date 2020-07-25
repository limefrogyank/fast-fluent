import { FASTElement } from "@microsoft/fast-element";
export declare class FluentLabel extends FASTElement {
    /**
         * The element is required.
         *
         * @public
         * @remarks
         * HTML Attribute: required
         */
    required: boolean;
    private requiredChanged;
    /**
     * The element is disabled.
     *
     * @public
     * @remarks
     * HTML Attribute: disabled
     */
    disabled: boolean;
    private disabledChanged;
    /**
    * The label is for element with id.
    *
    * @public
    * @remarks
    * HTML Attribute: for
    */
    for: string;
    /**
     * @internal
     */
    connectedCallback(): void;
}
