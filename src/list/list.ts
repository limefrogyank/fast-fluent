import { attr, customElement, DOM, FASTElement,html, observable, Observable, ViewTemplate } from "@microsoft/fast-element";
import {ListTemplate as template} from "./list.template";
import { ListStyles as styles } from "./list.styles";
import { Async, EventGroup, IRectangle, IPage, IPageSpecification, getParent, getWindow, findIndex } from "@fluentui/react";
import { findScrollableParent } from "../utilities/scroll";

const EMPTY_RECT = {
    top: -1,
    bottom: -1,
    left: -1,
    right: -1,
    width: 0,
    height: 0,
  };

interface IPage2<T> extends IPage<T>{
    getKey?: (item: T, index?: number) => string;
    onRenderCell?: (item?: T, index?: number, isScrolling?: boolean) => ViewTemplate;
}

// Naming expensive measures so that they're named in profiles.
const _measurePageRect = (element: HTMLElement) => element.getBoundingClientRect();
const _measureSurfaceRect = _measurePageRect;
const _measureScrollRect = _measurePageRect;

interface IPageCacheItem<T> {
    page: IPage2<T>;
    pageElement?: JSX.Element;
}

interface IPageCache<T> {
    [key: string]: IPageCacheItem<T>;
}
  
interface IListState<T = any> {
    pages: IPage2<T>[];
  
    /** The last versionstamp for  */
    measureVersion?: number;
    isScrolling?: boolean;
}

const RESIZE_DELAY = 16;
const MIN_SCROLL_UPDATE_DELAY = 100;
const MAX_SCROLL_UPDATE_DELAY = 500;
const IDLE_DEBOUNCE_DELAY = 200;
// The amount of time to wait before declaring that the list isn't scrolling
const DONE_SCROLLING_WAIT = 500;
const DEFAULT_ITEMS_PER_PAGE = 10;
const DEFAULT_PAGE_HEIGHT = 30;
const DEFAULT_RENDERED_WINDOWS_BEHIND = 2;
const DEFAULT_RENDERED_WINDOWS_AHEAD = 2;
const PAGE_KEY_PREFIX = 'page-';
const SPACER_KEY_PREFIX = 'spacer-';


@customElement({
    name: "fast-fluent-list",
    template,
    styles,
    shadowOptions: {
        delegatesFocus: true,
    },
})
export class FluentList<T> extends FASTElement {

    //@observable
    public onShouldVirtualize: (list: FluentList<T>) => boolean;

    //@observable
    public getPageHeight?: (itemIndex?: number, visibleRect?: IRectangle, itemCount?: number) => number;

          /**
   * Called by the list to get the specification for a page.
   * Use this method to provide an allocation of items per page,
   * as well as an estimated rendered height for the page.
   * The list will use this to optimize virtualization.
   */
    //@observable
    public getPageSpecification?: (itemIndex?: number, visibleRect?: IRectangle) => IPageSpecification;
    
    /**
   * Method called by the list to get how many items to render per page from specified index.
   * In general, use `getPageSpecification` instead.
   */
    //@observable
    public getItemCountForPage?: ((itemIndex?: number, visibleRect?: IRectangle) => number) | undefined;

    public getKey?: (item: T, index?: number) => string;


    // @observable
    // public isScrolling?: boolean;

    @observable 
    public items:T[];
    private itemsChanged(oldValue: IListState<T>, newValue: IListState<T>) {
        this.propertyChanged(true);
    }
    // @observable
    // public measureVersion?: number; 

    /** Optional callback for monitoring when a page is added. */
    @observable
    public onPageAdded?: (page: IPage2<T>) => void;

    /** Optional callback for monitoring when a page is removed. */
    @observable
    public onPageRemoved?: (page: IPage2<T>) => void;
    /**
   * Optional callback invoked when List rendering completed.
   * This can be on initial mount or on re-render due to scrolling.
   * This method will be called as a result of changes in List pages (added or removed),
   * and after ALL the changes complete.
   * To track individual page Add / Remove use onPageAdded / onPageRemoved instead.
   * @param pages - The current array of pages in the List.
   */
    @observable
    public onPagesUpdated?: (pages: IPage2<T>[]) => void;

