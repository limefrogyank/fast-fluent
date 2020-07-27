import { html, ref, slotted } from "@microsoft/fast-element";
import { FluentDetailsList } from "./details-list";

export const DetailsListTemplate = html<FluentDetailsList>`
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
