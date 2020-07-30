
export interface IVirtualizedData<T> {
    subSetOfItems: T[];
    numItemsToSkipBefore: number;
    numItemsToSkipAfter: number;    
    numItemsToShow: number;
}
