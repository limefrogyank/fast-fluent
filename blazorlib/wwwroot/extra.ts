//import { FluentList } from "../../src/list";
//import { html } from "@microsoft/fast-element";
interface DotNetReferenceType {
    invokeMethod<T>(methodIdentifier: string, ...args: any[]): T;
    invokeMethodAsync<T>(methodIdentifier: string, ...args: any[]): Promise<T>;
}

namespace BlazorFluentUiDetailsList {
    export function setList(listRef:HTMLElement, listArray: any[]) {
        let fluentList = listRef as any;
        if (fluentList !== undefined){
            fluentList.items = listArray;
        }
    }    
}

(<any>window)['BlazorFluentUiDetailsList'] = BlazorFluentUiDetailsList || {};

namespace BlazorFluentUiList {

    var _lastId: number = 0;
    var cachedLists: Map<number, BFUList> = new Map<number, BFUList>();

    export function initialize(component: DotNetReferenceType, scrollElement: HTMLElement, spacerBefore: HTMLElement, spacerAfter: HTMLElement, reset: boolean=false): any {

        let list: BFUList = new BFUList(component, scrollElement, spacerBefore, spacerAfter);
        cachedLists.set(list.id, list);

        const visibleRect = {
            top: 0,
            left: list.id,
            width: scrollElement.clientWidth,
            height: scrollElement.clientHeight,
            bottom: scrollElement.scrollHeight,
            right: scrollElement.scrollWidth
        };
        return visibleRect;
    }

    export function getInitialAverageHeight(id: number) : number {
        let list = cachedLists.get(id);
        if (list == null) {
            return 0;
        } else {
            return list.getInitialAverageHeight();
        }
    }

    export function removeList(id: number) {
        let list = cachedLists.get(id);
        if (list !== undefined){
            list.disconnect();
        }
        cachedLists.delete(id);
    }

    export function getViewport(scrollElement: HTMLElement) :any {
        const visibleRect = {
            top: 0,
            left: 0,
            width: scrollElement.clientWidth,
            height: scrollElement.clientHeight,
            bottom: scrollElement.scrollHeight,
            right: scrollElement.scrollWidth
        };
        return visibleRect;
    }
    
    class BFUList {
        cachedSizes: Map<string, number> = new Map<string, number>();
        averageHeight: number = 40;
        //lastDate: number;
        id: number;

        component: DotNetReferenceType;
        scrollElement: HTMLElement;
        spacerBefore: HTMLElement;
        spacerAfter: HTMLElement;

        intersectionObserver: IntersectionObserver;
        mutationObserverBefore: MutationObserver;
        mutationObserverAfter: MutationObserver;

        constructor(component: DotNetReferenceType, scrollElement: HTMLElement, spacerBefore: HTMLElement, spacerAfter: HTMLElement) {
            this.id = _lastId++;

            this.component = component;
            this.scrollElement = scrollElement;
            this.spacerBefore = spacerBefore;
            this.spacerAfter = spacerAfter;

            const rootMargin: number = 50;
            this.intersectionObserver = new IntersectionObserver((entries, observer) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting && (entry.target as HTMLElement).offsetHeight > 0) {
                        (<any>window).requestIdleCallback(() => {
                            const spacerType = entry.target === this.spacerBefore ? 'before' : 'after';
                            const visibleRect = {
                                top: entry.intersectionRect.top - entry.boundingClientRect.top,
                                left: entry.intersectionRect.left - entry.boundingClientRect.left,
                                width: entry.intersectionRect.width,
                                height: entry.intersectionRect.height,
                                bottom: this.scrollElement.scrollHeight,
                                right: this.scrollElement.scrollWidth
                            };
                            this.component.invokeMethodAsync('OnSpacerVisible', spacerType, visibleRect, this.scrollElement.offsetHeight + 2 * rootMargin, this.spacerBefore.offsetHeight, this.spacerAfter.offsetHeight);
                        });
                    }
                });
            }, {
                root: scrollElement, rootMargin: `${rootMargin}px`
            });
            this.intersectionObserver.observe(this.spacerBefore);
            this.intersectionObserver.observe(this.spacerAfter);

            // After each render, refresh the info about intersections
            this.mutationObserverBefore = new MutationObserver(mutations => {
                this.intersectionObserver.unobserve(this.spacerBefore);               
                this.intersectionObserver.observe(this.spacerBefore);                
            });
            this.mutationObserverAfter = new MutationObserver(mutations => {
                this.intersectionObserver.unobserve(this.spacerAfter);
                this.intersectionObserver.observe(this.spacerAfter);
            });
            this.mutationObserverBefore.observe(spacerBefore, { attributes: true })
            this.mutationObserverAfter.observe(spacerAfter, { attributes: true })
        }

        disconnect(): void {
            this.mutationObserverBefore.disconnect();
            this.mutationObserverAfter.disconnect();

            this.intersectionObserver.unobserve(this.spacerBefore);
            this.intersectionObserver.unobserve(this.spacerAfter);
            this.intersectionObserver.disconnect();

        }

        getInitialAverageHeight(): number {
            let calculate: boolean = false;
            let averageHeight: number = this.averageHeight;
            for (let i = 0; i < this.scrollElement.children.length; i++) {
                let item = this.scrollElement.children.item(i);
                let index = (item as HTMLDivElement).dataset.itemKey;//("data-data-item-key");
                if (index != null && !this.cachedSizes.has(index) && this.cachedSizes.get(index) != item!.clientHeight) {
                    this.cachedSizes.set(index, item!.clientHeight);
                    calculate = true;
                }
            }
            if (calculate) {
                averageHeight = [...this.cachedSizes.values()].reduce((p, c, i, a) => p + c) / this.cachedSizes.size;
                this.averageHeight = averageHeight;
            }

            return averageHeight;
        }

    }

   
    export function setList(listRef:HTMLElement, listArray: any[]){
        let fluentList = listRef as any;
        if (fluentList !== undefined){
            fluentList.items = listArray;
        }

    }    
    // export function setItemTemplate(listRef:HTMLElement, itemTemplate: string){
    //     let fluentList = listRef as any;
    //     if (fluentList !== undefined){
    //         fluentList.onRenderCell = (item,index) => html<any>`
    //         <div>
    //             item is ${x => item.value}
    //             index is ${x => index}
    //         </div>
    //     `;;
    //     }

    // }    

} 

//declare global{
    interface Window {
        BlazorFluentUiList: typeof BlazorFluentUiList
    }
//}
//window.BlazorFluentUiList = BlazorFluentUiList;


(<any>window)['BlazorFluentUiList'] = BlazorFluentUiList || {};