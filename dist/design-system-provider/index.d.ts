import { DensityOffset, DesignSystem } from "@microsoft/fast-components-styles-msft";
import { Direction } from "@microsoft/fast-web-utilities";
import { DesignSystemProvider } from "@microsoft/fast-foundation";
/**
 * The FAST DesignSystemProvider Element. Implements {@link @microsoft/fast-foundation#DesignSystemProvider},
 * {@link @microsoft/fast-foundation#DesignSystemProviderTemplate}
 *
 *
 * @public
 * @remarks
 * HTML Element: \<fast-design-system-provider\>
 */
export declare class FASTDesignSystemProvider extends DesignSystemProvider implements Omit<DesignSystem, "contrast" | "fontWeight" | "neutralForegroundDarkIndex" | "neutralForegroundLightIndex"> {
    /**
     * Used to instruct the FASTDesignSystemProvider
     * that it should not set the CSS
     * background-color and color properties
     *
     * @remarks
     * HTML boolean boolean attribute: no-paint
     */
    noPaint: boolean;
    private noPaintChanged;
    /**
     * Define design system property attributes
     */
    backgroundColor: string;
    private backgroundColorChanged;
    accentBaseColor: string;
    neutralPalette: string[];
    accentPalette: string[];
    density: DensityOffset;
    designUnit: number;
    direction: Direction;
    baseHeightMultiplier: number;
    baseHorizontalSpacingMultiplier: number;
    cornerRadius: number;
    elevatedCornerRadius: number;
    outlineWidth: number;
    focusOutlineWidth: number;
    disabledOpacity: number;
    typeRampMinus2FontSize: string;
    typeRampMinus2LineHeight: string;
    typeRampMinus1FontSize: string;
    typeRampMinus1LineHeight: string;
    typeRampBaseFontSize: string;
    typeRampBaseLineHeight: string;
    typeRampPlus1FontSize: string;
    typeRampPlus1LineHeight: string;
    typeRampPlus2FontSize: string;
    typeRampPlus2LineHeight: string;
    typeRampPlus3FontSize: string;
    typeRampPlus3LineHeight: string;
    typeRampPlus4FontSize: string;
    typeRampPlus4LineHeight: string;
    typeRampPlus5FontSize: string;
    typeRampPlus5LineHeight: string;
    typeRampPlus6FontSize: string;
    typeRampPlus6LineHeight: string;
    accentFillRestDelta: number;
    accentFillHoverDelta: number;
    accentFillActiveDelta: number;
    accentFillFocusDelta: number;
    accentFillSelectedDelta: number;
    accentForegroundRestDelta: number;
    accentForegroundHoverDelta: number;
    accentForegroundActiveDelta: number;
    accentForegroundFocusDelta: number;
    neutralFillRestDelta: number;
    neutralFillHoverDelta: number;
    neutralFillActiveDelta: number;
    neutralFillFocusDelta: number;
    neutralFillSelectedDelta: number;
    neutralFillInputRestDelta: number;
    neutralFillInputHoverDelta: number;
    neutralFillInputActiveDelta: number;
    neutralFillInputFocusDelta: number;
    neutralFillInputSelectedDelta: number;
    neutralFillStealthRestDelta: number;
    neutralFillStealthHoverDelta: number;
    neutralFillStealthActiveDelta: number;
    neutralFillStealthFocusDelta: number;
    neutralFillStealthSelectedDelta: number;
    neutralFillToggleHoverDelta: number;
    neutralFillToggleActiveDelta: number;
    neutralFillToggleFocusDelta: number;
    baseLayerLuminance: number;
    neutralFillCardDelta: number;
    neutralForegroundHoverDelta: number;
    neutralForegroundActiveDelta: number;
    neutralForegroundFocusDelta: number;
    neutralDividerRestDelta: number;
    neutralOutlineRestDelta: number;
    neutralOutlineHoverDelta: number;
    neutralOutlineActiveDelta: number;
    neutralOutlineFocusDelta: number;
}
