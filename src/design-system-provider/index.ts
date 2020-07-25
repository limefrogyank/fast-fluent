import {
    CSSCustomPropertyBehavior,
    designSystemProperty,
    DesignSystemProvider,
    designSystemProvider,
    DesignSystemProviderTemplate as template,
} from "@microsoft/fast-foundation";
import {
    FASTDesignSystemProvider
} from "@microsoft/fast-components-msft";
import {attr, css, nullableNumberConverter} from "@microsoft/fast-element";
import { FluentDesignSystemProviderStyles as styles} from "./fluent-design-system-provider.styles";

@designSystemProvider({name:"fluent-design-system-provider", template, styles})
export class FluentDesignSystemProvider extends FASTDesignSystemProvider {

    @attr({attribute:"font-weight-semiBold"})
    @designSystemProperty({ cssCustomProperty: "font-weight-semiBold", default: 600 })
    public fontWeightSemiBold;

}