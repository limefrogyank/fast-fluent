import { FASTDesignSystemProvider } from "@microsoft/fast-components-msft";
import Examples from "./fixtures/text-field.html";
import { FluentTextField } from "../text-field";
// Prevent tree-shaking
FluentTextField;
FASTDesignSystemProvider;
export default {
    title: "Text field",
};
export const TextField = () => Examples;
//# sourceMappingURL=text-field.stories.js.map