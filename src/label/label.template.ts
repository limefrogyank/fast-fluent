import { html, ref, slotted } from "@microsoft/fast-element";
import { endTemplate, startTemplate } from "../patterns";
import { FluentLabel } from "./label";

export const LabelTemplate = html<FluentLabel>`
    <template
        tabindex="0"
        class="
            ${x => (x.disabled ? "disabled" : "")}
            ${x => (x.required ? "required" : "")}
        "
    >
        <label
            part="label"
            for="${x=>x.for}"           
        >
            <slot></slot>
        </label>

    </template>
`;
