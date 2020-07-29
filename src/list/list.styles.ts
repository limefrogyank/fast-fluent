import { css } from "@microsoft/fast-element";
import {
    disabledCursor,
    display,
    focusVisible,
    forcedColorsStylesheetBehavior,
} from "@microsoft/fast-foundation";
import { SystemColors } from "@microsoft/fast-web-utilities";
import {
    heightNumber,
    
    neutralFillHoverBehavior,
    neutralFillInputHoverBehavior,
    neutralFillInputRestBehavior,
    neutralFillRestBehavior,
    neutralFocusBehavior,
    neutralForegroundRestBehavior,
    neutralOutlineHoverBehavior,
    neutralOutlineRestBehavior
} from "../styles";

export const ListStyles = css`
    ${display("inline-block")} :host {
        font-family: var(--body-font);
        font-weight: var(--font-weight-semiBold);
        outline: none;
        user-select: none;
        height:100%;
        overflow-y:hidden;
        width:100%;
    }
    :host(.disabled) label {
        opacity: var(--disabled-opacity);
    }
    :host(.required) label::after {
        content: ' *';
        color: #a4262c;
        padding-right: 12px;
    }
    `
;
