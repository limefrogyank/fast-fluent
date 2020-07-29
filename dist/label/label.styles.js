import { css } from "@microsoft/fast-element";
import { display, } from "@microsoft/fast-foundation";
export const LabelStyles = css `
    ${display("inline-block")} :host {
        font-family: var(--body-font);
        font-weight: var(--font-weight-semiBold);
        outline: none;
        user-select: none;
    }
    :host(.disabled) label {
        opacity: var(--disabled-opacity);
    }
    :host(.required) label::after {
        content: ' *';
        color: #a4262c;
        padding-right: 12px;
    }
    `;
//# sourceMappingURL=label.styles.js.map