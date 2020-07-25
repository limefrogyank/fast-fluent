import { html } from "@microsoft/fast-element";
export const LabelTemplate = html `
    <template
        tabindex="0"
        class="
            ${x => (x.disabled ? "disabled" : "")}
            ${x => (x.required ? "required" : "")}
        "
    >
        <label
            part="label"
            for="${x => x.for}"           
        >
            <slot></slot>
        </label>

    </template>
`;
//# sourceMappingURL=label.template.js.map