    @observable
    public onRenderCell?: (item?: T, index?: number, isScrolling?: boolean) => ViewTemplate;

    // @observable
    // public pages?: IPage2<T>[];
    @observable
    public state: IListState<T>;
    private stateChanged(oldValue: IListState<T>, newValue: IListState<T>) {
        if (this.stateChangedFunc)
            this.stateChangedFunc(newValue);
    }
    private stateChangedFunc : (state: IListState<T>) => void;

      /**
   * Whether to disable scroll state updates. This causes the isScrolling arg in onRenderCell to always be undefined.
   * This is a performance optimization to let List skip a render cycle by not updating its scrolling state.
   */
    @attr
    public ignoreScrollingState?: boolean;

    @attr
    public renderCount?:number;
    
    @attr
    public renderedWindowsAhead:number = 2;

    @attr
    public renderedWindowsBehind:number = 2;

    @attr
    public startIndex?:number = 0;
    
    // The visible rect that we're required to render given the current list state.
    private _requiredRect: IRectangle | null;
      
    // surface rect relative to window
    private _surfaceRect: IRectangle | undefined;

    // The visible rect that we're allowed to keep rendered. Pages outside of this rect will be removed.
    private _allowedRect: IRectangle;

    // The rect that is visible to the user
    private _visibleRect: IRectangle | undefined;

    // materialized rect around visible items, relative to surface
    private _materializedRect: IRectangle | null;

    private _async: Async;
    private _events: EventGroup;

    @observable
    _refs:Node[];

    _scrollElement: HTMLElement;
    _surface: HTMLDivElement;
    _root: HTMLDivElement;

    @observable
    private _measureVersion: number;
    private _scrollHeight: number;
    private _scrollTop: number;
    private _pageCache: IPageCache<T>;

    private _estimatedPageHeight: number;
    private _totalEstimates: number;
    private _cachedPageHeights: {
      [key: string]: {
        height: number;
        measureVersion: number;
      };
    };
    private _focusedIndex: number;
    private _hasCompletedFirstRender: boolean;

    private _requiredWindowsAhead: number;
    private _requiredWindowsBehind: number;

    constructor(){
        super();

        this.state = { pages:[]};
        this.state.isScrolling = false;

        this._async = new Async(this);
        this._events = new EventGroup(this);

        this._estimatedPageHeight = 0;
        this._totalEstimates = 0;
        this._requiredWindowsAhead = 0;
        this._requiredWindowsBehind = 0;

        // Track the measure version for everything.
        this._measureVersion = 0;

        // Ensure that scrolls are lazy updated.
        this._onAsyncScroll = this._async.debounce(this._onAsyncScroll, MIN_SCROLL_UPDATE_DELAY, {
        leading: false,
        maxWait: MAX_SCROLL_UPDATE_DELAY,
        }); 

        this._onAsyncIdle = this._async.debounce(this._onAsyncIdle, IDLE_DEBOUNCE_DELAY, {
        leading: false,
        });

        this._onAsyncResize = this._async.debounce(this._onAsyncResize, RESIZE_DELAY, {
        leading: false,
        });

        this._onScrollingDone = this._async.debounce(this._onScrollingDone, DONE_SCROLLING_WAIT, {
        leading: false,
        });

        this._cachedPageHeights = {};
        this._estimatedPageHeight = 0;
        this._focusedIndex = -1;
        this._pageCache = {};
        //this.getPageSpecification=undefined;
        this.onRenderCell = (a,b,c) => html<T>`${x=>x}`;
    }

    public connectedCallback() {
        super.connectedCallback();
        console.log("Connected callback!");
        this._updatePages();
        this._measureVersion++;
        this._scrollElement = findScrollableParent(this._root) as HTMLElement;

        this._events.on(window, 'resize', this._onAsyncResize);
        if (this._root) { 
        this._events.on(this._root, 'focus', this._onFocus, true);
        }
        console.log(this._scrollElement);
        if (this._scrollElement) {
            this._events.on(this._scrollElement, 'scroll', this._onScroll);
            this._events.on(this._scrollElement, 'scroll', this._onAsyncScroll);
        }
        
    }

