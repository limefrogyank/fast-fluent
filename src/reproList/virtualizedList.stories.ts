import { FluentDesignSystemProvider } from "../design-system-provider";
import { html } from "@microsoft/fast-element";
import Examples from "./fixtures/virtualizedList.html";
import { VirtualizedList } from "./virtualizedList";



// Prevent tree-shaking
VirtualizedList;
FluentDesignSystemProvider;

export default {
    title: "VirtualizedList",
};
  
export const Virtualized_List = () => {  
       return Examples;
};
