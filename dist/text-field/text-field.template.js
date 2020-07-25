import { html, ref, when } from "@microsoft/fast-element";
import { endTemplate, startTemplate } from "../patterns";
export const FluentTextFieldTemplate = html `
    <template
        tabindex="${x => (x.disabled ? null : 0)}"
        class="
            ${x => (x.readOnly ? "readonly" : "")}
            ${x => (x.label && x.label.length > 0 ? "" : "no-label")}
        "
    >
        ${when(x => x.label && x.label.length > 0, html `
             <fast-fluent-label 
                           for="control"
                           disabled="${x => x.disabled}"
                           required="${x => x.required}">
                ${x => x.label}
            </fast-fluent-label>
            `)}
        <div class="root" part="root">
            ${startTemplate}
            <input
                class="control"
                part="control"
                id="control"
                @input="${x => x.handleTextInput()}"
                placeholder="${x => x.placeholder}"
                ?required="${x => x.required}"
                ?disabled="${x => x.disabled}"
                ?readonly="${x => x.readOnly}"
                value="${x => x.value}"
                type="${x => x.type}"
                aria-atomic="${x => x.ariaAtomic}"
                aria-busy="${x => x.ariaBusy}"
                aria-controls="${x => x.ariaControls}"
                aria-current="${x => x.ariaCurrent}"
                aria-describedBy="${x => x.ariaDescribedby}"
                aria-details="${x => x.ariaDetails}"
                aria-disabled="${x => x.ariaDisabled}"
                aria-errormessage="${x => x.ariaErrormessage}"
                aria-flowto="${x => x.ariaDisabled}"
                aria-haspopup="${x => x.ariaHaspopup}"
                aria-hidden="${x => x.ariaHidden}"
                aria-invalid="${x => x.ariaInvalid}"
                aria-keyshortcuts="${x => x.ariaKeyshortcuts}"
                aria-label="${x => x.ariaLabel}"
                aria-labelledby="${x => x.ariaLabelledby}"
                aria-live="${x => x.ariaLive}"
                aria-owns="${x => x.ariaOwns}"
                aria-relevant="${x => x.ariaRelevant}"
                aria-roledescription="${x => x.ariaRoledescription}"
                ${ref("control")}
            />
            ${endTemplate}
        </div>
    </template>
`;
//# sourceMappingURL=text-field.template.js.map