    public disconnectedCallback() {
        super.disconnectedCallback();
        this._async.dispose();
        this._events.dispose();

        delete this._scrollElement;
    }

    private propertyChanged(needsReset: boolean):void {
        if (needsReset){
            this._resetRequiredWindows();
            this._requiredRect = null;
      
            this._measureVersion++;
            this._invalidatePageCache();
            this._updatePages();
            console.log("Reset pages again");
        }
        //console.log(JSON.stringify(this.items)); 


    }

    private _onFocus(ev: any): void {
        let target = ev.target as HTMLElement;
    
        while (target !== this._surface) {
          const indexString = target.getAttribute('data-list-index');
    
          if (indexString) {
            this._focusedIndex = Number(indexString);
            break;
          }
    
          target = getParent(target) as HTMLElement;
        }
      }

    public forceUpdate(): void {
        this._invalidatePageCache();
        // Ensure that when the list is force updated we update the pages first before render.
        this._updateRenderRects(true);
        this._updatePages();
        this._measureVersion++;
        
        //super.forceUpdate();
      }

    private _onAsyncResize(): void {
        this.forceUpdate();
    }
    
    private _invalidatePageCache(): void {
        this._pageCache = {};
      }

    private _onScroll(): void {
        if (!this.state.isScrolling && !this.ignoreScrollingState) {
            this.stateChangedFunc=()=>{};
            let tempState = this.state;
            tempState.isScrolling=true;
            this.state = tempState;
        }
        this._resetRequiredWindows();
        this._onScrollingDone();
      }

    private _onScrollingDone(): void {
        if (!this.ignoreScrollingState) {
            this.stateChangedFunc=()=>{};
            let tempState = this.state;
            tempState.isScrolling=false;
            this.state = tempState;
        }
        console.log("Scrolling DONE");
    }
    
    private _resetRequiredWindows(): void {
        this._requiredWindowsAhead = 0;
        this._requiredWindowsBehind = 0;
    }


    private _updatePages(): void {
        // console.log('updating pages');
    
        if (!this._requiredRect) {
          this._updateRenderRects();
        }
    
        const newListState = this._buildPages();
        const oldListPages = this.state.pages!;
    
        this._notifyPageChanges(oldListPages, newListState.pages!);
    
        this.stateChangedFunc = (state)=> {

            const finalState : IListState<T> = {measureVersion: state.measureVersion, pages: state.pages, isScrolling: state.isScrolling };
    
          // If we weren't provided with the page height, measure the pages
          if (!this.getPageHeight) {
            // If measured version is invalid since we've updated the DOM
            const heightsChanged = this._updatePageMeasurements(finalState.pages!);
    
            // On first render, we should re-measure so that we don't get a visual glitch.
            if (heightsChanged) {
              this._materializedRect = null;
              if (!this._hasCompletedFirstRender) {
                this._hasCompletedFirstRender = true;
                this._updatePages();
              } else {
                this._onAsyncScroll();
              }
            } else {
              // Enqueue an idle bump.
              this._onAsyncIdle();
            }
          } else {
            // Enqueue an idle bump
            this._onAsyncIdle();
          }
    
          // Notify the caller that rendering the new pages has completed
          if (this.onPagesUpdated) {
            this.onPagesUpdated(finalState.pages as IPage2<T>[]);
          }

        };

        this.state = newListState;
        // if (newListState.measureVersion !== undefined)
        //     this.measureVersion = newListState.measureVersion;
        // if (newListState.isScrolling !== undefined)
        //     this.isScrolling = newListState.isScrolling;
        // if (newListState.pages)
        //     this.pages = newListState.pages;
        
        //this.setState(newListState, () => {
          // Multiple updates may have been queued, so the callback will reflect all of them.
          // Re-fetch the current props and states to avoid using a stale props or state captured in the closure.
          
        //});
    }

    /**
   * Debounced method to asynchronously update the visible region on a scroll event.
   */
    private _onAsyncScroll(): void {
        this._updateRenderRects();
        console.log("Scrolling!");

        // Only update pages when the visible rect falls outside of the materialized rect.
        if (!this._materializedRect || !_isContainedWithin(this._requiredRect as IRectangle, this._materializedRect)) {
            this._updatePages();
        } else {
            // console.log('requiredRect contained in materialized', this._requiredRect, this._materializedRect);
        }
    }

