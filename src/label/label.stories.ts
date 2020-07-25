import { FluentDesignSystemProvider } from "../design-system-provider";
import Examples from "./fixtures/label.html";
import { FluentLabel } from "../label";



// Prevent tree-shaking
FluentLabel;
FluentDesignSystemProvider;

export default {
    title: "Label",
};

export const Label = () => Examples;
