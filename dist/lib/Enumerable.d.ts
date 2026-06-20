/**
 * wrapper class over iterable instances that exposes the methods usually found in .NET LINQ
 * @template T
 */
declare class Enumerable<T> implements Iterable<T> {
    /** @internal */
    protected _src: IterableType<T>;
    /** @internal */
    protected _generator: () => Iterator<T>;
    /** @internal */
    protected _canSeek: boolean;
    /** @internal */
    protected _count: null | (() => number);
    /** @internal */
    protected _tryGetAt: null | ((index: number) => {
        value: T;
    } | null);
    /** @internal */
    protected _useQuickSort: boolean;
    /** @internal */
    _wasIterated: boolean;
    /**
     * Do not use directly - use the static 'from' method
     * @param src
     */
    protected constructor(src: IterableType<T>);
    /**
     * wraps an iterable item into an Enumerable if it's not already one
     * @template T
     * @param iterable
     * @returns from
     */
    static from<T>(iterable: IterableType<T>): Enumerable<T>;
    /**
     * returns an empty Enumerable
     * @template T
     * @returns empty
     */
    static empty<T>(): Enumerable<T>;
    /**
     * generates a sequence of integer numbers within a specified range.
     * @param start
     * @param count
     * @returns range
     */
    static range(start: number, count: number): Enumerable<number>;
    /**
     * generates a sequence that contains one repeated value
     * @template T
     * @param item
     * @param count
     * @returns repeat
     */
    static repeat<T>(item: T, count: number): Enumerable<T>;
    /**
     * the Enumerable instance exposes the same iterator as the wrapped iterable or generator function
     * @returns [symbol.iterator]
     */
    [Symbol.iterator](): Iterator<T>;
    /**
     * Determines whether the Enumerable can seek (lookup an item by index)
     * @returns
     */
    canSeek(): boolean;
    /**
     * Gets the number of items in the enumerable
     * or throws an error if it needs to be enumerated to get it
     */
    get length(): number;
    /**
     * Concatenates two sequences by appending iterable to the existing one
     * @param iterable
     * @returns concat
     */
    concat(iterable: IterableType<T>): Enumerable<T>;
    /**
     * Returns the number of items in the Enumerable, even if it has to enumerate all items to do it
     * @returns count
     */
    count(): number;
    /**
     * Returns distinct elements from a sequence.
     * WARNING: using a comparer makes this slower. Not specifying it uses a Set to determine distinctiveness.
     * @param [equalityComparer]
     * @returns distinct
     */
    distinct(equalityComparer?: IEqualityComparer<T>): Enumerable<T>;
    /**
     * Returns the element at a specified index in a sequence
     * @param index
     * @returns at
     */
    elementAt(index: number): T;
    /**
     * Returns the element at a specified index in a sequence
     * or undefined if the index is out of range.
     * @param index
     * @returns at or default
     */
    elementAtOrDefault(index: number): T | undefined;
    /**
     * Returns the first element of a sequence
     * @returns first
     */
    first(): T;
    /**
     * Returns the first element of a sequence, or undefined if no element is found
     * @returns or default
     */
    firstOrDefault(): T | undefined;
    /**
     * Returns the last element of a sequence
     * @returns last
     */
    last(): T;
    /**
     * Returns the last element of a sequence, or undefined if no element is found
     * @returns or default
     */
    lastOrDefault(): T | undefined;
    /**
     * Returns the count, minimum and maximum value in a sequence of values.
     * A custom function can be used to establish order (the result 0 means equal, 1 means larger, -1 means smaller)
     * @param [comparer]
     * @returns stats
     */
    stats(comparer?: IComparer<T>): {
        count: number;
        min?: T;
        max?: T;
    };
    /**
     *  Returns the minimum value in a sequence of values.
     *  A custom function can be used to establish order (the result 0 means equal, 1 means larger, -1 means smaller)
     * @param [comparer]
     * @returns min
     */
    min(comparer?: IComparer<T>): T | undefined;
    /**
     *  Returns the maximum value in a sequence of values.
     *  A custom function can be used to establish order (the result 0 means equal, 1 means larger, -1 means smaller)
     * @param [comparer]
     * @returns max
     */
    max(comparer?: IComparer<T>): T | undefined;
    /**
     * Projects each element of a sequence into a new form
     * (equivalent to Javascript map)
     * @template TResult
     * @param selector
     * @returns select
     */
    select<TResult>(selector: ISelector<T, TResult>): Enumerable<TResult>;
    /**
     * Bypasses a specified number of elements in a sequence and then returns an Enumerable of the remaining elements
     * @param nr
     * @returns skip
     */
    skip(nr: number): Enumerable<T>;
    /**
     * Takes start elements, ignores howmany elements, continues with the new items and continues with the original enumerable
     * Equivalent to the value of an array after performing splice on it with the same parameters
     * @param start
     * @param howmany
     * @param newItems
     * @returns splice
     */
    splice(start: number, howmany: number, ...newItems: T[]): Enumerable<T>;
    /**
     * Computes the sum of a sequence of numeric values
     * @returns sum
     */
    sum(): number | undefined;
    /**
     * Computes the sum and count of a sequence of numeric values
     * @returns and count
     */
    sumAndCount(): {
        sum: number;
        count: number;
    };
    /**
     * Returns a specified number of contiguous elements from the start of a sequence
     * @param nr
     * @returns take
     */
    take(nr: number): Enumerable<T>;
    /**
     * Creates an array from an Enumerable
     * @returns array
     */
    toArray(): T[];
    /**
     * Similar to toArray, but returns a seekable Enumerable (itself if already seekable) that can do count and elementAt without iterating
     * @returns list
     */
    toList(): Enumerable<T>;
    /**
     * Filters a sequence of values based on a predicate
     * (equivalent to Javascript filter)
     * @param condition
     * @returns where
     */
    where(condition: IFilter<T>): Enumerable<T>;
    /**
     * Applies an accumulator function over a sequence.
     * The specified seed value is used as the initial accumulator value, and the specified function is used to select the result value.
     * (equivalent to Javascript reduce)
     * @template TAcc
     * @param accumulator
     * @param aggregator
     * @returns aggregate
     */
    aggregate<TAcc>(accumulator: TAcc, aggregator: (acc: TAcc, item: T) => TAcc): TAcc;
    /**
     * Determines whether all elements of a sequence satisfy a condition.
     * @param condition
     * @returns true if all
     */
    all(condition: IFilter<T>): boolean;
    /**
     * Determines whether any element of a sequence exists or satisfies a condition.
     * @param condition
     * @returns true if any
     */
    any(condition: IFilter<T>): boolean;
    /**
     * Appends a value to the end of the sequence
     * @param item
     * @returns append
     */
    append(item: T): Enumerable<T>;
    /**
     * Computes the average of a sequence of numeric values
     * @returns average
     */
    average(): number | undefined;
    /**
     * Returns itself
     * @returns enumerable
     */
    asEnumerable(): Enumerable<T>;
    /**
     * Checks the elements of a sequence based on their type
     *  If type is a string, it will check based on typeof, else it will use instanceof.
     *  Throws if types are different.
     * @param type
     * @returns cast
     */
    cast(type: any): Enumerable<T>;
    /**
     * Determines whether a sequence contains a specified element.
     * A custom function can be used to determine equality between elements.
     * @param item
     * @param [equalityComparer]
     * @returns true if contains
     */
    contains(item: T, equalityComparer?: IEqualityComparer<T>): boolean;
    /**
     * Not implemented
     * @returns if empty
     */
    defaultIfEmpty(): never;
    /**
     * Produces the set difference of two sequences
     * WARNING: using the comparer is slower
     * @param iterable
     * @param [equalityComparer]
     * @returns except
     */
    except(iterable: IterableType<T>, equalityComparer?: IEqualityComparer<T>): Enumerable<T>;
    /**
     * Produces the set intersection of two sequences.
     *  WARNING: using a comparer is slower
     * @param iterable
     * @param [equalityComparer]
     * @returns intersect
     */
    intersect(iterable: IterableType<T>, equalityComparer?: IEqualityComparer<T>): Enumerable<T>;
    /**
     * Same as count
     * @returns count
     */
    longCount(): number;
    /**
     * Filters the elements of a sequence based on their type
     * If type is a string, it will filter based on typeof, else it will use instanceof
     * @param type
     * @returns type
     */
    ofType(type: any): Enumerable<T>;
    /**
     * Adds a value to the beginning of the sequence.
     * @param item
     * @returns prepend
     */
    prepend(item: T): Enumerable<T>;
    /**
     * Inverts the order of the elements in a sequence
     * @returns reverse
     */
    reverse(): Enumerable<T>;
    /**
     * Projects each element of a sequence to an iterable and flattens the resulting sequences into one sequence
     * @template TResult
     * @param [selector]
     * @returns many
     */
    selectMany<TResult>(selector?: ISelector<T, Iterable<TResult>>): Enumerable<TResult>;
    /**
     * Determines whether two sequences are equal and in the same order according to an equality comparer
     * @param iterable
     * @param [equalityComparer]
     * @returns true if equal
     */
    sequenceEqual(iterable: IterableType<T>, equalityComparer?: IEqualityComparer<T>): boolean;
    /**
     * Returns the single element of a sequence and throws if it doesn't have exactly one
     * @returns single
     */
    single(): T;
    /**
     * Returns the single element of a sequence or undefined if none found. It throws if the sequence contains multiple items
     * @returns or default
     */
    singleOrDefault(): T | undefined;
    /**
     * Selects the elements starting at the given start argument, and ends at, but does not include, the given end argument
     * @param [start]
     * @param [end]
     * @returns slice
     */
    slice(start?: number, end?: number): Enumerable<T>;
    /**
     * Returns a new enumerable collection that contains the elements from source with the last nr elements of the source collection omitted
     * @param nr
     * @returns last
     */
    skipLast(nr: number): Enumerable<T>;
    /**
     * Bypasses elements in a sequence as long as a specified condition is true and then returns the remaining elements.
     * @param condition
     * @returns while
     */
    skipWhile(condition: IFilter<T>): Enumerable<T>;
    /**
     * Returns a new enumerable collection that contains the last nr elements from source
     * @param nr
     * @returns last
     */
    takeLast(nr: number): Enumerable<T>;
    /**
     * Returns elements from a sequence as long as a specified condition is true, and then skips the remaining elements
     * @param condition
     * @returns while
     */
    takeWhile(condition: IFilter<T>): Enumerable<T>;
    /**
     * Not implemented (use toMap)
     * @returns dictionary
     */
    toDictionary(): never;
    /**
     * Creates a map from an Enumerable based on a key function and a value function
     * @template TKey
     * @template TResult
     * @param keySelector
     * @param valueSelector
     * @returns map
     */
    toMap<TKey, TResult>(keySelector: ISelector<T, TKey>, valueSelector: ISelector<T, TResult>): Map<TKey, TResult>;
    /**
     * Creates a map from an Enumerable based on a key function and the value from the Enumerable
     * @template TKey
     * @template TResult
     * @param keySelector
     * @returns map
     */
    toMap<TKey>(keySelector: ISelector<T, TKey>): Map<TKey, T>;
    /**
     * Creates an object from an enumerable
     * @param keySelector
     * @param [valueSelector]
     * @returns object
     */
    toObject(keySelector: ISelector<T, string>, valueSelector?: ISelector<T, any>): {
        [key: string]: any;
    };
    /**
     * Not implemented (use toSet)
     * @returns hash set
     */
    toHashSet(): never;
    /**
     * Creates a set from an enumerable
     * @returns set
     */
    toSet(): Set<T>;
    /**
     * Produces the set union of two sequences
     * @param iterable
     * @param [equalityComparer]
     * @returns union
     */
    union(iterable: IterableType<T>, equalityComparer?: IEqualityComparer<T>): Enumerable<T>;
    /**
     * Returns a randomized sequence of items from an initial source
     * @returns shuffle
     */
    shuffle(): Enumerable<T>;
    /**
     * Implements random reservoir sampling of k items, with the option to specify a maximum limit for the items
     * @param k
     * @param [limit]
     * @returns sample
     */
    randomSample(k: number, limit?: number): Enumerable<T>;
    /**
     * Returns the distinct values based on a hashing function
     * @template TResult
     * @param hashFunc
     * @returns by hash
     */
    distinctByHash<TResult>(hashFunc: ISelector<T, TResult>): Enumerable<T>;
    /**
     * Returns the values that have different hashes from the items of the iterable provided
     * @template TResult
     * @param iterable
     * @param hashFunc
     * @returns by hash
     */
    exceptByHash<TResult>(iterable: IterableType<T>, hashFunc: ISelector<T, TResult>): Enumerable<T>;
    /**
     * Returns the values that have the same hashes as items of the iterable provided
     * @template TResult
     * @param iterable
     * @param hashFunc
     * @returns by hash
     */
    intersectByHash<TResult>(iterable: IterableType<T>, hashFunc: ISelector<T, TResult>): Enumerable<T>;
    /**
     * returns the index of a value in an ordered enumerable or false if not found
     * WARNING: use the same comparer as the one used in the ordered enumerable. The algorithm assumes the enumerable is already sorted.
     * @param value
     * @param [comparer]
     * @returns search
     */
    binarySearch(value: T, comparer?: IComparer<T>): number | boolean;
    /**
     * Joins each item of the enumerable with previous items from the same enumerable
     * @template TResult
     * @param offset
     * @param zipper
     * @returns lag
     */
    lag<TResult>(offset: number, zipper: (item1: T, item2?: T) => TResult): Enumerable<TResult>;
    /**
     * Joins each item of the enumerable with previous items from the same enumerable
     * @param offset
     * @returns lag
     */
    lag(offset: number): Enumerable<[T, T | undefined]>;
    /**
     * Joins each item of the enumerable with next items from the same enumerable
     * @template TResult
     * @param offset
     * @param zipper
     * @returns lead
     */
    lead<TResult>(offset: number, zipper: (item1: T, item2?: T) => TResult): Enumerable<TResult>;
    /**
     * Joins each item of the enumerable with next items from the same enumerable
     * @param offset
     * @returns lead
     */
    lead(offset: number): Enumerable<[T, T | undefined]>;
    /**
     * Returns an enumerable of at least minLength, padding the end with a value or the result of a function
     * @param minLength
     * @param filler
     * @returns end
     */
    padEnd(minLength: number, filler: T | ((index: number) => T)): Enumerable<T>;
    /**
     * Returns an enumerable of at least minLength, padding the start with a value or the result of a function
     * if the enumerable cannot seek, then it will be iterated minLength time
     * @param minLength
     * @param filler
     * @returns start
     */
    padStart(minLength: number, filler: T | ((index: number) => T)): Enumerable<T>;
    /**
     * Applies a specified function to the corresponding elements of two sequences, producing a sequence of the results.
     * @template TOther
     * @template TResult
     * @param iterable
     * @param zipper
     * @returns zip
     */
    zip<TOther, TResult>(iterable: IterableType<TOther>, zipper: (item1: T, item2: TOther, index: number) => TResult): Enumerable<TResult>;
    /**
     * Takes the corresponding elements of two sequences, producing a sequence of tuples of elements.
     * @template TOther
     * @param iterable
     * @returns zip
     */
    zip<TOther>(iterable: IterableType<TOther>): Enumerable<[T, TOther]>;
    /**
     * Groups the elements of a sequence
     * @template TKey
     * @param keySelector
     * @returns by
     */
    groupBy<TKey>(keySelector: ISelector<T, TKey>): Enumerable<GroupEnumerable<T, TKey>>;
    /**
     * Correlates the elements of two sequences based on key equality and groups the results. A specified equalityComparer is used to compare keys
     * WARNING: using the equality comparer will be slower
     * @template TOther
     * @template TKey
     * @template TResult
     * @param iterable
     * @param innerKeySelector
     * @param outerKeySelector
     * @param resultSelector
     * @param [equalityComparer]
     * @returns join
     */
    groupJoin<TOther, TKey, TResult>(iterable: IterableType<TOther>, innerKeySelector: ISelector<T, TKey>, outerKeySelector: ISelector<TOther, TKey>, resultSelector: (item1: T, item2: TOther[]) => TResult, equalityComparer?: IEqualityComparer<TKey>): Enumerable<TResult>;
    /**
     * Correlates the elements of two sequences based on matching keys
     * WARNING: using the equality comparer will be slower
     * @template TOther
     * @template TKey
     * @template TResult
     * @param iterable
     * @param innerKeySelector
     * @param outerKeySelector
     * @param resultSelector
     * @param [equalityComparer]
     * @returns join
     */
    join<TOther, TKey, TResult>(iterable: IterableType<TOther>, innerKeySelector: ISelector<T, TKey>, outerKeySelector: ISelector<TOther, TKey>, resultSelector: (item1: T, item2: TOther) => TResult, equalityComparer?: IEqualityComparer<TKey>): Enumerable<TResult>;
    /**
     * Not implemented (use groupBy)
     * @returns lookup
     */
    toLookup(): never;
    /**
     * Sorts the elements of a sequence in ascending order
     * @template TOther
     * @param keySelector
     * @returns by
     */
    orderBy<TOther>(keySelector: ISelector<T, TOther>): OrderedEnumerable<T>;
    /**
     * Sorts the elements of a sequence in ascending order
     * @returns by
     */
    orderBy(): OrderedEnumerable<T>;
    /**
     * Sorts the elements of a sequence in descending order
     * @template TOther
     * @param keySelector
     * @returns by descending
     */
    orderByDescending<TOther>(keySelector: ISelector<T, TOther>): OrderedEnumerable<T>;
    /**
     * Sorts the elements of a sequence in descending order
     * @returns by descending
     */
    orderByDescending(): OrderedEnumerable<T>;
    /**
     * use QuickSort for ordering (default). Recommended when take, skip, takeLast, skipLast are used after orderBy
     * @returns quick sort
     */
    useQuickSort(): Enumerable<T>;
    /**
     * use the default browser sort implementation for ordering at all times
     * @returns browser sort
     */
    useBrowserSort(): Enumerable<T>;
    /**
     * Sorts an array in place using Quicksort
     * @template T
     * @param arr
     * @param [comparer]
     * @returns sort
     */
    static sort<T>(arr: T[], comparer?: IComparer<T>): T[];
    /**
     * If the internal count function is not defined, set it to the most appropriate one
     * @internal
     * @template T
     * @returns internal count
     */
    private _ensureInternalCount;
    /**
     * Ensure there is an internal indexer function adequate for this enumerable
     * This also determines if the enumerable can seek
     * @internal
     * @returns
     */
    protected _ensureInternalTryGetAt(): void;
    /** @internal */
    private _defaultComparer;
}
/**
 * Enumerable of groups, generated by the groupBy methods
 * @internal
 * @template T
 * @template TKey
 */