    /**
     * This is an async debounced method that will try and increment the windows we render. If we can increment
     * either, we increase the amount we render and re-evaluate.
     */
    private _onAsyncIdle(): void {
        //const { renderedWindowsAhead, renderedWindowsBehind } = this.props;
        const { _requiredWindowsAhead: requiredWindowsAhead, _requiredWindowsBehind: requiredWindowsBehind } = this;
        const windowsAhead = Math.min(this.renderedWindowsAhead as number, requiredWindowsAhead + 1);
        const windowsBehind = Math.min(this.renderedWindowsBehind as number, requiredWindowsBehind + 1);

        console.log('idling', windowsBehind, windowsAhead);
        if (windowsAhead !== requiredWindowsAhead || windowsBehind !== requiredWindowsBehind) {
             

            this._requiredWindowsAhead = windowsAhead;
            this._requiredWindowsBehind = windowsBehind;
            this._updateRenderRects();
            this._updatePages();
        }

        if (this.renderedWindowsAhead! > windowsAhead || this.renderedWindowsBehind! > windowsBehind) {
            // Async increment on next tick.
            this._onAsyncIdle();
            
        }
    }

    private _updateRenderRects(forceUpdate?: boolean): void {
        
        // when not in virtualize mode, we render all items without measurement to optimize page rendering perf
        if (!this._shouldVirtualize()) {
          return;
        }
    
        let surfaceRect = this._surfaceRect || { ...EMPTY_RECT };
        const scrollHeight = this._scrollElement && this._scrollElement.scrollHeight;
        const scrollTop = this._scrollElement ? this._scrollElement.scrollTop : 0;
    
        // WARNING: EXPENSIVE CALL! We need to know the surface top relative to the window.
        // This needs to be called to recalculate when new pages should be loaded.
        // We check to see how far we've scrolled and if it's further than a third of a page we run it again.
        if (
          this._surface &&
          (forceUpdate ||
            !this.state.pages ||
            !this._surfaceRect ||
            !scrollHeight ||
            scrollHeight !== this._scrollHeight ||
            Math.abs(this._scrollTop - scrollTop) > this._estimatedPageHeight / 3)
        ) {
          surfaceRect = this._surfaceRect = _measureSurfaceRect(this._surface);
          this._scrollTop = scrollTop;
        }
    
        // If the scroll height has changed, something in the container likely resized and
        // we should redo the page heights incase their content resized.
        if (forceUpdate || !scrollHeight || scrollHeight !== this._scrollHeight) {
          this._measureVersion++;
        }
    
        this._scrollHeight = scrollHeight;
    
        // If the surface is above the container top or below the container bottom, or if this is not the first
        // render return empty rect.
        // The first time the list gets rendered we need to calculate the rectangle. The width of the list is
        // used to calculate the width of the list items.
        const visibleTop = Math.max(0, -surfaceRect.top);
        const win = getWindow(this._root);
        const visibleRect = {
          top: visibleTop,
          left: surfaceRect.left,
          bottom: visibleTop + win!.innerHeight,
          right: surfaceRect.right,
          width: surfaceRect.width,
          height: win!.innerHeight,
        };
    
        // The required/allowed rects are adjusted versions of the visible rect.
        this._requiredRect = _expandRect(visibleRect, this._requiredWindowsBehind, this._requiredWindowsAhead);
        this._allowedRect = _expandRect(visibleRect, this.renderedWindowsBehind!, this.renderedWindowsAhead!);
    
        // store the visible rect for later use.
        this._visibleRect = visibleRect;
    }

    private _updatePageMeasurements(pages: IPage2<T>[]): boolean {
        let heightChanged = false;
    
        // when not in virtualize mode, we render all the items without page measurement
        if (!this._shouldVirtualize()) {
          return heightChanged;
        }
    
        for (let i = 0; i < pages.length; i++) {
          const page = pages[i];
    
          if (page.items) {
            heightChanged = this._measurePage(page) || heightChanged;
          }
        }

        //console.log("pageHeight " + heightChanged);
        //console.log(this._cachedPageHeights);
    
        return heightChanged;
      }
    
