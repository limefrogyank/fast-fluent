import { __decorate } from "tslib";
import { attr, customElement } from "@microsoft/fast-element";
import { TextField } from "@microsoft/fast-foundation";
import { FluentTextFieldTemplate as template } from "./text-field.template";
import { FluentTextFieldStyles as styles } from "./text-field.styles";
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
let FluentTextField = class FluentTextField extends TextField {
    /**
     * @internal
     */
    appearanceChanged(oldValue, newValue) {
        if (newValue === undefined) {
            console.log("newValue is undefined");
        }
        else {
            console.log("newValue is " + newValue);
        }
        if (oldValue !== newValue) {
            this.classList.add(newValue);
            this.classList.remove(oldValue);
        }
    }
    /**
     * @internal
     */
    connectedCallback() {
        super.connectedCallback();
        if (!this.appearance) {
            this.appearance = "outline";
        }
    }
};
__decorate([
    attr
], FluentTextField.prototype, "appearance", void 0);
__decorate([
    attr
], FluentTextField.prototype, "label", void 0);
FluentTextField = __decorate([
    customElement({
        name: "fast-fluent-text-field",
        template,
        styles,
        shadowOptions: {
            delegatesFocus: true,
        },
    })
], FluentTextField);
export { FluentTextField };
//# sourceMappingURL=text-field.js.map