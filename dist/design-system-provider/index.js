import { __decorate } from "tslib";
import { attr, css, nullableNumberConverter } from "@microsoft/fast-element";
import { DesignSystemDefaults, neutralForegroundRest, } from "@microsoft/fast-components-styles-msft";
import { CSSCustomPropertyBehavior, designSystemProperty, DesignSystemProvider, designSystemProvider, DesignSystemProviderTemplate as template, } from "@microsoft/fast-foundation";
import { DesignSystemProviderStyles as styles } from "./design-system-provider.styles";
const color = new CSSCustomPropertyBehavior("neutral-foreground-rest", neutralForegroundRest, (el) => el);
const backgroundStyles = css `
    :host {
        background-color: var(--background-color);
        color: ${color.var};
    }
`.withBehaviors(color);
/**
 * The FAST DesignSystemProvider Element. Implements {@link @microsoft/fast-foundation#DesignSystemProvider},
 * {@link @microsoft/fast-foundation#DesignSystemProviderTemplate}
 *
 *
 * @public
 * @remarks
 * HTML Element: \<fast-design-system-provider\>
 */
let FASTDesignSystemProvider = class FASTDesignSystemProvider extends DesignSystemProvider {
    constructor() {
        super(...arguments);
        /**
         * Used to instruct the FASTDesignSystemProvider
         * that it should not set the CSS
         * background-color and color properties
         *
         * @remarks
         * HTML boolean boolean attribute: no-paint
         */
        this.noPaint = false;
    }
    noPaintChanged() {
        if (!this.noPaint && this.backgroundColor !== void 0) {
            this.$fastController.addStyles(backgroundStyles);
        }
        else {
            this.$fastController.removeStyles(backgroundStyles);
        }
    }
    backgroundColorChanged() {
        // If background changes or is removed, we need to
        // re-evaluate whether we should have paint styles applied
        this.noPaintChanged();
    }
};
__decorate([
    attr({ attribute: "no-paint", mode: "boolean" })
], FASTDesignSystemProvider.prototype, "noPaint", void 0);
__decorate([
    designSystemProperty({
        attribute: "background-color",
        default: DesignSystemDefaults.backgroundColor,
    })
], FASTDesignSystemProvider.prototype, "backgroundColor", void 0);
__decorate([
    designSystemProperty({
        attribute: "accent-base-color",
        cssCustomProperty: false,
        default: DesignSystemDefaults.accentBaseColor,
    })
], FASTDesignSystemProvider.prototype, "accentBaseColor", void 0);
__decorate([
    designSystemProperty({
        attribute: false,
        cssCustomProperty: false,
        default: DesignSystemDefaults.neutralPalette,
    })
], FASTDesignSystemProvider.prototype, "neutralPalette", void 0);
__decorate([
    designSystemProperty({
        attribute: false,
        cssCustomProperty: false,
        default: DesignSystemDefaults.accentPalette,
    })
], FASTDesignSystemProvider.prototype, "accentPalette", void 0);
__decorate([
    designSystemProperty({
        default: DesignSystemDefaults.density,
        converter: nullableNumberConverter,
    })
], FASTDesignSystemProvider.prototype, "density", void 0);
__decorate([
    designSystemProperty({
        attribute: "design-unit",
        converter: nullableNumberConverter,
        default: DesignSystemDefaults.designUnit,
    })
], FASTDesignSystemProvider.prototype, "designUnit", void 0);
__decorate([
    designSystemProperty({
        attribute: "direction",
        cssCustomProperty: false,
        default: DesignSystemDefaults.direction,
    })
], FASTDesignSystemProvider.prototype, "direction", void 0);
__decorate([
    designSystemProperty({
        attribute: "base-height-multiplier",
        default: DesignSystemDefaults.baseHeightMultiplier,
        converter: nullableNumberConverter,
    })
], FASTDesignSystemProvider.prototype, "baseHeightMultiplier", void 0);
__decorate([
    designSystemProperty({
        attribute: "base-horizontal-spacing-multiplier",
        converter: nullableNumberConverter,
        default: DesignSystemDefaults.baseHorizontalSpacingMultiplier,
    })
], FASTDesignSystemProvider.prototype, "baseHorizontalSpacingMultiplier", void 0);
__decorate([
    designSystemProperty({
        attribute: "corner-radius",
        converter: nullableNumberConverter,
        default: DesignSystemDefaults.cornerRadius,
    })
], FASTDesignSystemProvider.prototype, "cornerRadius", void 0);
__decorate([
    designSystemProperty({
        attribute: "elevated-corner-radius",
        converter: nullableNumberConverter,
        default: DesignSystemDefaults.elevatedCornerRadius,
    })
], FASTDesignSystemProvider.prototype, "elevatedCornerRadius", void 0);
__decorate([
    designSystemProperty({
        attribute: "outline-width",
        converter: nullableNumberConverter,
        default: DesignSystemDefaults.outlineWidth,
    })
], FASTDesignSystemProvider.prototype, "outlineWidth", void 0);
__decorate([
    designSystemProperty({
        attribute: "focus-outline-width",
        converter: nullableNumberConverter,
        default: DesignSystemDefaults.focusOutlineWidth,
    })
], FASTDesignSystemProvider.prototype, "focusOutlineWidth", void 0);
__decorate([
    designSystemProperty({
        attribute: "disabled-opacity",
        converter: nullableNumberConverter,
        default: DesignSystemDefaults.disabledOpacity,
    })
], FASTDesignSystemProvider.prototype, "disabledOpacity", void 0);
__decorate([
    designSystemProperty({
        attribute: "type-ramp-minus-2-font-size",
        default: "10px",
    })
], FASTDesignSystemProvider.prototype, "typeRampMinus2FontSize", void 0);
__decorate([
    designSystemProperty({
        attribute: "type-ramp-minus-2-line-height",
        default: "16px",
    })
], FASTDesignSystemProvider.prototype, "typeRampMinus2LineHeight", void 0);
__decorate([
    designSystemProperty({
        attribute: "type-ramp-minus-1-font-size",
        default: "12px",
    })
], FASTDesignSystemProvider.prototype, "typeRampMinus1FontSize", void 0);
__decorate([
    designSystemProperty({
        attribute: "type-ramp-minus-1-line-height",
        default: "16px",
    })
], FASTDesignSystemProvider.prototype, "typeRampMinus1LineHeight", void 0);
__decorate([
    designSystemProperty({
        attribute: "type-ramp-base-font-size",
        default: "14px",
    })
], FASTDesignSystemProvider.prototype, "typeRampBaseFontSize", void 0);
__decorate([
    designSystemProperty({
        attribute: "type-ramp-base-line-height",
        default: "20px",
    })
], FASTDesignSystemProvider.prototype, "typeRampBaseLineHeight", void 0);
__decorate([
    designSystemProperty({
        attribute: "type-ramp-plus-1-font-size",
        default: "16px",
    })
], FASTDesignSystemProvider.prototype, "typeRampPlus1FontSize", void 0);
__decorate([
    designSystemProperty({
        attribute: "type-ramp-plus-1-line-height",
        default: "24px",
    })
], FASTDesignSystemProvider.prototype, "typeRampPlus1LineHeight", void 0);
__decorate([
    designSystemProperty({
        attribute: "type-ramp-plus-2-font-size",
        default: "20px",
    })
], FASTDesignSystemProvider.prototype, "typeRampPlus2FontSize", void 0);
__decorate([
    designSystemProperty({
        attribute: "type-ramp-plus-2-line-height",
        default: "28px",
    })
], FASTDesignSystemProvider.prototype, "typeRampPlus2LineHeight", void 0);
__decorate([
    designSystemProperty({
        attribute: "type-ramp-plus-3-font-size",
        default: "28px",
    })
], FASTDesignSystemProvider.prototype, "typeRampPlus3FontSize", void 0);
__decorate([
    designSystemProperty({
        attribute: "type-ramp-plus-3-line-height",
        default: "36px",
    })
], FASTDesignSystemProvider.prototype, "typeRampPlus3LineHeight", void 0);
__decorate([
    designSystemProperty({
        attribute: "type-ramp-plus-4-font-size",
        default: "34px",
    })
], FASTDesignSystemProvider.prototype, "typeRampPlus4FontSize", void 0);
__decorate([
    designSystemProperty({
        attribute: "type-ramp-plus-4-line-height",
        default: "44px",
    })
], FASTDesignSystemProvider.prototype, "typeRampPlus4LineHeight", void 0);
__decorate([
    designSystemProperty({
        attribute: "type-ramp-plus-5-font-size",
        default: "46px",
    })
], FASTDesignSystemProvider.prototype, "typeRampPlus5FontSize", void 0);
__decorate([
    designSystemProperty({
        attribute: "type-ramp-plus-5-line-height",
        default: "56px",
    })
], FASTDesignSystemProvider.prototype, "typeRampPlus5LineHeight", void 0);
__decorate([
    designSystemProperty({
        attribute: "type-ramp-plus-6-font-size",
        default: "60px",
    })
], FASTDesignSystemProvider.prototype, "typeRampPlus6FontSize", void 0);
__decorate([
    designSystemProperty({
        attribute: "type-ramp-plus-6-line-height",
        default: "72px",
    })
], FASTDesignSystemProvider.prototype, "typeRampPlus6LineHeight", void 0);
__decorate([
    designSystemProperty({
        attribute: "accent-fill-rest-delta",
        converter: nullableNumberConverter,
        cssCustomProperty: false,
        default: DesignSystemDefaults.accentFillRestDelta,
    })
], FASTDesignSystemProvider.prototype, "accentFillRestDelta", void 0);
__decorate([
    designSystemProperty({
        attribute: "accent-fill-hover-delta",
        converter: nullableNumberConverter,
        cssCustomProperty: false,
        default: DesignSystemDefaults.accentFillHoverDelta,
    })
], FASTDesignSystemProvider.prototype, "accentFillHoverDelta", void 0);
__decorate([
    designSystemProperty({
        attribute: "accent-fill-active-delta",
        cssCustomProperty: false,
        converter: nullableNumberConverter,
        default: DesignSystemDefaults.accentFillActiveDelta,
    })
], FASTDesignSystemProvider.prototype, "accentFillActiveDelta", void 0);
__decorate([
    designSystemProperty({
        attribute: "accent-fill-focus-delta",
        converter: nullableNumberConverter,
        cssCustomProperty: false,
        default: DesignSystemDefaults.accentFillFocusDelta,
    })
], FASTDesignSystemProvider.prototype, "accentFillFocusDelta", void 0);
__decorate([
    designSystemProperty({
        attribute: "accent-fill-selected-delta",
        converter: nullableNumberConverter,
        cssCustomProperty: false,
        default: DesignSystemDefaults.accentFillSelectedDelta,
    })
], FASTDesignSystemProvider.prototype, "accentFillSelectedDelta", void 0);
__decorate([
    designSystemProperty({
        attribute: "accent-foreground-rest-delta",
        converter: nullableNumberConverter,
        cssCustomProperty: false,
        default: DesignSystemDefaults.accentForegroundRestDelta,
    })
], FASTDesignSystemProvider.prototype, "accentForegroundRestDelta", void 0);
__decorate([
    designSystemProperty({
        attribute: "accent-foreground-hover-delta",
        converter: nullableNumberConverter,
        cssCustomProperty: false,
        default: DesignSystemDefaults.accentForegroundHoverDelta,
    })
], FASTDesignSystemProvider.prototype, "accentForegroundHoverDelta", void 0);
__decorate([
    designSystemProperty({
        attribute: "accent-foreground-active-delta",
        converter: nullableNumberConverter,
        cssCustomProperty: false,
        default: DesignSystemDefaults.accentForegroundActiveDelta,
    })
], FASTDesignSystemProvider.prototype, "accentForegroundActiveDelta", void 0);
__decorate([
    designSystemProperty({
        attribute: "accent-foreground-focus-delta",
        converter: nullableNumberConverter,
        cssCustomProperty: false,
        default: DesignSystemDefaults.accentForegroundFocusDelta,
    })
], FASTDesignSystemProvider.prototype, "accentForegroundFocusDelta", void 0);
__decorate([
    designSystemProperty({
        attribute: "neutral-fill-rest-delta",
        converter: nullableNumberConverter,
        cssCustomProperty: false,
        default: DesignSystemDefaults.neutralFillRestDelta,
    })
], FASTDesignSystemProvider.prototype, "neutralFillRestDelta", void 0);
__decorate([
    designSystemProperty({
        attribute: "neutral-fill-hover-delta",
        converter: nullableNumberConverter,
        cssCustomProperty: false,
        default: DesignSystemDefaults.neutralFillHoverDelta,
    })
], FASTDesignSystemProvider.prototype, "neutralFillHoverDelta", void 0);
__decorate([
    designSystemProperty({
        attribute: "neutral-fill-active-delta",
        converter: nullableNumberConverter,
        cssCustomProperty: false,
        default: DesignSystemDefaults.neutralFillActiveDelta,
    })
], FASTDesignSystemProvider.prototype, "neutralFillActiveDelta", void 0);
__decorate([
    designSystemProperty({
        attribute: "neutral-fill-focus-delta",
        converter: nullableNumberConverter,
        cssCustomProperty: false,
        default: DesignSystemDefaults.neutralFillFocusDelta,
    })
], FASTDesignSystemProvider.prototype, "neutralFillFocusDelta", void 0);
__decorate([
    designSystemProperty({
        attribute: "neutral-fill-selected-delta",
        converter: nullableNumberConverter,
        cssCustomProperty: false,
        default: DesignSystemDefaults.neutralFillSelectedDelta,
    })
], FASTDesignSystemProvider.prototype, "neutralFillSelectedDelta", void 0);
__decorate([
    designSystemProperty({
        attribute: "neutral-fill-input-rest-delta",
        converter: nullableNumberConverter,
        cssCustomProperty: false,
        default: DesignSystemDefaults.neutralFillInputRestDelta,
    })
], FASTDesignSystemProvider.prototype, "neutralFillInputRestDelta", void 0);
__decorate([
    designSystemProperty({
        attribute: "neutral-fill-input-hover-delta",
        converter: nullableNumberConverter,
        cssCustomProperty: false,
        default: DesignSystemDefaults.neutralFillInputHoverDelta,
    })
], FASTDesignSystemProvider.prototype, "neutralFillInputHoverDelta", void 0);
__decorate([
    designSystemProperty({
        attribute: "neutral-fill-input-active-delta",
        converter: nullableNumberConverter,
        cssCustomProperty: false,
        default: DesignSystemDefaults.neutralFillInputActiveDelta,
    })
], FASTDesignSystemProvider.prototype, "neutralFillInputActiveDelta", void 0);
__decorate([
    designSystemProperty({
        attribute: "neutral-fill-input-focus-delta",
        converter: nullableNumberConverter,
        cssCustomProperty: false,
        default: DesignSystemDefaults.neutralFillInputFocusDelta,
    })
], FASTDesignSystemProvider.prototype, "neutralFillInputFocusDelta", void 0);
__decorate([
    designSystemProperty({
        attribute: "neutral-fill-input-selected-delta",
        converter: nullableNumberConverter,
        cssCustomProperty: false,
        default: DesignSystemDefaults.neutralFillInputSelectedDelta,
    })
], FASTDesignSystemProvider.prototype, "neutralFillInputSelectedDelta", void 0);
__decorate([
    designSystemProperty({
        attribute: "neutral-fill-stealth-rest-delta",
        converter: nullableNumberConverter,
        cssCustomProperty: false,
        default: DesignSystemDefaults.neutralFillStealthRestDelta,
    })
], FASTDesignSystemProvider.prototype, "neutralFillStealthRestDelta", void 0);
__decorate([
    designSystemProperty({
        attribute: "neutral-fill-stealth-hover-delta",
        converter: nullableNumberConverter,
        cssCustomProperty: false,
        default: DesignSystemDefaults.neutralFillStealthHoverDelta,
    })
], FASTDesignSystemProvider.prototype, "neutralFillStealthHoverDelta", void 0);
__decorate([
    designSystemProperty({
        attribute: "neutral-fill-stealth-active-delta",
        converter: nullableNumberConverter,
        cssCustomProperty: false,
        default: DesignSystemDefaults.neutralFillStealthActiveDelta,
    })
], FASTDesignSystemProvider.prototype, "neutralFillStealthActiveDelta", void 0);
__decorate([
    designSystemProperty({
        attribute: "neutral-fill-stealth-focus-delta",
        converter: nullableNumberConverter,
        cssCustomProperty: false,
        default: DesignSystemDefaults.neutralFillStealthFocusDelta,
    })
], FASTDesignSystemProvider.prototype, "neutralFillStealthFocusDelta", void 0);
__decorate([
    designSystemProperty({
        attribute: "neutral-fill-stealth-selected-delta",
        converter: nullableNumberConverter,
        cssCustomProperty: false,
        default: DesignSystemDefaults.neutralFillStealthSelectedDelta,
    })
], FASTDesignSystemProvider.prototype, "neutralFillStealthSelectedDelta", void 0);
__decorate([
    designSystemProperty({
        attribute: "neutral-fill-toggle-hover-delta",
        converter: nullableNumberConverter,
        cssCustomProperty: false,
        default: DesignSystemDefaults.neutralFillToggleHoverDelta,
    })
], FASTDesignSystemProvider.prototype, "neutralFillToggleHoverDelta", void 0);
__decorate([
    designSystemProperty({
        attribute: "neutral-fill-toggle-hover-active",
        converter: nullableNumberConverter,
        cssCustomProperty: false,
        default: DesignSystemDefaults.neutralFillToggleActiveDelta,
    })
], FASTDesignSystemProvider.prototype, "neutralFillToggleActiveDelta", void 0);
__decorate([
    designSystemProperty({
        attribute: "neutral-fill-toggle-hover-focus",
        converter: nullableNumberConverter,
        cssCustomProperty: false,
        default: DesignSystemDefaults.neutralFillToggleFocusDelta,
    })
], FASTDesignSystemProvider.prototype, "neutralFillToggleFocusDelta", void 0);
__decorate([
    designSystemProperty({
        attribute: "base-layer-luminance",
        converter: nullableNumberConverter,
        cssCustomProperty: false,
        default: DesignSystemDefaults.baseLayerLuminance,
    })
], FASTDesignSystemProvider.prototype, "baseLayerLuminance", void 0);
__decorate([
    designSystemProperty({
        attribute: "neutral-fill-card-delta",
        converter: nullableNumberConverter,
        cssCustomProperty: false,
        default: DesignSystemDefaults.neutralFillCardDelta,
    })
], FASTDesignSystemProvider.prototype, "neutralFillCardDelta", void 0);
__decorate([
    designSystemProperty({
        attribute: "neutral-foreground-hover-delta",
        converter: nullableNumberConverter,
        cssCustomProperty: false,
        default: DesignSystemDefaults.neutralForegroundHoverDelta,
    })
], FASTDesignSystemProvider.prototype, "neutralForegroundHoverDelta", void 0);
__decorate([
    designSystemProperty({
        attribute: "neutral-foreground-active-delta",
        converter: nullableNumberConverter,
        cssCustomProperty: false,
        default: DesignSystemDefaults.neutralForegroundActiveDelta,
    })
], FASTDesignSystemProvider.prototype, "neutralForegroundActiveDelta", void 0);
__decorate([
    designSystemProperty({
        attribute: "neutral-foreground-focus-delta",
        converter: nullableNumberConverter,
        cssCustomProperty: false,
        default: DesignSystemDefaults.neutralForegroundFocusDelta,
    })
], FASTDesignSystemProvider.prototype, "neutralForegroundFocusDelta", void 0);
__decorate([
    designSystemProperty({
        attribute: "neutral-divider-rest-delta",
        converter: nullableNumberConverter,
        cssCustomProperty: false,
        default: DesignSystemDefaults.neutralDividerRestDelta,
    })
], FASTDesignSystemProvider.prototype, "neutralDividerRestDelta", void 0);
__decorate([
    designSystemProperty({
        attribute: "neutral-outline-rest-delta",
        converter: nullableNumberConverter,
        cssCustomProperty: false,
        default: DesignSystemDefaults.neutralOutlineRestDelta,
    })
], FASTDesignSystemProvider.prototype, "neutralOutlineRestDelta", void 0);
__decorate([
    designSystemProperty({
        attribute: "neutral-outline-hover-delta",
        converter: nullableNumberConverter,
        cssCustomProperty: false,
        default: DesignSystemDefaults.neutralOutlineHoverDelta,
    })
], FASTDesignSystemProvider.prototype, "neutralOutlineHoverDelta", void 0);
__decorate([
    designSystemProperty({
        attribute: "neutral-outline-active-delta",
        converter: nullableNumberConverter,
        cssCustomProperty: false,
        default: DesignSystemDefaults.neutralOutlineActiveDelta,
    })
], FASTDesignSystemProvider.prototype, "neutralOutlineActiveDelta", void 0);
__decorate([
    designSystemProperty({
        attribute: "neutral-outline-focus-delta",
        converter: nullableNumberConverter,
        cssCustomProperty: false,
        default: DesignSystemDefaults.neutralOutlineFocusDelta,
    })
], FASTDesignSystemProvider.prototype, "neutralOutlineFocusDelta", void 0);
FASTDesignSystemProvider = __decorate([
    designSystemProvider({
        name: "fast-design-system-provider",
        template,
        styles,
    })
], FASTDesignSystemProvider);
export { FASTDesignSystemProvider };
//# sourceMappingURL=index.js.map