    private _measurePage(page: IPage2<T>): boolean {
        let hasChangedHeight = false;
        // eslint-disable-next-line react/no-string-refs
        //console.log("ref length: " + this._refs.length);
        //this._refs.forEach(x=> console.log(x));
        const pageElement = this._refs.find(x=> (x as HTMLElement)?.dataset?.pageKey == page.key) as HTMLElement;
        const cachedHeight = this._cachedPageHeights[page.startIndex];
    
        // console.log('   * measure attempt', page.startIndex, cachedHeight);
        //console.log("wanted pageKey: " + page.key);
        //console.log("pageElement: " + pageElement);
        if (
          pageElement &&
          this._shouldVirtualize() &&
          (!cachedHeight || cachedHeight.measureVersion !== this._measureVersion)
        ) {
          const newClientRect = {
            width: pageElement.clientWidth,
            height: pageElement.clientHeight,
          };
    
          if (newClientRect.height || newClientRect.width) {
            hasChangedHeight = page.height !== newClientRect.height;
    
            // console.warn(' *** expensive page measure', page.startIndex, page.height, newClientRect.height);
    
            page.height = newClientRect.height;
            
    
            this._cachedPageHeights[page.startIndex] = {
              height: newClientRect.height,
              measureVersion: this._measureVersion,
            };

            this._estimatedPageHeight = Math.round(
              (this._estimatedPageHeight * this._totalEstimates + newClientRect.height) / (this._totalEstimates + 1),
            );
            
    
            this._totalEstimates++;
          }
         
        }
    
        return hasChangedHeight;
      }
    

