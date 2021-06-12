if (typeof exports === 'undefined') exports={};
"use strict";
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-this-alias */
/* eslint-disable @typescript-eslint/no-unused-vars */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const GroupEnumerable_1 = __importDefault(require("./GroupEnumerable"));
const OrderedEnumerable_1 = __importDefault(require("./OrderedEnumerable"));
const utils_1 = require("./utils");
/**
 * wrapper class over iterable instances that exposes the methods usually found in .NET LINQ
 * @template T
 */
class Enumerable {
    /**
     * Do not use directly - use the static 'from' method
     * @param src
     */
    constructor(src) {
        // default comparer function
        /** @internal */
        this._defaultComparer = (item1, item2) => {
            if (item1 > item2)
                return 1;
            if (item1 < item2)
                return -1;
            return 0;
        };
        utils_1._ensureIterable(src);
        this._src = src;
        const iteratorFunction = src[Symbol.iterator];
        // the generator is either the iterator of the source enumerable
        // or the generator function that was provided as the source itself
        if (iteratorFunction) {
            this._generator = iteratorFunction.bind(src);
        }
        else {
            this._generator = src;
        }
        this._canSeek = false;
        this._count = null;
        this._tryGetAt = null;
        this._wasIterated = false;
        this._useQuickSort = true;
    }
    /**
     * wraps an iterable item into an Enumerable if it's not already one
     * @template T
     * @param iterable
     * @returns from
     */
    static from(iterable) {
        if (iterable instanceof Enumerable)
            return iterable;
        return new Enumerable(iterable);
    }
    /**
     * returns an empty Enumerable
     * @template T
     * @returns empty
     */
    static empty() {
        const result = new Enumerable([]);
        result._count = () => 0;
        result._tryGetAt = (_index) => null;
        result._canSeek = true;
        return result;
    }
    /**
     * generates a sequence of integer numbers within a specified range.
     * @param start
     * @param count
     * @returns range
     */
    static range(start, count) {
        const gen = function* () {
            for (let i = 0; i < count; i++) {
                yield start + i;
            }
        };
        const result = new Enumerable(gen);
        result._count = () => count;
        result._tryGetAt = (index) => {
            if (index >= 0 && index < count)
                return { value: start + index };
            return null;
        };
        result._canSeek = true;
        return result;
    }
    /**
     * generates a sequence that contains one repeated value
     * @template T
     * @param item
     * @param count
     * @returns repeat
     */
    static repeat(item, count) {
        const gen = function* () {
            for (let i = 0; i < count; i++) {
                yield item;
            }
        };
        const result = new Enumerable(gen);
        result._count = () => count;
        result._tryGetAt = (index) => {
            if (index >= 0 && index < count)
                return { value: item };
            return null;
        };
        result._canSeek = true;
        return result;
    }
    /**
     * the Enumerable instance exposes the same iterator as the wrapped iterable or generator function
     * @returns [symbol.iterator]
     */
    [Symbol.iterator]() {
        this._wasIterated = true;
        return this._generator();
    }
    /**
     * Determines whether the Enumerable can seek (lookup an item by index)
     * @returns
     */
    canSeek() {
        this._ensureInternalTryGetAt();
        return this._canSeek;
    }
    /**
     * Gets the number of items in the enumerable
     * or throws an error if it needs to be enumerated to get it
     */
    get length() {
        if (!this.canSeek())
            throw new Error('Calling length on this enumerable will iterate it. Use count()');
        return this.count();
    }
    /**
     * Concatenates two sequences by appending iterable to the existing one
     * @param iterable
     * @returns concat
     */
    concat(iterable) {
        utils_1._ensureIterable(iterable);
        const self = this;
        // the generator will iterate the enumerable first, then the iterable that was given as a parameter
        // this will be able to seek if both the original and the iterable derived enumerable can seek
        // the indexing function will get items from the first and then second enumerable without iteration
        const gen = function* () {
            for (const item of self) {
                yield item;
            }
            for (const item of Enumerable.from(iterable)) {
                yield item;
            }
        };
        const result = new Enumerable(gen);
        const other = Enumerable.from(iterable);
        result._count = () => self.count() + other.count();
        this._ensureInternalTryGetAt();
        other._ensureInternalTryGetAt();
        result._canSeek = self._canSeek && other._canSeek;
        if (self._canSeek) {
            result._tryGetAt = (index) => {
                return self._tryGetAt(index) || other._tryGetAt(index - self.count());
            };
        }
        return result;
    }
    /**
     * Returns the number of items in the Enumerable, even if it has to enumerate all items to do it
     * @returns count
     */
    count() {
        this._ensureInternalCount();
        return this._count();
    }
    /**
     * Returns distinct elements from a sequence.
     * WARNING: using a comparer makes this slower. Not specifying it uses a Set to determine distinctiveness.
     * @param [equalityComparer]
     * @returns distinct
     */
    distinct(equalityComparer) {
        const self = this;
        // if the comparer function is not provided, a Set will be used to quickly determine distinctiveness
        const gen = equalityComparer === undefined
            ? function* () {
                const distinctValues = new Set();
                for (const item of self) {
                    const size = distinctValues.size;
                    distinctValues.add(item);
                    if (size < distinctValues.size) {
                        yield item;
                    }
                }
            }
            : // otherwise values will be compared with previous values ( O(n^2) )
                // use distinctByHash to use a hashing function ( O(n log n) )
                function* () {
                    const values = [];
                    for (const item of self) {
                        let unique = true;
                        for (let i = 0; i < values.length; i++) {
                            if (equalityComparer(item, values[i])) {
                                unique = false;
                                break;
                            }
                        }
                        if (unique)
                            yield item;
                        values.push(item);
                    }
                };
        return new Enumerable(gen);
    }
    /**
     * Returns the element at a specified index in a sequence
     * @param index
     * @returns at
     */
    elementAt(index) {
        this._ensureInternalTryGetAt();
        const result = this._tryGetAt(index);
        if (!result)
            throw new Error('Index out of range');
        return result.value;
    }
    /**
     * Returns the element at a specified index in a sequence
     * or undefined if the index is out of range.
     * @param index
     * @returns at or default
     */
    elementAtOrDefault(index) {
        this._ensureInternalTryGetAt();
        const result = this._tryGetAt(index);
        if (!result)
            return undefined;
        return result.value;
    }
    /**
     * Returns the first element of a sequence
     * @returns first
     */
    first() {
        return this.elementAt(0);
    }
    /**
     * Returns the first element of a sequence, or undefined if no element is found
     * @returns or default
     */
    firstOrDefault() {
        return this.elementAtOrDefault(0);
    }
    /**
     * Returns the last element of a sequence
     * @returns last
     */
    last() {
        this._ensureInternalTryGetAt();
        // if this cannot seek, getting the last element requires iterating the whole thing
        if (!this._canSeek) {
            let result = null;
            let found = false;
            for (const item of this) {
                result = item;
                found = true;
            }
            if (found)
                return result;
            throw new Error('The enumeration is empty');
        }
        // if this can seek, then just go directly at the last element
        const count = this.count();
        return this.elementAt(count - 1);
    }
    /**
     * Returns the last element of a sequence, or undefined if no element is found
     * @returns or default
     */
    lastOrDefault() {
        this._ensureInternalTryGetAt();
        if (!this._canSeek) {
            let result = undefined;
            for (const item of this) {
                result = item;
            }
            return result;
        }
        const count = this.count();
        return this.elementAtOrDefault(count - 1);
    }
    /**
     * Returns the count, minimum and maximum value in a sequence of values.
     * A custom function can be used to establish order (the result 0 means equal, 1 means larger, -1 means smaller)
     * @param [comparer]
     * @returns stats
     */
    stats(comparer) {
        if (comparer) {
            utils_1._ensureFunction(comparer);
        }
        else {
            comparer = this._defaultComparer;
        }
        const agg = {
            count: 0,
            min: undefined,
            max: undefined,
        };
        for (const item of this) {
            if (typeof agg.min === 'undefined' || comparer(item, agg.min) < 0)
                agg.min = item;
            if (typeof agg.max === 'undefined' || comparer(item, agg.max) > 0)
                agg.max = item;
            agg.count++;
        }
        return agg;
    }
    /**
     *  Returns the minimum value in a sequence of values.
     *  A custom function can be used to establish order (the result 0 means equal, 1 means larger, -1 means smaller)
     * @param [comparer]
     * @returns min
     */
    min(comparer) {
        const stats = this.stats(comparer);
        return stats.count === 0 ? undefined : stats.min;
    }
    /**
     *  Returns the maximum value in a sequence of values.
     *  A custom function can be used to establish order (the result 0 means equal, 1 means larger, -1 means smaller)
     * @param [comparer]
     * @returns max
     */
    max(comparer) {
        const stats = this.stats(comparer);
        return stats.count === 0 ? undefined : stats.max;
    }
    /**
     * Projects each element of a sequence into a new form
     * (equivalent to Javascript map)
     * @template TResult
     * @param selector
     * @returns select
     */
    select(selector) {
        utils_1._ensureFunction(selector);
        const self = this;
        // the generator is applying the selector on all the items of the enumerable
        // the count of the resulting enumerable is the same as the original's
        // the indexer is the same as that of the original, with the selector applied on the value
        const gen = function* () {
            let index = 0;
            for (const item of self) {
                yield selector(item, index);
                index++;
            }
        };
        const result = new Enumerable(gen);
        this._ensureInternalCount();
        result._count = this._count;
        this._ensureInternalTryGetAt();
        result._canSeek = self._canSeek;
        result._tryGetAt = (index) => {
            const res = self._tryGetAt(index);
            if (!res)
                return res;
            return { value: selector(res.value) };
        };
        return result;
    }
    /**
     * Bypasses a specified number of elements in a sequence and then returns an Enumerable of the remaining elements
     * @param nr
     * @returns skip
     */
    skip(nr) {
        const self = this;
        // the generator just enumerates the first nr numbers then starts yielding values
        // the count is the same as the original enumerable, minus the skipped items and at least 0
        // the indexer is the same as for the original, with an offset
        const gen = function* () {
            let nrLeft = nr;
            for (const item of self) {
                if (nrLeft > 0) {
                    nrLeft--;
                }
                else {
                    yield item;
                }
            }
        };
        const result = new Enumerable(gen);
        result._count = () => Math.max(0, self.count() - nr);
        this._ensureInternalTryGetAt();
        result._canSeek = this._canSeek;
        result._tryGetAt = (index) => self._tryGetAt(index + nr);
        return result;
    }
    /**
     * Takes start elements, ignores howmany elements, continues with the new items and continues with the original enumerable
     * Equivalent to the value of an array after performing splice on it with the same parameters
     * @param start
     * @param howmany
     * @param newItems
     * @returns splice
     */
    splice(start, howmany, ...newItems) {
        // tried to define length and splice so that this is seen as an Array-like object,
        // but it doesn't work on properties. length needs to be a field.
        return this.take(start)
            .concat(newItems)
            .concat(this.skip(start + howmany));
    }
    /**
     * Computes the sum of a sequence of numeric values
     * @returns sum
     */
    sum() {
        const stats = this.sumAndCount();
        return stats.count === 0 ? undefined : stats.sum;
    }
    /**
     * Computes the sum and count of a sequence of numeric values
     * @returns and count
     */
    sumAndCount() {
        const agg = {
            count: 0,
            sum: 0,
        };
        for (const item of this) {
            agg.sum = agg.count === 0 ? utils_1._toNumber(item) : agg.sum + utils_1._toNumber(item);
            agg.count++;
        }
        return agg;
    }
    /**
     * Returns a specified number of contiguous elements from the start of a sequence
     * @param nr
     * @returns take
     */
    take(nr) {
        const self = this;
        // the generator will stop after nr items yielded
        // the count is the maximum between the total count and nr
        // the indexer is the same, as long as it's not higher than nr
        const gen = function* () {
            let nrLeft = nr;
            for (const item of self) {
                if (nrLeft > 0) {
                    yield item;
                    nrLeft--;
                }
                if (nrLeft <= 0) {
                    break;
                }
            }
        };
        const result = new Enumerable(gen);
        result._count = () => Math.min(nr, self.count());
        this._ensureInternalTryGetAt();
        result._canSeek = self._canSeek;
        if (self._canSeek) {
            result._tryGetAt = (index) => {
                if (index >= nr)
                    return null;
                return self._tryGetAt(index);
            };
        }
        return result;
    }
    /**
     * Creates an array from an Enumerable
     * @returns array
     */
    toArray() {
        var _a;
        this._ensureInternalTryGetAt();
        // this should be faster than Array.from(this)
        if (this._canSeek) {
            const arr = new Array(this.count());
            for (let i = 0; i < arr.length; i++) {
                arr[i] = (_a = this._tryGetAt(i)) === null || _a === void 0 ? void 0 : _a.value;
            }
            return arr;
        }
        // try to optimize the array growth by increasing it
        // by 64 every time it is needed
        const minIncrease = 64;
        let size = 0;
        const arr = [];
        for (const item of this) {
            if (size === arr.length) {
                arr.length += minIncrease;
            }
            arr[size] = item;
            size++;
        }
        arr.length = size;
        return arr;
    }
    /**
     * Similar to toArray, but returns a seekable Enumerable (itself if already seekable) that can do count and elementAt without iterating
     * @returns list
     */
    toList() {
        this._ensureInternalTryGetAt();
        if (this._canSeek)
            return this;
        return Enumerable.from(this.toArray());
    }
    /**
     * Filters a sequence of values based on a predicate
     * (equivalent to Javascript filter)
     * @param condition
     * @returns where
     */
    where(condition) {
        utils_1._ensureFunction(condition);
        const self = this;
        // cannot imply the count or indexer from the condition
        // where will have to iterate through the whole thing
        const gen = function* () {
            let index = 0;
            for (const item of self) {
                if (condition(item, index)) {
                    yield item;
                }
                index++;
            }
        };
        return new Enumerable(gen);
    }
    /**
     * Applies an accumulator function over a sequence.
     * The specified seed value is used as the initial accumulator value, and the specified function is used to select the result value.
     * (equivalent to Javascript reduce)
     * @template TAcc
     * @param accumulator
     * @param aggregator
     * @returns aggregate
     */
    aggregate(accumulator, aggregator) {
        utils_1._ensureFunction(aggregator);
        for (const item of this) {
            accumulator = aggregator(accumulator, item);
        }
        return accumulator;
    }
    /**
     * Determines whether all elements of a sequence satisfy a condition.
     * @param condition
     * @returns true if all
     */
    all(condition) {
        utils_1._ensureFunction(condition);
        return !this.any((x) => !condition(x));
    }
    /**
     * Determines whether any element of a sequence exists or satisfies a condition.
     * @param condition
     * @returns true if any
     */
    any(condition) {
        utils_1._ensureFunction(condition);
        let index = 0;
        for (const item of this) {
            if (condition(item, index))
                return true;
            index++;
        }
        return false;
    }
    /**
     * Appends a value to the end of the sequence
     * @param item
     * @returns append
     */
    append(item) {
        return this.concat([item]);
    }
    /**
     * Computes the average of a sequence of numeric values
     * @returns average
     */
    average() {
        const stats = this.sumAndCount();
        return stats.count === 0 ? undefined : stats.sum / stats.count;
    }
    /**
     * Returns itself
     * @returns enumerable
     */
    asEnumerable() {
        return this;
    }
    /**
     * Checks the elements of a sequence based on their type
     *  If type is a string, it will check based on typeof, else it will use instanceof.
     *  Throws if types are different.
     * @param type
     * @returns cast
     */
    cast(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    type) {
        const f = typeof type === 'string'
            ? (x) => typeof x === type
            : (x) => x instanceof type;
        return this.select((item) => {
            if (!f(item))
                throw new Error(item + ' not of type ' + type);
            return item;
        });
    }
    /**
     * Determines whether a sequence contains a specified element.
     * A custom function can be used to determine equality between elements.
     * @param item
     * @param [equalityComparer]
     * @returns true if contains
     */
    contains(item, equalityComparer = (i1, i2) => i1 == i2) {
        utils_1._ensureFunction(equalityComparer);
        return this.any((x) => equalityComparer(x, item));
    }
    /**
     * Not implemented
     * @returns if empty
     */
    defaultIfEmpty() {
        throw new Error('defaultIfEmpty not implemented for Javascript');
    }
    /**
     * Produces the set difference of two sequences
     * WARNING: using the comparer is slower
     * @param iterable
     * @param [equalityComparer]
     * @returns except
     */
    except(iterable, equalityComparer) {
        utils_1._ensureIterable(iterable);
        const self = this;
        // use a Set for performance if the comparer is not set
        const gen = equalityComparer === undefined
            ? function* () {
                const distinctValues = Enumerable.from(iterable).toSet();
                for (const item of self) {
                    if (!distinctValues.has(item))
                        yield item;
                }
            }
            : // use exceptByHash for better performance
                function* () {
                    const values = utils_1._toArray(iterable);
                    for (const item of self) {
                        let unique = true;
                        for (let i = 0; i < values.length; i++) {
                            if (equalityComparer(item, values[i])) {
                                unique = false;
                                break;
                            }
                        }
                        if (unique)
                            yield item;
                    }
                };
        return new Enumerable(gen);
    }
    /**
     * Produces the set intersection of two sequences.
     *  WARNING: using a comparer is slower
     * @param iterable
     * @param [equalityComparer]
     * @returns intersect
     */
    intersect(iterable, equalityComparer) {
        utils_1._ensureIterable(iterable);
        const self = this;
        // use a Set for performance if the comparer is not set
        const gen = equalityComparer === undefined
            ? function* () {
                const distinctValues = new Set(Enumerable.from(iterable));
                for (const item of self) {
                    if (distinctValues.has(item))
                        yield item;
                }
            }
            : // use intersectByHash for better performance
                function* () {
                    const values = utils_1._toArray(iterable);
                    for (const item of self) {
                        let unique = true;
                        for (let i = 0; i < values.length; i++) {
                            if (equalityComparer(item, values[i])) {
                                unique = false;
                                break;
                            }
                        }
                        if (!unique)
                            yield item;
                    }
                };
        return new Enumerable(gen);
    }
    /**
     * Same as count
     * @returns count
     */
    longCount() {
        return this.count();
    }
    /**
     * Filters the elements of a sequence based on their type
     * If type is a string, it will filter based on typeof, else it will use instanceof
     * @param type
     * @returns type
     */
    ofType(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    type) {
        const condition = typeof type === 'string'
            ? (x) => typeof x === type
            : (x) => x instanceof type;
        return this.where(condition);
    }
    /**
     * Adds a value to the beginning of the sequence.
     * @param item
     * @returns prepend
     */
    prepend(item) {
        return new Enumerable([item]).concat(this);
    }
    /**
     * Inverts the order of the elements in a sequence
     * @returns reverse
     */
    reverse() {
        this._ensureInternalTryGetAt();
        const self = this;
        // if it can seek, just read the enumerable backwards
        const gen = this._canSeek
            ? function* () {
                const length = self.count();
                for (let index = length - 1; index >= 0; index--) {
                    yield self.elementAt(index);
                }
            }
            : // else enumerate it all into an array, then read it backwards
                function* () {
                    const arr = self.toArray();
                    for (let index = arr.length - 1; index >= 0; index--) {
                        yield arr[index];
                    }
                };
        // the count is the same when reversed
        const result = new Enumerable(gen);
        this._ensureInternalCount();
        result._count = this._count;
        this._ensureInternalTryGetAt();
        // have a custom indexer only if the original enumerable could seek
        if (this._canSeek) {
            const self = this;
            result._canSeek = true;
            result._tryGetAt = (index) => self._tryGetAt(self.count() - index - 1);
        }
        return result;
    }
    /**
     * Projects each element of a sequence to an iterable and flattens the resulting sequences into one sequence
     * @template TResult
     * @param [selector]
     * @returns many
     */
    selectMany(selector) {
        if (selector) {
            utils_1._ensureFunction(selector);
        }
        else {
            selector = (i) => i;
        }
        const self = this;
        const gen = function* () {
            let index = 0;
            for (const item of self) {
                const iter = selector(item, index);
                utils_1._ensureIterable(iter);
                for (const child of iter) {
                    yield child;
                }
                index++;
            }
        };
        return new Enumerable(gen);
    }
    /**
     * Determines whether two sequences are equal and in the same order according to an equality comparer
     * @param iterable
     * @param [equalityComparer]
     * @returns true if equal
     */
    sequenceEqual(iterable, equalityComparer = (i1, i2) => i1 == i2) {
        utils_1._ensureIterable(iterable);
        utils_1._ensureFunction(equalityComparer);
        const iterator1 = this[Symbol.iterator]();
        const iterator2 = Enumerable.from(iterable)[Symbol.iterator]();
        let done = false;
        do {
            const val1 = iterator1.next();
            const val2 = iterator2.next();
            const equal = (val1.done && val2.done) ||
                (!val1.done && !val2.done && equalityComparer(val1.value, val2.value));
            if (!equal)
                return false;
            done = !!val1.done;
        } while (!done);
        return true;
    }
    /**
     * Returns the single element of a sequence and throws if it doesn't have exactly one
     * @returns single
     */
    single() {
        const iterator = this[Symbol.iterator]();
        let val = iterator.next();
        if (val.done)
            throw new Error('Sequence contains no elements');
        const result = val.value;
        val = iterator.next();
        if (!val.done)
            throw new Error('Sequence contains more than one element');
        return result;
    }
    /**
     * Returns the single element of a sequence or undefined if none found. It throws if the sequence contains multiple items
     * @returns or default
     */
    singleOrDefault() {
        const iterator = this[Symbol.iterator]();
        let val = iterator.next();
        if (val.done)
            return undefined;
        const result = val.value;
        val = iterator.next();
        if (!val.done)
            throw new Error('Sequence contains more than one element');
        return result;
    }
    /**
     * Selects the elements starting at the given start argument, and ends at, but does not include, the given end argument
     * @param [start]
     * @param [end]
     * @returns slice
     */
    slice(start = 0, end) {
        let enumerable = this;
        // when the end is defined and positive and start is negative,
        // the only way to compute the last index is to know the count
        if (end !== undefined && end >= 0 && (start || 0) < 0) {
            enumerable = enumerable.toList();
            start = enumerable.count() + start;
        }
        if (start !== 0) {
            if (start > 0) {
                enumerable = enumerable.skip(start);
            }
            else {
                enumerable = enumerable.takeLast(-start);
            }
        }
        if (end !== undefined) {
            if (end >= 0) {
                enumerable = enumerable.take(end - start);
            }
            else {
                enumerable = enumerable.skipLast(-end);
            }
        }
        return enumerable;
    }
    /**
     * Returns a new enumerable collection that contains the elements from source with the last nr elements of the source collection omitted
     * @param nr
     * @returns last
     */
    skipLast(nr) {
        const self = this;
        // the generator is using a buffer to cache nr values
        // and only yields the values that overflow from it
        const gen = function* () {
            const nrLeft = nr;
            const buffer = Array(nrLeft);
            let index = 0;
            let offset = 0;
            for (const item of self) {
                const value = buffer[index - offset];
                buffer[index - offset] = item;
                index++;
                if (index - offset >= nrLeft) {
                    offset += nrLeft;
                }
                if (index > nrLeft) {
                    yield value;
                }
            }
            buffer.length = 0;
        };
        const result = new Enumerable(gen);
        // the count is the original count minus the skipped items and at least 0
        result._count = () => Math.max(0, self.count() - nr);
        this._ensureInternalTryGetAt();
        result._canSeek = this._canSeek;
        // it has an indexer only if the original enumerable can seek
        if (this._canSeek) {
            result._tryGetAt = (index) => {
                if (index >= result.count())
                    return null;
                return self._tryGetAt(index);
            };
        }
        return result;
    }
    /**
     * Bypasses elements in a sequence as long as a specified condition is true and then returns the remaining elements.
     * @param condition
     * @returns while
     */
    skipWhile(condition) {
        utils_1._ensureFunction(condition);
        const self = this;
        let skip = true;
        const gen = function* () {
            let index = 0;
            for (const item of self) {
                if (skip && !condition(item, index)) {
                    skip = false;
                }
                if (!skip) {
                    yield item;
                }
                index++;
            }
        };
        return new Enumerable(gen);
    }
    /**
     * Returns a new enumerable collection that contains the last nr elements from source
     * @param nr
     * @returns last
     */
    takeLast(nr) {
        this._ensureInternalTryGetAt();
        const self = this;
        const gen = this._canSeek
            ? // taking the last items is easy if the enumerable can seek
                function* () {
                    const nrLeft = nr;
                    const length = self.count();
                    for (let index = length - nrLeft; index < length; index++) {
                        yield self.elementAt(index);
                    }
                }
            : // else the generator uses a buffer to fill with values
                // and yields them after the entire thing has been iterated
                function* () {
                    const nrLeft = nr;
                    let index = 0;
                    const buffer = Array(nrLeft);
                    for (const item of self) {
                        buffer[index % nrLeft] = item;
                        index++;
                    }
                    for (let i = 0; i < nrLeft && i < index; i++) {
                        yield buffer[(index + i) % nrLeft];
                    }
                };
        const result = new Enumerable(gen);
        // the count is the minimum between nr and the enumerable count
        result._count = () => Math.min(nr, self.count());
        result._canSeek = self._canSeek;
        // this can seek only if the original enumerable could seek
        if (self._canSeek) {
            result._tryGetAt = (index) => {
                if (index < 0 || index >= result.count())
                    return null;
                return self._tryGetAt(self.count() - nr + index);
            };
        }
        return result;
    }
    /**
     * Returns elements from a sequence as long as a specified condition is true, and then skips the remaining elements
     * @param condition
     * @returns while
     */
    takeWhile(condition) {
        utils_1._ensureFunction(condition);
        const self = this;
        const gen = function* () {
            let index = 0;
            for (const item of self) {
                if (condition(item, index)) {
                    yield item;
                }
                else {
                    break;
                }
                index++;
            }
        };
        return new Enumerable(gen);
    }
    /**
     * Not implemented (use toMap)
     * @returns dictionary
     */
    toDictionary() {
        throw new Error('use toMap or toObject instead of toDictionary');
    }
    toMap(keySelector, 
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    valueSelector = (i) => i) {
        utils_1._ensureFunction(keySelector);
        utils_1._ensureFunction(valueSelector);
        const result = new Map();
        let index = 0;
        for (const item of this) {
            result.set(keySelector(item, index), valueSelector(item, index));
            index++;
        }
        return result;
    }
    /**
     * Creates an object from an enumerable
     * @param keySelector
     * @param [valueSelector]
     * @returns object
     */
    toObject(keySelector, 
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    valueSelector = (x) => x
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ) {
        utils_1._ensureFunction(keySelector);
        utils_1._ensureFunction(valueSelector);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = {};
        let index = 0;
        for (const item of this) {
            result[keySelector(item, index)] = valueSelector(item);
            index++;
        }
        return result;
    }
    /**
     * Not implemented (use toSet)
     * @returns hash set
     */
    toHashSet() {
        throw new Error('use toSet instead of toHashSet');
    }
    /**
     * Creates a set from an enumerable
     * @returns set
     */
    toSet() {
        const result = new Set();
        for (const item of this) {
            result.add(item);
        }
        return result;
    }
    /**
     * Produces the set union of two sequences
     * @param iterable
     * @param [equalityComparer]
     * @returns union
     */
    union(iterable, equalityComparer) {
        utils_1._ensureIterable(iterable);
        return this.concat(iterable).distinct(equalityComparer);
    }
    /**
     * Returns a randomized sequence of items from an initial source
     * @returns shuffle
     */
    shuffle() {
        const self = this;
        function* gen() {
            const arr = self.toArray();
            const len = arr.length;
            let n = 0;
            while (n < len) {
                const k = n + Math.floor(Math.random() * (len - n));
                const value = arr[k];
                arr[k] = arr[n];
                arr[n] = value;
                n++;
                yield value;
            }
        }
        const result = Enumerable.from(gen);
        result._count = () => self.count();
        return result;
    }
    /**
     * Implements random reservoir sampling of k items, with the option to specify a maximum limit for the items
     * @param k
     * @param [limit]
     * @returns sample
     */
    randomSample(k, limit = Number.MAX_SAFE_INTEGER) {
        let index = 0;
        const sample = [];
        this._ensureInternalTryGetAt();
        if (this._canSeek) {
            // L algorithm
            const length = this.count();
            let index = 0;
            for (index = 0; index < k && index < limit && index < length; index++) {
                sample.push(this.elementAt(index));
            }
            let W = Math.exp(Math.log(Math.random()) / k);
            while (index < length && index < limit) {
                index += Math.floor(Math.log(Math.random()) / Math.log(1 - W)) + 1;
                if (index < length && index < limit) {
                    sample[Math.floor(Math.random() * k)] = this.elementAt(index);
                    W *= Math.exp(Math.log(Math.random()) / k);
                }
            }
        }
        else {
            // R algorithm
            for (const item of this) {
                if (index < k) {
                    sample.push(item);
                }
                else {
                    const j = Math.floor(Math.random() * index);
                    if (j < k) {
                        sample[j] = item;
                    }
                }
                index++;
                if (index >= limit)
                    break;
            }
        }
        return Enumerable.from(sample);
    }
    /**
     * Returns the distinct values based on a hashing function
     * @template TResult
     * @param hashFunc
     * @returns by hash
     */
    distinctByHash(hashFunc) {
        // this is much more performant than distinct with a custom comparer
        const self = this;
        const gen = function* () {
            const distinctValues = new Set();
            for (const item of self) {
                const size = distinctValues.size;
                distinctValues.add(hashFunc(item));
                if (size < distinctValues.size) {
                    yield item;
                }
            }
        };
        return new Enumerable(gen);
    }
    /**
     * Returns the values that have different hashes from the items of the iterable provided
     * @template TResult
     * @param iterable
     * @param hashFunc
     * @returns by hash
     */
    exceptByHash(iterable, hashFunc) {
        // this is much more performant than except with a custom comparer
        utils_1._ensureIterable(iterable);
        const self = this;
        const gen = function* () {
            const distinctValues = Enumerable.from(iterable).select(hashFunc).toSet();
            for (const item of self) {
                if (!distinctValues.has(hashFunc(item))) {
                    yield item;
                }
            }
        };
        return new Enumerable(gen);
    }
    /**
     * Returns the values that have the same hashes as items of the iterable provided
     * @template TResult
     * @param iterable
     * @param hashFunc
     * @returns by hash
     */
    intersectByHash(iterable, hashFunc) {
        // this is much more performant than intersect with a custom comparer
        utils_1._ensureIterable(iterable);
        const self = this;
        const gen = function* () {
            const distinctValues = Enumerable.from(iterable).select(hashFunc).toSet();
            for (const item of self) {
                if (distinctValues.has(hashFunc(item))) {
                    yield item;
                }
            }
        };
        return new Enumerable(gen);
    }
    /**
     * returns the index of a value in an ordered enumerable or false if not found
     * WARNING: use the same comparer as the one used in the ordered enumerable. The algorithm assumes the enumerable is already sorted.
     * @param value
     * @param [comparer]
     * @returns search
     */
    binarySearch(value, comparer = this._defaultComparer) {
        const enumerable = this.toList();
        let start = 0;
        let end = enumerable.count() - 1;
        while (start <= end) {
            const mid = (start + end) >> 1;
            const comp = comparer(enumerable.elementAt(mid), value);
            if (comp == 0)
                return mid;
            if (comp < 0) {
                start = mid + 1;
            }
            else {
                end = mid - 1;
            }
        }
        return false;
    }
    /// joins each item of the enumerable with previous items from the same enumerable
    lag(offset, 
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    zipper) {
        if (!offset) {
            throw new Error('offset has to be positive');
        }
        if (offset < 0) {
            throw new Error('offset has to be positive. Use .lead if you want to join with next items');
        }
        if (!zipper) {
            zipper = (i1, i2) => [i1, i2];
        }
        else {
            utils_1._ensureFunction(zipper);
        }
        const self = this;
        this._ensureInternalTryGetAt();
        // generator uses a buffer to hold all the items within the offset interval
        const gen = function* () {
            const buffer = Array(offset);
            let index = 0;
            for (const item of self) {
                const index2 = index - offset;
                const item2 = index2 < 0 ? undefined : buffer[index2 % offset];
                yield zipper(item, item2);
                buffer[index % offset] = item;
                index++;
            }
        };
        const result = new Enumerable(gen);
        // count is the same as of the original enumerable
        result._count = () => {
            const count = self.count();
            if (!result._wasIterated)
                result._wasIterated = self._wasIterated;
            return count;
        };
        // seeking is possible only if the original was seekable
        if (self._canSeek) {
            result._canSeek = true;
            result._tryGetAt = (index) => {
                const val1 = self._tryGetAt(index);
                const val2 = self._tryGetAt(index - offset);
                if (val1) {
                    return {
                        value: zipper(val1.value, val2 ? val2.value : undefined),
                    };
                }
                return null;
            };
        }
        return result;
    }
    /// joins each item of the enumerable with next items from the same enumerable
    lead(offset, 
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    zipper) {
        if (!offset) {
            throw new Error('offset has to be positive');
        }
        if (offset < 0) {
            throw new Error('offset has to be positive. Use .lag if you want to join with previous items');
        }
        if (!zipper) {
            zipper = (i1, i2) => [i1, i2];
        }
        else {
            utils_1._ensureFunction(zipper);
        }
        const self = this;
        this._ensureInternalTryGetAt();
        // generator uses a buffer to hold all the items within the offset interval
        const gen = function* () {
            const buffer = Array(offset);
            let index = 0;
            for (const item of self) {
                const index2 = index - offset;
                if (index2 >= 0) {
                    const item2 = buffer[index2 % offset];
                    yield zipper(item2, item);
                }
                buffer[index % offset] = item;
                index++;
            }
            for (let i = 0; i < offset; i++) {
                const item = buffer[(index + i) % offset];
                yield zipper(item, undefined);
            }
        };
        const result = new Enumerable(gen);
        // count is the same as of the original enumerable
        result._count = () => {
            const count = self.count();
            if (!result._wasIterated)
                result._wasIterated = self._wasIterated;
            return count;
        };
        // seeking is possible only if the original was seekable
        if (self._canSeek) {
            result._canSeek = true;
            result._tryGetAt = (index) => {
                const val1 = self._tryGetAt(index);
                const val2 = self._tryGetAt(index + offset);
                if (val1) {
                    return {
                        value: zipper(val1.value, val2 ? val2.value : undefined),
                    };
                }
                return null;
            };
        }
        return result;
    }
    /**
     * Returns an enumerable of at least minLength, padding the end with a value or the result of a function
     * @param minLength
     * @param filler
     * @returns end
     */
    padEnd(minLength, filler) {
        if (minLength <= 0) {
            throw new Error('minLength has to be positive.');
        }
        let fillerFunc;
        if (typeof filler !== 'function') {
            fillerFunc = (_index) => filler;
        }
        else {
            fillerFunc = filler;
        }
        const self = this;
        this._ensureInternalTryGetAt();
        // generator iterates all elements,
        // then yields the result of the filler function until minLength items
        const gen = function* () {
            let index = 0;
            for (const item of self) {
                yield item;
                index++;
            }
            for (; index < minLength; index++) {
                yield fillerFunc(index);
            }
        };
        const result = new Enumerable(gen);
        // count is the maximum between minLength and the original count
        result._count = () => {
            const count = Math.max(minLength, self.count());
            if (!result._wasIterated)
                result._wasIterated = self._wasIterated;
            return count;
        };
        // seeking is possible if the original was seekable
        if (self._canSeek) {
            result._canSeek = true;
            result._tryGetAt = (index) => {
                const val = self._tryGetAt(index);
                if (val)
                    return val;
                if (index < minLength) {
                    return { value: fillerFunc(index) };
                }
                return null;
            };
        }
        return result;
    }
    /**
     * Returns an enumerable of at least minLength, padding the start with a value or the result of a function
     * if the enumerable cannot seek, then it will be iterated minLength time
     * @param minLength
     * @param filler
     * @returns start
     */
    padStart(minLength, filler) {
        if (minLength <= 0) {
            throw new Error('minLength has to be positive.');
        }
        let fillerFunc;
        if (typeof filler !== 'function') {
            fillerFunc = (_index) => filler;
        }
        else {
            fillerFunc = filler;
        }
        const self = this;
        this._ensureInternalTryGetAt();
        // generator needs a buffer to hold offset values
        // it yields values from the buffer when it overflows
        // or filler function results if the buffer is not full
        // after iterating the entire original enumerable
        const gen = function* () {
            const buffer = Array(minLength);
            let index = 0;
            const iterator = self[Symbol.iterator]();
            let flushed = false;
            let done = false;
            do {
                const val = iterator.next();
                done = !!val.done;
                if (!done) {
                    buffer[index] = val.value;
                    index++;
                }
                if (flushed && !done) {
                    yield val.value;
                }
                else {
                    if (done || index === minLength) {
                        for (let i = 0; i < minLength - index; i++) {
                            yield fillerFunc(i);
                        }
                        for (let i = 0; i < index; i++) {
                            yield buffer[i];
                        }
                        flushed = true;
                    }
                }
            } while (!done);
        };
        const result = new Enumerable(gen);
        // count is the max of minLength and the original count
        result._count = () => {
            const count = Math.max(minLength, self.count());
            if (!result._wasIterated)
                result._wasIterated = self._wasIterated;
            return count;
        };
        // seeking is possible only if the original was seekable
        if (self._canSeek) {
            result._canSeek = true;
            result._tryGetAt = (index) => {
                const count = self.count();
                const delta = minLength - count;
                if (delta <= 0) {
                    return self._tryGetAt(index);
                }
                if (index < delta) {
                    return { value: fillerFunc(index) };
                }
                return self._tryGetAt(index - delta);
            };
        }
        return result;
    }
    /// Applies a specified function to the corresponding elements of two sequences, producing a sequence of the results.
    zip(iterable, 
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    zipper) {
        utils_1._ensureIterable(iterable);
        if (!zipper) {
            zipper = (i1, i2) => [i1, i2];
        }
        else {
            utils_1._ensureFunction(zipper);
        }
        const self = this;
        const gen = function* () {
            let index = 0;
            const iterator1 = self[Symbol.iterator]();
            const iterator2 = Enumerable.from(iterable)[Symbol.iterator]();
            let done = false;
            do {
                const val1 = iterator1.next();
                const val2 = iterator2.next();
                done = !!(val1.done || val2.done);
                if (!done) {
                    yield zipper(val1.value, val2.value, index);
                }
                index++;
            } while (!done);
        };
        return new Enumerable(gen);
    }
    /**
     * Groups the elements of a sequence
     * @template TKey
     * @param keySelector
     * @returns by
     */
    groupBy(keySelector) {
        utils_1._ensureFunction(keySelector);
        const self = this;
        const gen = function* () {
            const groupMap = new Map();
            let index = 0;
            // iterate all items and group them in a Map
            for (const item of self) {
                const key = keySelector(item, index);
                const group = groupMap.get(key);
                if (group) {
                    group.push(item);
                }
                else {
                    groupMap.set(key, [item]);
                }
                index++;
            }
            // then yield a GroupEnumerable for each group
            for (const [key, items] of groupMap) {
                const group = new GroupEnumerable_1.default(items, key);
                yield group;
            }
        };
        const result = new Enumerable(gen);
        return result;
    }
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
    groupJoin(iterable, innerKeySelector, outerKeySelector, resultSelector, equalityComparer) {
        const self = this;
        const gen = equalityComparer === undefined
            ? function* () {
                var _a;
                const lookup = new Enumerable(iterable)
                    .groupBy(outerKeySelector)
                    .toMap((g) => g.key, (g) => g);
                let index = 0;
                for (const innerItem of self) {
                    const arr = utils_1._toArray((_a = lookup.get(innerKeySelector(innerItem, index))) !== null && _a !== void 0 ? _a : []);
                    yield resultSelector(innerItem, arr);
                    index++;
                }
            }
            : function* () {
                let innerIndex = 0;
                for (const innerItem of self) {
                    const arr = [];
                    let outerIndex = 0;
                    for (const outerItem of Enumerable.from(iterable)) {
                        if (equalityComparer(innerKeySelector(innerItem, innerIndex), outerKeySelector(outerItem, outerIndex))) {
                            arr.push(outerItem);
                        }
                        outerIndex++;
                    }
                    yield resultSelector(innerItem, arr);
                    innerIndex++;
                }
            };
        return new Enumerable(gen);
    }
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
    join(iterable, innerKeySelector, outerKeySelector, resultSelector, equalityComparer) {
        const self = this;
        const gen = equalityComparer === undefined
            ? function* () {
                const lookup = new Enumerable(iterable)
                    .groupBy(outerKeySelector)
                    .toMap((g) => g.key, (g) => g);
                let index = 0;
                for (const innerItem of self) {
                    const group = lookup.get(innerKeySelector(innerItem, index));
                    if (group) {
                        for (const outerItem of group) {
                            yield resultSelector(innerItem, outerItem);
                        }
                    }
                    index++;
                }
            }
            : function* () {
                let innerIndex = 0;
                for (const innerItem of self) {
                    let outerIndex = 0;
                    for (const outerItem of Enumerable.from(iterable)) {
                        if (equalityComparer(innerKeySelector(innerItem, innerIndex), outerKeySelector(outerItem, outerIndex))) {
                            yield resultSelector(innerItem, outerItem);
                        }
                        outerIndex++;
                    }
                    innerIndex++;
                }
            };
        return new Enumerable(gen);
    }
    /**
     * Not implemented (use groupBy)
     * @returns lookup
     */
    toLookup() {
        throw new Error('use groupBy instead of toLookup');
    }
    /// Sorts the elements of a sequence in ascending order.
    orderBy(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    keySelector) {
        if (keySelector) {
            utils_1._ensureFunction(keySelector);
        }
        else {
            keySelector = (i) => i;
        }
        return new OrderedEnumerable_1.default(this, keySelector, true);
    }
    /// Sorts the elements of a sequence in descending order.
    orderByDescending(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    keySelector) {
        if (keySelector) {
            utils_1._ensureFunction(keySelector);
        }
        else {
            keySelector = (i) => i;
        }
        return new OrderedEnumerable_1.default(this, keySelector, false);
    }
    /**
     * use QuickSort for ordering (default). Recommended when take, skip, takeLast, skipLast are used after orderBy
     * @returns quick sort
     */
    useQuickSort() {
        this._useQuickSort = true;
        return this;
    }
    /**
     * use the default browser sort implementation for ordering at all times
     * @returns browser sort
     */
    useBrowserSort() {
        this._useQuickSort = false;
        return this;
    }
    /**
     * Sorts an array in place using Quicksort
     * @template T
     * @param arr
     * @param [comparer]
     * @returns sort
     */
    static sort(arr, comparer) {
        utils_1._quickSort(arr, 0, arr.length - 1, comparer, 0, Number.MAX_SAFE_INTEGER);
        return arr;
    }
    /**
     * If the internal count function is not defined, set it to the most appropriate one
     * @internal
     * @template T
     * @returns internal count
     */
    _ensureInternalCount() {
        const enumerable = this;
        if (enumerable._count)
            return;
        if (enumerable._src instanceof Enumerable) {
            // the count is the same as the underlying enumerable
            const innerEnumerable = enumerable._src;
            innerEnumerable._ensureInternalCount();
            enumerable._count = () => innerEnumerable._count();
            return;
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const src = enumerable._src;
        // this could cause false positives, but if it has a numeric length or size, use it
        if (typeof src !== 'function' && typeof src.length === 'number') {
            enumerable._count = () => src.length;
            return;
        }
        if (typeof src.size === 'number') {
            enumerable._count = () => src.size;
            return;
        }
        // otherwise iterate the whole thing and count all items
        enumerable._count = () => {
            let x = 0;
            for (const _item of enumerable)
                x++;
            return x;
        };
    }
    /**
     * Ensure there is an internal indexer function adequate for this enumerable
     * This also determines if the enumerable can seek
     * @internal
     * @returns
     */
    _ensureInternalTryGetAt() {
        const enumerable = this;
        if (enumerable._tryGetAt)
            return;
        enumerable._canSeek = true;
        if (enumerable._src instanceof Enumerable) {
            // indexer and seekability is the same as for the underlying enumerable
            const innerEnumerable = enumerable._src;
            innerEnumerable._ensureInternalTryGetAt();
            enumerable._tryGetAt = (index) => innerEnumerable._tryGetAt(index);
            enumerable._canSeek = innerEnumerable._canSeek;
            return;
        }
        if (typeof enumerable._src === 'string') {
            const str = enumerable._src;
            // a string can be accessed by index
            enumerable._tryGetAt = (index) => {
                if (index < str.length) {
                    return {
                        value: str.charAt(index),
                    };
                }
                return null;
            };
            return;
        }
        if (Array.isArray(enumerable._src)) {
            const arr = enumerable._src;
            // an array can be accessed by index
            enumerable._tryGetAt = (index) => {
                if (index >= 0 && index < arr.length) {
                    return { value: arr[index] };
                }
                return null;
            };
            return;
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const src = enumerable._src;
        if (typeof enumerable._src !== 'function' &&
            typeof src.length === 'number') {
            // try to access an object with a defined numeric length by indexing it
            // might cause false positives
            enumerable._tryGetAt = (index) => {
                if (index < src.length && typeof src[index] !== 'undefined') {
                    return { value: src[index] };
                }
                return null;
            };
            return;
        }
        enumerable._canSeek = false;
        // TODO other specialized types? objects, maps, sets?
        enumerable._tryGetAt = (index) => {
            let x = 0;
            for (const item of enumerable) {
                if (index === x)
                    return { value: item };
                x++;
            }
            return null;
        };
    }
}
exports.default = Enumerable;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiRW51bWVyYWJsZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9saWIvRW51bWVyYWJsZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUEsNkRBQTZEO0FBQzdELHFEQUFxRDtBQUNyRCxzREFBc0Q7Ozs7O0FBRXRELHdFQUFnRDtBQUNoRCw0RUFBb0Q7QUFDcEQsbUNBV2lCO0FBRWpCOzs7R0FHRztBQUNILE1BQU0sVUFBVTtJQWtCZDs7O09BR0c7SUFDSCxZQUFzQixHQUFvQjtRQTYrRDFDLDRCQUE0QjtRQUM1QixnQkFBZ0I7UUFDUixxQkFBZ0IsR0FBaUIsQ0FBQyxLQUFLLEVBQUUsS0FBSyxFQUFFLEVBQUU7WUFDeEQsSUFBSSxLQUFLLEdBQUcsS0FBSztnQkFBRSxPQUFPLENBQUMsQ0FBQztZQUM1QixJQUFJLEtBQUssR0FBRyxLQUFLO2dCQUFFLE9BQU8sQ0FBQyxDQUFDLENBQUM7WUFDN0IsT0FBTyxDQUFDLENBQUM7UUFDWCxDQUFDLENBQUM7UUFsL0RBLHVCQUFlLENBQUMsR0FBRyxDQUFDLENBQUM7UUFDckIsSUFBSSxDQUFDLElBQUksR0FBRyxHQUFHLENBQUM7UUFDaEIsTUFBTSxnQkFBZ0IsR0FBdUIsR0FBbUIsQ0FDOUQsTUFBTSxDQUFDLFFBQVEsQ0FDaEIsQ0FBQztRQUNGLGdFQUFnRTtRQUNoRSxtRUFBbUU7UUFDbkUsSUFBSSxnQkFBZ0IsRUFBRTtZQUNwQixJQUFJLENBQUMsVUFBVSxHQUFHLGdCQUFnQixDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztTQUM5QzthQUFNO1lBQ0wsSUFBSSxDQUFDLFVBQVUsR0FBRyxHQUF3QixDQUFDO1NBQzVDO1FBQ0QsSUFBSSxDQUFDLFFBQVEsR0FBRyxLQUFLLENBQUM7UUFDdEIsSUFBSSxDQUFDLE1BQU0sR0FBRyxJQUFJLENBQUM7UUFDbkIsSUFBSSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUM7UUFDdEIsSUFBSSxDQUFDLFlBQVksR0FBRyxL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
Linqer={ Enumerable: Enumerable };
