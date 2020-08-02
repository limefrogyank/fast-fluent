
export interface IVirtualizedData<T> {
    subSetOfItems: IndexedItem<T>[];
    numItemsToSkipBefore: number;
    numItemsToSkipAfter: number;    
    numItemsToShow: number;
}

export interface IndexedItem<T> {
    index:number;
    item:T;
}