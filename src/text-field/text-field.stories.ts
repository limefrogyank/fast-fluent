import { FluentDesignSystemProvider } from "../design-system-provider";
import Examples from "./fixtures/text-field.html";
import { FluentTextField } from "../text-field";



// Prevent tree-shaking
FluentTextField;
FluentDesignSystemProvider;

export default {
    title: "Text field",
};

export const TextField = () => Examples;