    private _buildPages(): IListState<T> {
        //let { renderCount } = props;
        //const { items, startIndex, getPageHeight } = props;
            
        let renderCount = this._getRenderCount();
    
        const materializedRect = { ...EMPTY_RECT };
        const pages: IPage2<T>[] = [];
    
        let itemsPerPage = 1;
        let pageTop = 0;
        let currentSpacer : IPage2<T>|null = null;
        const focusedIndex = this._focusedIndex;
        const endIndex = this.startIndex! + renderCount;
        const shouldVirtualize = this._shouldVirtualize();
    
        // First render is very important to track; when we render cells, we have no idea of estimated page height.
        // So we should default to rendering only the first page so that we can get information.
        // However if the user provides a measure function, let's just assume they know the right heights.
        const isFirstRender = this._estimatedPageHeight === 0 && !this.getPageHeight;
    
        const allowedRect = this._allowedRect;
    
        //console.log("s " + this.startIndex + " e " + endIndex);
        for (let itemIndex = this.startIndex!; itemIndex < endIndex; itemIndex += itemsPerPage) {
            //console.log(itemIndex);
            const pageSpecification = this._getPageSpecification(itemIndex, allowedRect);
            const pageHeight = pageSpecification.height;
            const pageData = pageSpecification.data;
            const key = pageSpecification.key;
        
            itemsPerPage = pageSpecification.itemCount;
        
            const pageBottom = pageTop + pageHeight - 1;
        
            const isPageRendered =
                findIndex(this.state.pages as IPage2<T>[], (page: IPage2<T>) => !!page.items && page.startIndex === itemIndex) >
                -1;
            const isPageInAllowedRange = !allowedRect || (pageBottom >= allowedRect.top && pageTop <= allowedRect.bottom!);
            const isPageInRequiredRange =
                !this._requiredRect || (pageBottom >= this._requiredRect.top && pageTop <= this._requiredRect.bottom!);
            const isPageVisible =
                (!isFirstRender && (isPageInRequiredRange || (isPageInAllowedRange && isPageRendered))) || !shouldVirtualize;
            const isPageFocused = focusedIndex >= itemIndex && focusedIndex < itemIndex + itemsPerPage;
            const isFirstPage = itemIndex === this.startIndex;
        
            // console.log('building page', itemIndex, 'pageTop: ' + pageTop, 'inAllowed: ' +
            // isPageInAllowedRange, 'inRequired: ' + isPageInRequiredRange);
        
            // Only render whats visible, focused, or first page,
            // or when running in fast rendering mode (not in virtualized mode), we render all current items in pages
            if (isPageVisible || isPageFocused || isFirstPage) {
                if (currentSpacer) {
                    pages.push(currentSpacer);
                    currentSpacer = null;
                }
    
                const itemsInPage = Math.min(itemsPerPage, endIndex - itemIndex);
                const newPage = this._createPage(
                    key,
                    this.items!.slice(itemIndex, itemIndex + itemsInPage),
                    itemIndex,
                    undefined,
                    undefined,
                    pageData,
                );
        
                newPage.top = pageTop;
                newPage.height = pageHeight;
                
                if (this._visibleRect && this._visibleRect.bottom) {
                    newPage.isVisible = pageBottom >= this._visibleRect.top && pageTop <= this._visibleRect.bottom;
                }
        
                pages.push(newPage);
        
                if (isPageInRequiredRange && this._allowedRect) {
                    _mergeRect(materializedRect, {
                        top: pageTop,
                        bottom: pageBottom,
                        height: pageHeight,
                        left: allowedRect.left,
                        right: allowedRect.right,
                        width: allowedRect.width,
                    });
                }
            } else {
                if (!currentSpacer) {
                    currentSpacer = this._createPage(
                        SPACER_KEY_PREFIX + itemIndex,
                        undefined,
                        itemIndex,
                        0,
                        undefined,
                        pageData,
                        true /*isSpacer*/,
                    );
                }
                currentSpacer.height = (currentSpacer.height || 0) + (pageBottom - pageTop) + 1;
                currentSpacer.itemCount += itemsPerPage;
          }
          pageTop += pageBottom - pageTop + 1;
    
            // in virtualized mode, we render need to render first page then break and measure,
            // otherwise, we render all items without measurement to make rendering fast
            if (isFirstRender && shouldVirtualize) {
                break;
            }
        }
    
        if (currentSpacer) {
            currentSpacer.key = SPACER_KEY_PREFIX + 'end';
            pages.push(currentSpacer);
        }
    
        this._materializedRect = materializedRect;
    
        // console.log('materialized: ', materializedRect);
        return {
            pages: pages,
            measureVersion: this._measureVersion,
        };
    }

    private _createPage(
        pageKey: string | undefined,
        items: any[] | undefined,
        startIndex: number = -1,
        count: number = items ? items.length : 0,
        style: React.CSSProperties = {},
        data?: any,
        isSpacer?: boolean,
      ): IPage2<T> {
        pageKey = pageKey || PAGE_KEY_PREFIX + startIndex;
        const cachedPage = this._pageCache[pageKey];
        if (cachedPage && cachedPage.page) {
          return cachedPage.page;
        }
    
        return {
          key: pageKey,
          startIndex: startIndex,
          itemCount: count,
          items: items,
          style: style,
          top: 0,
          height: 0,
          data: data,
          isSpacer: isSpacer || false,
          getKey: this.getKey,
          onRenderCell:this.onRenderCell
        };
      }

    private _notifyPageChanges(oldPages: IPage2<T>[], newPages: IPage2<T>[]): void {
        
        // if (this.onPageAdded || this.onPageRemoved) {
        //     const renderedIndexes: {
        //     [index: number]: IPage2<T>;
        //     } = {};

        //     for (const page of oldPages) {
        //     if (page.items) {
        //         renderedIndexes[page.startIndex] = page;
        //     }
        //     }

        //     for (const page of newPages) {
        //     if (page.items) {
        //         if (!renderedIndexes[page.startIndex]) {
        //         this._onPageAdded(page);
        //         } else {
        //         delete renderedIndexes[page.startIndex];
        //         }
        //     }
        //     }

        //     for (const index in renderedIndexes) {
        //     if (renderedIndexes.hasOwnProperty(index)) {
        //         this._onPageRemoved(renderedIndexes[index]);
        //     }
        //     }
        // }
    }
    
