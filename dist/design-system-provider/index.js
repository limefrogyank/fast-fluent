import { __decorate } from "tslib";
import { designSystemProperty, designSystemProvider, DesignSystemProviderTemplate as template, } from "@microsoft/fast-foundation";
import { FASTDesignSystemProvider } from "@microsoft/fast-components-msft";
import { attr } from "@microsoft/fast-element";
import { FluentDesignSystemProviderStyles as styles } from "./fluent-design-system-provider.styles";
let FluentDesignSystemProvider = class FluentDesignSystemProvider extends FASTDesignSystemProvider {
};
__decorate([
    attr({ attribute: "font-weight-semiBold" }),
    designSystemProperty({ cssCustomProperty: "font-weight-semiBold", default: 600 })
], FluentDesignSystemProvider.prototype, "fontWeightSemiBold", void 0);
FluentDesignSystemProvider = __decorate([
    designSystemProvider({ name: "fluent-design-system-provider", template, styles })
], FluentDesignSystemProvider);
export { FluentDesignSystemProvider };
//# sourceMappingURL=index.js.map