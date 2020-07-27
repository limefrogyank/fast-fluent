import { FluentDesignSystemProvider } from "../design-system-provider";
import Examples from "./fixtures/details-list.html";
import { FluentDetailsList } from "../details-list";



// Prevent tree-shaking
FluentDetailsList;
FluentDesignSystemProvider;

export default {
    title: "DetailsList",
};

export const DetailsList = () => Examples;