    /** Called when a page has been added to the DOM. */
    private _onPageAdded(page: IPage2<T>): void {        
        if (this.onPageAdded) {
            this.onPageAdded(page);
        }
    }

    /** Called when a page has been removed from the DOM. */
    private _onPageRemoved(page: IPage2<T>): void {
        if (this.onPageRemoved) {
            this.onPageRemoved(page);
        }
    }

    private _shouldVirtualize(): boolean {
        return !this.onShouldVirtualize || this.onShouldVirtualize(this);
    }
    
    private _getRenderCount(): number {
        return this.renderCount === undefined ? (this.items ? this.items.length - this.startIndex! : 0) : this.renderCount;
    }

    private _getPageSpecification(
            itemIndex: number,
            visibleRect: IRectangle,
        ): {
            // These return values are now no longer optional.
            itemCount: number;
            height: number;
            data?: any;
            key?: string;
        } {
        
        if (this.getPageSpecification !== undefined) {
            console.log("got page spec");
            const pageData = this.getPageSpecification(itemIndex, visibleRect);
        
            const { itemCount = this._getItemCountForPage(itemIndex, visibleRect) } = pageData;
        
            const { height = this._getPageHeight(itemIndex, visibleRect, itemCount) } = pageData;
        
            return {
                itemCount: itemCount,
                height: height,
                data: pageData.data,
                key: pageData.key,
            };
        } else {
            const itemCount = this._getItemCountForPage(itemIndex, visibleRect);
                //console.log("ItemCount " + itemCount);
            return {
                itemCount: itemCount,
                height: this._getPageHeight(itemIndex, visibleRect, itemCount),
            };
        }
    }

      /**
   * Get the pixel height of a give page. Will use the props getPageHeight first, and if not provided, fallback to
   * cached height, or estimated page height, or default page height.
   */
    private _getPageHeight(itemIndex: number, visibleRect: IRectangle, itemsPerPage: number): number {
        // if (this.getPageHeight) {
        //     return this.getPageHeight(itemIndex, visibleRect, itemsPerPage);
        // } else {
            const cachedHeight = this._cachedPageHeights[itemIndex];

            return cachedHeight ? cachedHeight.height : this._estimatedPageHeight || DEFAULT_PAGE_HEIGHT;
        // }
    }

    private _getItemCountForPage(itemIndex: number, visibileRect: IRectangle): number {

        // const itemsPerPage = this.getItemCountForPage
        //     ? this.getItemCountForPage(itemIndex, visibileRect)
        //     : DEFAULT_ITEMS_PER_PAGE;
        const itemsPerPage = undefined;

        
        return itemsPerPage ? itemsPerPage : DEFAULT_ITEMS_PER_PAGE;
    }

}

function _expandRect(rect: IRectangle, pagesBefore: number, pagesAfter: number): IRectangle {
    const top = rect.top - pagesBefore * rect.height;
    const height = rect.height + (pagesBefore + pagesAfter) * rect.height;
  
    return {
      top: top,
      bottom: top + height,
      height: height,
      left: rect.left,
      right: rect.right,
      width: rect.width,
    };
}

function _isContainedWithin(innerRect: IRectangle, outerRect: IRectangle): boolean {
    return (
        innerRect.top >= outerRect.top &&
        innerRect.left >= outerRect.left &&
        innerRect.bottom! <= outerRect.bottom! &&
        innerRect.right! <= outerRect.right!
    );
}
  
function _mergeRect(targetRect: IRectangle, newRect: IRectangle): IRectangle {
    targetRect.top = newRect.top < targetRect.top || targetRect.top === -1 ? newRect.top : targetRect.top;
    targetRect.left = newRect.left < targetRect.left || targetRect.left === -1 ? newRect.left : targetRect.left;
    targetRect.bottom =
        newRect.bottom! > targetRect.bottom! || targetRect.bottom === -1 ? newRect.bottom : targetRect.bottom;
    targetRect.right = newRect.right! > targetRect.right! || targetRect.right === -1 ? newRect.right : targetRect.right;
    targetRect.width = targetRect.right! - targetRect.left + 1;
    targetRect.height = targetRect.bottom! - targetRect.top + 1;

    return targetRect;
}