import { css, customElement, FASTElement,html, observable, ref, repeat } from "@microsoft/fast-element";
import { display } from "@microsoft/fast-foundation";

export interface IVirtualizedData {
    subSetOfItems: any[];
    numItemsToSkipBefore: number;
    numItemsToSkipAfter: number;    
    numItemsToShow: number;
}

const listTemplate = html<VirtualizedList>`
    <template>
        <div role="list" style="overflow-y:hidden;height:100%;width:100%;">
            <div ${ref('scrollElement')} style="overflow-y:auto;height:100%;width:100%;">
                <div ${ref('spacerBefore')} class="spacer" style="height:${x => x.virtualizedData.numItemsToSkipBefore * x.averageHeight}px;"></div> 
                ${repeat((x) => x.virtualizedData.subSetOfItems, html<any>`
                    <div role='listitem'
                        style="height:50px;">
                        ${(x,c)=>x }
                    </div>
                `)}
                <div ${ref('spacerAfter')} class="spacer" style="height:${x => x.virtualizedData.numItemsToSkipAfter * x.averageHeight}px;"></div> 
            </div>
        </div>
    </template>
`;

const listStyles = css`
    :host {
        height:100%;
        overflow-y:hidden;
        width:100%;
    }
`;

@customElement({
    name: "fast-virtualized-list",
    template: listTemplate,
    styles: listStyles,
    shadowOptions: {
        delegatesFocus: true,
    },
})
export class VirtualizedList extends FASTElement {
   
    public getKey?: (item: any, index?: number) => string;

    @observable 
    public items:any[];
    private itemsChanged(oldValue: any[], newValue: any[]) {
         this.propertyChanged(true);
    }
  
    @observable
    averageHeight: number = 50;

    intersectionObserver: IntersectionObserver;
    mutationObserverBefore: MutationObserver;
    mutationObserverAfter: MutationObserver;
    spacerBefore: HTMLDivElement;
    spacerAfter: HTMLDivElement;
    scrollElement: HTMLElement;
    itemCountMargin:number = 20;

    @observable
    virtualizedData: IVirtualizedData = {subSetOfItems:[], numItemsToShow:20, numItemsToSkipAfter:0,numItemsToSkipBefore:0};
   

    _surface: HTMLDivElement;
    _root: HTMLDivElement;

    constructor(){
        super();
    }

    public connectedCallback() {
        super.connectedCallback();
        
        this.intersectionObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) {
                    return;
                }
       