declare class GroupEnumerable<T, TKey> extends Enumerable<T> {
    key: TKey;
    constructor(iterable: IterableType<T>, key: TKey);
}
/**
 * Ordered enumerable, keeps a record of all the orderBy operations and uses them when iterating over it
 * @internal
 * @template T
 */
declare class OrderedEnumerable<T> extends Enumerable<T> {
    _keySelectors: {
        keySelector: ISelector<T, any>;
        ascending: boolean;
    }[];
    _restrictions: {
        type: RestrictionType;
        nr: number;
    }[];
    constructor(src: IterableType<T>, keySelector?: ISelector<T, any>, ascending?: boolean);
    /**
     * Gets sorted array from enumerable, used internally
     * @returns
     */
    private getSortedArray;
    /**
     * Generates sorting func, used internally for performance
     * @param selectors
     * @returns sort func
     */
    private generateSortFunc;
    /**
     * Calculate the interval in which an array needs to have ordered items for this ordered enumerable
     * @param restrictions
     * @param arrLength
     * @returns
     */
    private getStartAndEndIndexes;
    /**
     * Performs a subsequent ordering of the elements in a sequence in ascending order
     * @template TKey
     * @param keySelector
     * @returns by
     */
    thenBy<TKey>(keySelector: ISelector<T, TKey>): OrderedEnumerable<T>;
    /**
     * Performs a subsequent ordering of the elements in a sequence in descending order
     * @template TKey
     * @param keySelector
     * @returns by descending
     */
    thenByDescending<TKey>(keySelector: ISelector<T, TKey>): OrderedEnumerable<T>;
    /**
     * Deferred and optimized implementation of take
     * @param nr
     * @returns take
     */
    take(nr: number): OrderedEnumerable<T>;
    /**
     * Deferred and optimized implementation of takeLast
     * @param nr
     * @returns last
     */
    takeLast(nr: number): OrderedEnumerable<T>;
    /**
     * Deferred and optimized implementation of skip
     * @param nr
     * @returns skip
     */
    skip(nr: number): OrderedEnumerable<T>;
    /**
     * Deferred and optimized implementation of skipLast
     * @param nr
     * @returns last
     */
    skipLast(nr: number): OrderedEnumerable<T>;
    /**
     * An optimized implementation of toArray
     * @returns array
     */
    toArray(): T[];
    /**
     * An optimized implementation of toMap
     * @template TKey
     * @template TValue
     * @param keySelector
     * @param [valueSelector]
     * @returns map
     */
    toMap<TKey, TValue>(keySelector: ISelector<T, TKey>, valueSelector?: ISelector<T, TValue>): Map<TKey, TValue>;
    /**
     * An optimized implementation of toMap
     * @template TValue
     * @param keySelector
     * @param [valueSelector]
     * @returns object
     */
    toObject(keySelector: ISelector<T, string>, valueSelector?: ISelector<T, any>): {
        [key: string]: any;
    };
    /**
     * An optimized implementation of to Set
     * @returns set
     */
    toSet(): Set<T>;
}
/**
 * Restriction type, used internally
 * @internal
 */
declare enum RestrictionType {
    skip = 0,
    skipLast = 1,
    take = 2,
    takeLast = 3
}
type IterableType<T> = Iterable<T> | (() => Iterator<T>);
type IEqualityComparer<T> = (item1: T, item2: T) => boolean;
type IComparer<T> = (item1: T, item2: T) => -1 | 0 | 1;
type ISelector<TItem, TResult> = (item: TItem, index?: number) => TResult;
type IFilter<T> = ISelector<T, boolean>;
export { Enumerable };
