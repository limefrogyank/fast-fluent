import { TextField } from "@microsoft/fast-foundation";
/**
 * Text field appearances
 * @public
 */
export declare type TextFieldAppearance = "filled" | "outline";
/**
 * The FAST Text Field Custom Element. Implements {@link @microsoft/fast-foundation#TextField},
 * {@link @microsoft/fast-foundation#TextFieldTemplate}
 *
 *
 * @public
 * @remarks
 * HTML Element: \<fast-text-field\>
 *
 * {@link https://developer.mozilla.org/en-US/docs/Web/API/ShadowRoot/delegatesFocus | delegatesFocus}
 */
export declare class FluentTextField extends TextField {
    /**
         * The appearance of the element.
         *
         * @public
         * @remarks
         * HTML Attribute: appearance
         */
    appearance: TextFieldAppearance;
    /**
     * @internal
     */
    appearanceChanged(oldValue: TextFieldAppearance, newValue: TextFieldAppearance): void;
    label: string;
    /**
     * @internal
     */
    connectedCallback(): void;
}
