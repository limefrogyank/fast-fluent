import { FASTDesignSystemProvider } from "@microsoft/fast-components-msft";
import Examples from "./fixtures/label.html";
import { FluentLabel } from "../label";
// Prevent tree-shaking
FluentLabel;
FASTDesignSystemProvider;
export default {
    title: "Label",
};
export const Label = () => Examples;
//# sourceMappingURL=label.stories.js.map