var __read = (this && this.__read) || function (o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
    }
    catch (error) { e = { error: error }; }
    finally {
        try {
            if (r && !r.done && (m = i["return"])) m.call(i);
        }
        finally { if (e) throw e.error; }
    }
    return ar;
};
var __spread = (this && this.__spread) || function () {
    for (var ar = [], i = 0; i < arguments.length; i++) ar = ar.concat(__read(arguments[i]));
    return ar;
};
var BlazorFluentUiDetailsList;
(function (BlazorFluentUiDetailsList) {
    function setList(listRef, listArray) {
        var fluentList = listRef;
        if (fluentList !== undefined) {
            fluentList.items = listArray;
        }
    }
    BlazorFluentUiDetailsList.setList = setList;
})(BlazorFluentUiDetailsList || (BlazorFluentUiDetailsList = {}));
window['BlazorFluentUiDetailsList'] = BlazorFluentUiDetailsList || {};
var BlazorFluentUiList;
(function (BlazorFluentUiList) {
    var _lastId = 0;
    var cachedLists = new Map();
    function initialize(component, scrollElement, spacerBefore, spacerAfter, reset) {
        if (reset === void 0) { reset = false; }
        var list = new BFUList(component, scrollElement, spacerBefore, spacerAfter);
        cachedLists.set(list.id, list);
        var visibleRect = {
            top: 0,
            left: list.id,
            width: scrollElement.clientWidth,
            height: scrollElement.clientHeight,
            bottom: scrollElement.scrollHeight,
            right: scrollElement.scrollWidth
        };
        return visibleRect;
    }
    BlazorFluentUiList.initialize = initialize;
    function getInitialAverageHeight(id) {
        var list = cachedLists.get(id);
        if (list == null) {
            return 0;
        }
        else {
            return list.getInitialAverageHeight();
        }
    }
    BlazorFluentUiList.getInitialAverageHeight = getInitialAverageHeight;
    function removeList(id) {
        var list = cachedLists.get(id);
        if (list !== undefined) {
            list.disconnect();
        }
        cachedLists["delete"](id);
    }
    BlazorFluentUiList.removeList = removeList;
    function getViewport(scrollElement) {
        var visibleRect = {
            top: 0,
            left: 0,
            width: scrollElement.clientWidth,
            height: scrollElement.clientHeight,
            bottom: scrollElement.scrollHeight,
            right: scrollElement.scrollWidth
        };
        return visibleRect;
    }
    BlazorFluentUiList.getViewport = getViewport;
    var BFUList = /** @class */ (function () {
        function BFUList(component, scrollElement, spacerBefore, spacerAfter) {
            var _this = this;
            this.cachedSizes = new Map();
            this.averageHeight = 40;
            this.id = _lastId++;
            this.component = component;
            this.scrollElement = scrollElement;
            this.spacerBefore = spacerBefore;
            this.spacerAfter = spacerAfter;
            var rootMargin = 50;
            this.intersectionObserver = new IntersectionObserver(function (entries, observer) {
                entries.forEach(function (entry) {
                    if (entry.isIntersecting && entry.target.offsetHeight > 0) {
                        window.requestIdleCallback(function () {
                            var spacerType = entry.target === _this.spacerBefore ? 'before' : 'after';
                            var visibleRect = {
                                top: entry.intersectionRect.top - entry.boundingClientRect.top,
                                left: entry.intersectionRect.left - entry.boundingClientRect.left,
                                width: entry.intersectionRect.width,
                                height: entry.intersectionRect.height,
                                bottom: _this.scrollElement.scrollHeight,
                                right: _this.scrollElement.scrollWidth
                            };
                            _this.component.invokeMethodAsync('OnSpacerVisible', spacerType, visibleRect, _this.scrollElement.offsetHeight + 2 * rootMargin, _this.spacerBefore.offsetHeight, _this.spacerAfter.offsetHeight);
                        });
                    }
                });
            }, {
                root: scrollElement,
                rootMargin: rootMargin + "px"
            });
            this.intersectionObserver.observe(this.spacerBefore);
            this.intersectionObserver.observe(this.spacerAfter);
            // After each render, refresh the info about intersections
            this.mutationObserverBefore = new MutationObserver(function (mutations) {
                _this.intersectionObserver.unobserve(_this.spacerBefore);
                _this.intersectionObserver.observe(_this.spacerBefore);
            });
            this.mutationObserverAfter = new MutationObserver(function (mutations) {
                _this.intersectionObserver.unobserve(_this.spacerAfter);
                _this.intersectionObserver.observe(_this.spacerAfter);
            });
            this.mutationObserverBefore.observe(spacerBefore, { attributes: true });
            this.mutationObserverAfter.observe(spacerAfter, { attributes: true });
        }
        BFUList.prototype.disconnect = function () {
            this.mutationObserverBefore.disconnect();
            this.mutationObserverAfter.disconnect();
            this.intersectionObserver.unobserve(this.spacerBefore);
            this.intersectionObserver.unobserve(this.spacerAfter);
            this.intersectionObserver.disconnect();
        };
        BFUList.prototype.getInitialAverageHeight = function () {
            var calculate = false;
            var averageHeight = this.averageHeight;
            for (var i = 0; i < this.scrollElement.children.length; i++) {
                var item = this.scrollElement.children.item(i);
                var index = item.dataset.itemKey; //("data-data-item-key");
                if (index != null && !this.cachedSizes.has(index) && this.cachedSizes.get(index) != item.clientHeight) {
                    this.cachedSizes.set(index, item.clientHeight);
                    calculate = true;
                }
            }
            if (calculate) {
                averageHeight = __spread(this.cachedSizes.values()).reduce(function (p, c, i, a) { return p + c; }) / this.cachedSizes.size;
                this.averageHeight = averageHeight;
            }
            return averageHeight;
        };
        return BFUList;
    }());
    function setList(listRef, listArray) {
        var fluentList = listRef;
        if (fluentList !== undefined) {
            fluentList.items = listArray;
        }
    }
    BlazorFluentUiList.setList = setList;
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
})(BlazorFluentUiList || (BlazorFluentUiList = {}));
//}
//window.BlazorFluentUiList = BlazorFluentUiList;
window['BlazorFluentUiList'] = BlazorFluentUiList || {};
