import { __decorate } from "tslib";
import { attr, customElement, DOM, FASTElement } from "@microsoft/fast-element";
import { LabelTemplate as template } from "./label.template";
import { LabelStyles as styles } from "./label.styles";
let FluentLabel = class FluentLabel extends FASTElement {
    requiredChanged() {
        console.log("required");
        DOM.queueUpdate(() => this.classList.toggle("required", this.required));
    }
    disabledChanged() {
        console.log("disabled");
        DOM.queueUpdate(() => this.classList.toggle("disabled", this.disabled));
    }
    /**
     * @internal
     */
    connectedCallback() {
        super.connectedCallback();
    }
};
__decorate([
    attr({ mode: "boolean" })
], FluentLabel.prototype, "required", void 0);
__decorate([
    attr({ mode: "boolean" })
], FluentLabel.prototype, "disabled", void 0);
__decorate([
    attr
], FluentLabel.prototype, "for", void 0);
FluentLabel = __decorate([
    customElement({
        name: "fast-fluent-label",
        template,
        styles,
        shadowOptions: {
            delegatesFocus: true,
        },
    })
], FluentLabel);
export { FluentLabel };
//# sourceMappingURL=label.js.map