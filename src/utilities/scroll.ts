import {getDocument,getWindow} from "@fluentui/react";

export const DATA_IS_SCROLLABLE_ATTRIBUTE = 'data-is-scrollable';

export function findScrollableParent(startingElement: HTMLElement | null): HTMLElement | Window | undefined | null {
    let el: HTMLElement | Window | undefined | null = startingElement;
    const doc = getDocument(startingElement)!;
  
    // First do a quick scan for the scrollable attribute.
    while (el && el !== doc.body) {
      if (el.getAttribute(DATA_IS_SCROLLABLE_ATTRIBUTE) === 'true') {
        return el;
      }
      if (el.parentElement !== null){
        el = el.parentElement;
      } else{
          el = (el.getRootNode() as ShadowRoot).host as HTMLElement;
      }
    }
  
    // If we haven't found it, the use the slower method: compute styles to evaluate if overflow is set.
    el = startingElement;
  
    while (el && el !== doc.body) {
      if (el.getAttribute(DATA_IS_SCROLLABLE_ATTRIBUTE) !== 'false') {
        const computedStyles = getComputedStyle(el);
        let overflowY = computedStyles ? computedStyles.getPropertyValue('overflow-y') : '';
  
        if (overflowY && (overflowY === 'scroll' || overflowY === 'auto')) {
          return el;
        }
      }
  
      el = el.parentElement;
    }
  
    // Fall back to window scroll.
    if (!el || el === doc.body) {
      el = getWindow(startingElement);
    }
  
    return el;
  }