                const containerSize = entry.rootBounds?.height;
                if (entry.target === this.spacerBefore) {
                    this.onSpacerTrigger('before', entry.intersectionRect.top - entry.boundingClientRect.top, containerSize); 
                } else if (entry.target === this.spacerAfter) {
                    this.onSpacerTrigger('after', entry.boundingClientRect.bottom - entry.intersectionRect.bottom, containerSize);
                } else {
                    throw new Error('Unknown intersection target');
                }
            
            });
        }, {
            root: this.scrollElement, rootMargin: '20px'
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

        this.mutationObserverBefore.observe(this.spacerBefore, { attributes: true });
        this.mutationObserverAfter.observe(this.spacerAfter, { attributes: true });

        let array: any[] = [];
        for (var i=0; i<5000; i++){
            array.push(i);
        }
        this.items = array;

    }

    private onSpacerTrigger(spacerType: 'before'|'after', spacerSize:number, containerSize:number|undefined){
        let itemCount = this.items !== undefined ? this.items.length : 0;
        let numItemsToShow = Math.ceil(containerSize!/this.averageHeight) + 2;                    
        numItemsToShow = Math.max(0, Math.min(numItemsToShow, itemCount));

        if (spacerType == "before" )
        {            
            let numItemsToSkipBefore = Math.max(0, Math.floor(spacerSize / this.averageHeight) - 1);
            let numItemsToSkipAfter =  Math.max(0,itemCount - numItemsToShow - numItemsToSkipBefore);
            
            this.changeSubset(numItemsToShow, numItemsToSkipBefore, this.virtualizedData.subSetOfItems);

            let newVirtdata : IVirtualizedData = {
                subSetOfItems: this.virtualizedData.subSetOfItems,
                numItemsToSkipBefore:numItemsToSkipBefore,
                numItemsToShow:numItemsToShow,
                numItemsToSkipAfter:numItemsToSkipAfter
            };
            if (newVirtdata.numItemsToSkipBefore != this.virtualizedData.numItemsToSkipBefore ||
                newVirtdata.numItemsToSkipAfter != this.virtualizedData.numItemsToSkipAfter ||
                newVirtdata.numItemsToShow != this.virtualizedData.numItemsToShow){
                 
                    this.virtualizedData = newVirtdata;
              }
        }
        else if (spacerType == "after" )
        {
            let numItemsToSkipAfter = Math.max(0, Math.floor(spacerSize / this.averageHeight) - 1);
            let numItemsToSkipBefore = Math.max(0, itemCount - numItemsToShow - numItemsToSkipAfter);

            this.changeSubset(numItemsToShow, numItemsToSkipBefore, this.virtualizedData.subSetOfItems);
            let newVirtdata : IVirtualizedData = {
                subSetOfItems: this.virtualizedData.subSetOfItems,
                numItemsToSkipBefore:numItemsToSkipBefore,
                numItemsToShow:numItemsToShow,
                numItemsToSkipAfter:numItemsToSkipAfter
            };
            
            if (newVirtdata.numItemsToSkipBefore != this.virtualizedData.numItemsToSkipBefore ||
                newVirtdata.numItemsToSkipAfter != this.virtualizedData.numItemsToSkipAfter ||
                newVirtdata.numItemsToShow != this.virtualizedData.numItemsToShow){

                    this.virtualizedData = newVirtdata;
              }
        }
    }

    private changeSubset(totalToTake:number, numberToSkipFirst:number, subset:any[]){
        
        if (this.items === undefined){
            return;
        }
        if (subset.length == 0 && this.items !== undefined) {
            var itemsToAdd = this.items.slice(numberToSkipFirst, numberToSkipFirst + totalToTake)
            subset.push(...itemsToAdd);
        }
        // before
        let currentStartIndex = this.items.indexOf(subset[0]);
        if (numberToSkipFirst > currentStartIndex){
            //need to remove items from subset start
            subset.splice(0,numberToSkipFirst - currentStartIndex);
        } else if (numberToSkipFirst < currentStartIndex) {
            //need to add more items to subset start
            subset.splice(0,0, ...this.items.slice(numberToSkipFirst, currentStartIndex ));
        }
        // after
        if (subset.length > totalToTake){
            //too many on subset... truncate it
            subset.splice(totalToTake, subset.length - totalToTake);
        } else if (subset.length < totalToTake){
            //not enough, need more from the original array
            subset.push(...this.items.slice(numberToSkipFirst + subset.length, numberToSkipFirst + totalToTake));
        }
    }

    private initialListDrawing(){

        let subSetOfItems: any[];
        let numItemsToShow = 0;
        let numItemsToSkipAfter = 0;
        if (this.items != undefined) {
            subSetOfItems = this.items.slice(0, Math.min(this.items.length, 20));
            numItemsToShow = Math.min(this.items.length, 20);
            numItemsToSkipAfter = Math.max(0, this.items.length - 20);
        } else{
            subSetOfItems = [];
        }
        
        let newVirtdata : IVirtualizedData = {
          subSetOfItems: subSetOfItems,
          numItemsToSkipBefore:0,
          numItemsToShow: numItemsToShow,
          numItemsToSkipAfter: numItemsToSkipAfter
        };
        this.virtualizedData = newVirtdata;
    }

    public disconnectedCallback() {
        super.disconnectedCallback();
    }

    private propertyChanged(needsReset: boolean):void {
        if (needsReset){
            this.initialListDrawing();
        }
    }

}