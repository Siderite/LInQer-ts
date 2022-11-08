if (typeof exports === 'undefined') exports={};
"use strict";
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-this-alias */
/* eslint-disable @typescript-eslint/no-unused-vars */
Object.defineProperty(exports, "__esModule", { value: true });
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
        _ensureIterable(src);
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
        _ensureIterable(iterable);
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
            _ensureFunction(comparer);
        }
        else {
            comparer = this._defaultComparer;
        }
        const agg = {
            count: 0,
            min: undefined,
            max: undefined,
        };
        const iterator = this[Symbol.iterator]();
        let val1 = iterator.next();
        let val2 = iterator.next();
        while (!val1.done && !val2.done) {
            if (comparer(val1.value, val2.value) > 0) {
                if (agg.max === undefined || comparer(val1.value, agg.max) > 0)
                    agg.max = val1.value;
                if (agg.min === undefined || comparer(val2.value, agg.min) < 0)
                    agg.min = val2.value;
            }
            else {
                if (agg.max === undefined || comparer(val2.value, agg.max) > 0)
                    agg.max = val2.value;
                if (agg.min === undefined || comparer(val1.value, agg.min) < 0)
                    agg.min = val1.value;
            }
            agg.count += 2;
            val1 = iterator.next();
            val2 = iterator.next();
        }
        if (!val1.done) {
            if (agg.max === undefined || comparer(val1.value, agg.max) > 0)
                agg.max = val1.value;
            else if (agg.min === undefined || comparer(val1.value, agg.min) < 0)
                agg.min = val1.value;
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
        _ensureFunction(selector);
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
            agg.sum = agg.count === 0 ? _toNumber(item) : agg.sum + _toNumber(item);
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
        _ensureFunction(condition);
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
        _ensureFunction(aggregator);
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
        _ensureFunction(condition);
        return !this.any((x) => !condition(x));
    }
    /**
     * Determines whether any element of a sequence exists or satisfies a condition.
     * @param condition
     * @returns true if any
     */
    any(condition) {
        _ensureFunction(condition);
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
        _ensureFunction(equalityComparer);
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
        _ensureIterable(iterable);
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
                    const values = _toArray(iterable);
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
        _ensureIterable(iterable);
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
                    const values = _toArray(iterable);
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
            _ensureFunction(selector);
        }
        else {
            selector = (i) => i;
        }
        const self = this;
        const gen = function* () {
            let index = 0;
            for (const item of self) {
                const iter = selector(item, index);
                _ensureIterable(iter);
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
        _ensureIterable(iterable);
        _ensureFunction(equalityComparer);
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
        _ensureFunction(condition);
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
        _ensureFunction(condition);
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
        _ensureFunction(keySelector);
        _ensureFunction(valueSelector);
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
        _ensureFunction(keySelector);
        _ensureFunction(valueSelector);
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
        _ensureIterable(iterable);
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
        _ensureIterable(iterable);
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
        _ensureIterable(iterable);
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
            _ensureFunction(zipper);
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
            _ensureFunction(zipper);
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
        _ensureIterable(iterable);
        if (!zipper) {
            zipper = (i1, i2) => [i1, i2];
        }
        else {
            _ensureFunction(zipper);
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
        _ensureFunction(keySelector);
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
                const group = new GroupEnumerable(items, key);
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
                    const arr = _toArray((_a = lookup.get(innerKeySelector(innerItem, index))) !== null && _a !== void 0 ? _a : []);
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
            _ensureFunction(keySelector);
        }
        else {
            keySelector = (i) => i;
        }
        return new OrderedEnumerable(this, keySelector, true);
    }
    /// Sorts the elements of a sequence in descending order.
    orderByDescending(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    keySelector) {
        if (keySelector) {
            _ensureFunction(keySelector);
        }
        else {
            keySelector = (i) => i;
        }
        return new OrderedEnumerable(this, keySelector, false);
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
        _quickSort(arr, 0, arr.length - 1, comparer, 0, Number.MAX_SAFE_INTEGER);
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
/**
 * Enumerable of groups, generated by the groupBy methods
 * @internal
 * @template T
 * @template TKey
 */
class GroupEnumerable extends Enumerable {
    constructor(iterable, key) {
        super(iterable);
        this.key = key;
    }
}
/**
 * Ordered enumerable, keeps a record of all the orderBy operations and uses them when iterating over it
 * @internal
 * @template T
 */
class OrderedEnumerable extends Enumerable {
    constructor(src, 
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    keySelector, ascending = true) {
        super(src);
        this._keySelectors = [];
        this._restrictions = [];
        if (keySelector) {
            this._keySelectors.push({
                keySelector: keySelector,
                ascending: ascending,
            });
        }
        const self = this;
        // generator gets an array of the original,
        // sorted inside the interval determined by functions such as skip, take, skipLast, takeLast
        this._generator = function* () {
            const { startIndex, endIndex, arr } = this.getSortedArray();
            if (arr) {
                for (let index = startIndex; index < endIndex; index++) {
                    yield arr[index];
                }
            }
        };
        // the count is the difference between the end and start indexes
        // if no skip/take functions were used, this will be the original count
        this._count = () => {
            const totalCount = Enumerable.from(self._src).count();
            const { startIndex, endIndex } = this.getStartAndEndIndexes(self._restrictions, totalCount);
            return endIndex - startIndex;
        };
        // an ordered enumerable cannot seek
        this._canSeek = false;
        this._tryGetAt = () => {
            throw new Error('Ordered enumerables cannot seek');
        };
    }
    /**
     * Gets sorted array from enumerable, used internally
     * @returns
     */
    getSortedArray() {
        const self = this;
        let startIndex;
        let endIndex;
        let arr = null;
        const innerEnumerable = Enumerable.from(self._src);
        // try to avoid enumerating the entire original into an array
        if (innerEnumerable.canSeek()) {
            ({ startIndex, endIndex } = self.getStartAndEndIndexes(self._restrictions, innerEnumerable.count()));
        }
        else {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            arr = Array.from(self._src);
            ({ startIndex, endIndex } = self.getStartAndEndIndexes(self._restrictions, arr.length));
        }
        if (startIndex < endIndex) {
            if (!arr) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                arr = Array.from(self._src);
            }
            // only quicksort supports partial ordering inside an interval
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const sort = self._useQuickSort
                ? (a, c) => _quickSort(a, 0, a.length - 1, c, startIndex, endIndex)
                : (a, c) => a.sort(c);
            const sortFunc = self.generateSortFunc(self._keySelectors);
            sort(arr, sortFunc);
            return {
                startIndex,
                endIndex,
                arr,
            };
        }
        else {
            return {
                startIndex,
                endIndex,
                arr: null,
            };
        }
    }
    /**
     * Generates sorting func, used internally for performance
     * @param selectors
     * @returns sort func
     */
    generateSortFunc(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    selectors
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ) {
        // simplify the selectors into an array of comparers
        const comparers = selectors.map((s) => {
            const f = s.keySelector;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const comparer = (i1, i2) => {
                const k1 = f(i1);
                const k2 = f(i2);
                if (k1 > k2)
                    return 1;
                if (k1 < k2)
                    return -1;
                return 0;
            };
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return s.ascending ? comparer : (i1, i2) => -comparer(i1, i2);
        });
        // optimize the resulting sort function in the most common case
        // (ordered by a single criterion)
        return comparers.length == 1
            ? comparers[0]
            : // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (i1, i2) => {
                    for (let i = 0; i < comparers.length; i++) {
                        const v = comparers[i](i1, i2);
                        if (v)
                            return v;
                    }
                    return 0;
                };
    }
    /**
     * Calculate the interval in which an array needs to have ordered items for this ordered enumerable
     * @param restrictions
     * @param arrLength
     * @returns
     */
    getStartAndEndIndexes(restrictions, arrLength) {
        let startIndex = 0;
        let endIndex = arrLength;
        for (const restriction of restrictions) {
            switch (restriction.type) {
                case RestrictionType.take:
                    endIndex = Math.min(endIndex, startIndex + restriction.nr);
                    break;
                case RestrictionType.skip:
                    startIndex = Math.min(endIndex, startIndex + restriction.nr);
                    break;
                case RestrictionType.takeLast:
                    startIndex = Math.max(startIndex, endIndex - restriction.nr);
                    break;
                case RestrictionType.skipLast:
                    endIndex = Math.max(startIndex, endIndex - restriction.nr);
                    break;
            }
        }
        return { startIndex, endIndex };
    }
    /**
     * Performs a subsequent ordering of the elements in a sequence in ascending order
     * @template TKey
     * @param keySelector
     * @returns by
     */
    thenBy(keySelector) {
        this._keySelectors.push({ keySelector: keySelector, ascending: true });
        return this;
    }
    /**
     * Performs a subsequent ordering of the elements in a sequence in descending order
     * @template TKey
     * @param keySelector
     * @returns by descending
     */
    thenByDescending(keySelector) {
        this._keySelectors.push({ keySelector: keySelector, ascending: false });
        return this;
    }
    /**
     * Deferred and optimized implementation of take
     * @param nr
     * @returns take
     */
    take(nr) {
        this._restrictions.push({ type: RestrictionType.take, nr: nr });
        return this;
    }
    /**
     * Deferred and optimized implementation of takeLast
     * @param nr
     * @returns last
     */
    takeLast(nr) {
        this._restrictions.push({ type: RestrictionType.takeLast, nr: nr });
        return this;
    }
    /**
     * Deferred and optimized implementation of skip
     * @param nr
     * @returns skip
     */
    skip(nr) {
        this._restrictions.push({ type: RestrictionType.skip, nr: nr });
        return this;
    }
    /**
     * Deferred and optimized implementation of skipLast
     * @param nr
     * @returns last
     */
    skipLast(nr) {
        this._restrictions.push({ type: RestrictionType.skipLast, nr: nr });
        return this;
    }
    /**
     * An optimized implementation of toArray
     * @returns array
     */
    toArray() {
        const { startIndex, endIndex, arr } = this.getSortedArray();
        return arr ? arr.slice(startIndex, endIndex) : [];
    }
    /**
     * An optimized implementation of toMap
     * @template TKey
     * @template TValue
     * @param keySelector
     * @param [valueSelector]
     * @returns map
     */
    toMap(keySelector, valueSelector = (x) => x) {
        _ensureFunction(keySelector);
        _ensureFunction(valueSelector);
        const result = new Map();
        const arr = this.toArray();
        for (let i = 0; i < arr.length; i++) {
            result.set(keySelector(arr[i], i), valueSelector(arr[i], i));
        }
        return result;
    }
    /**
     * An optimized implementation of toMap
     * @template TValue
     * @param keySelector
     * @param [valueSelector]
     * @returns object
     */
    toObject(keySelector, 
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    valueSelector = (x) => x
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ) {
        _ensureFunction(keySelector);
        _ensureFunction(valueSelector);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = {};
        const arr = this.toArray();
        for (let i = 0; i < arr.length; i++) {
            result[keySelector(arr[i], i)] = valueSelector(arr[i], i);
        }
        return result;
    }
    /**
     * An optimized implementation of to Set
     * @returns set
     */
    toSet() {
        const result = new Set();
        const arr = this.toArray();
        for (let i = 0; i < arr.length; i++) {
            result.add(arr[i]);
        }
        return result;
    }
}
/**
 * Restriction type, used internally
 * @internal
 */
var RestrictionType;
(function (RestrictionType) {
    RestrictionType[RestrictionType["skip"] = 0] = "skip";
    RestrictionType[RestrictionType["skipLast"] = 1] = "skipLast";
    RestrictionType[RestrictionType["take"] = 2] = "take";
    RestrictionType[RestrictionType["takeLast"] = 3] = "takeLast";
})(RestrictionType || (RestrictionType = {}));
/** @internal */
const _insertionSortThreshold = 64;
/// insertion sort is used for small intervals
/** @internal */
function _insertionsort(arr, leftIndex, rightIndex, comparer) {
    for (let j = leftIndex; j <= rightIndex; j++) {
        const key = arr[j];
        let i = j - 1;
        while (i >= leftIndex && comparer(arr[i], key) > 0) {
            arr[i + 1] = arr[i];
            i--;
        }
        arr[i + 1] = key;
    }
}
/// swap two items in an array by index
/** @internal */
function _swapArrayItems(array, leftIndex, rightIndex) {
    const temp = array[leftIndex];
    array[leftIndex] = array[rightIndex];
    array[rightIndex] = temp;
}
// Quicksort partition by center value coming from both sides
/** @internal */
function _partition(items, left, right, comparer) {
    const pivot = items[(right + left) >> 1];
    while (left <= right) {
        while (comparer(items[left], pivot) < 0) {
            left++;
        }
        while (comparer(items[right], pivot) > 0) {
            right--;
        }
        if (left < right) {
            _swapArrayItems(items, left, right);
            left++;
            right--;
        }
        else {
            if (left === right)
                return left + 1;
        }
    }
    return left;
}
/// optimized Quicksort algorithm
/** @internal */
function _quickSort(items, left, right, comparer = (i1, i2) => (i1 > i2 ? 1 : i1 < i2 ? -1 : 0), minIndex = 0, maxIndex = Number.MAX_SAFE_INTEGER) {
    if (!items.length)
        return items;
    // store partition indexes to be processed in here
    const partitions = [];
    partitions.push({ left, right });
    let size = 1;
    // the actual size of the partitions array never decreases
    // but we keep score of the number of partitions in 'size'
    // and we reuse slots whenever possible
    while (size) {
        const partition = ({ left, right } = partitions[size - 1]);
        if (right - left < _insertionSortThreshold) {
            _insertionsort(items, left, right, comparer);
            size--;
            continue;
        }
        const index = _partition(items, left, right, comparer);
        if (left < index - 1 && index - 1 >= minIndex) {
            partition.right = index - 1;
            if (index < right && index < maxIndex) {
                partitions[size] = { left: index, right };
                size++;
            }
        }
        else {
            if (index < right && index < maxIndex) {
                partition.left = index;
            }
            else {
                size--;
            }
        }
    }
    return items;
}
// throw if src is not a generator function or an iterable
/** @internal */
function _ensureIterable(src) {
    if (src) {
        if (src[Symbol.iterator])
            return;
        if (typeof src === 'function' &&
            // eslint-disable-next-line @typescript-eslint/ban-types
            src.constructor.name === 'GeneratorFunction')
            return;
    }
    throw new Error('the argument must be iterable!');
}
// throw if f is not a function
/** @internal */
function _ensureFunction(f) {
    if (!f || typeof f !== 'function')
        throw new Error('the argument needs to be a function!');
}
// return Nan if this is not a number
// different from Number(obj), which would cast strings to numbers
/** @internal */
function _toNumber(obj) {
    return typeof obj === 'number' ? obj : Number.NaN;
}
// return the iterable if already an array or use Array.from to create one
/** @internal */
function _toArray(iterable) {
    if (!iterable)
        return [];
    if (Array.isArray(iterable))
        return iterable;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return Array.from(iterable);
}
exports.default = Enumerable;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiRW51bWVyYWJsZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9saWIvRW51bWVyYWJsZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUEsNkRBQTZEO0FBQzdELHFEQUFxRDtBQUNyRCxzREFBc0Q7O0FBRXREOzs7R0FHRztBQUNILE1BQU0sVUFBVTtJQWtCZDs7O09BR0c7SUFDSCxZQUFzQixHQUFvQjtRQTIvRDFDLDRCQUE0QjtRQUM1QixnQkFBZ0I7UUFDUixxQkFBZ0IsR0FBaUIsQ0FBQyxLQUFLLEVBQUUsS0FBSyxFQUFFLEVBQUU7WUFDeEQsSUFBSSxLQUFLLEdBQUcsS0FBSztnQkFBRSxPQUFPLENBQUMsQ0FBQztZQUM1QixJQUFJLEtBQUssR0FBRyxLQUFLO2dCQUFFLE9BQU8sQ0FBQyxDQUFDLENBQUM7WUFDN0IsT0FBTyxDQUFDLENBQUM7UUFDWCxDQUFDLENBQUM7UUFoZ0VBLGVBQWUsQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUNyQixJQUFJLENBQUMsSUFBSSxHQUFHLEdBQUcsQ0FBQztRQUNoQixNQUFNLGdCQUFnQixHQUF1QixHQUFtQixDQUM5RCxNQUFNLENBQUMsUUFBUSxDQUNoQixDQUFDO1FBQ0YsZ0VBQWdFO1FBQ2hFLG1FQUFtRTtRQUNuRSxJQUFJLGdCQUFnQixFQUFFO1lBQ3BCLElBQUksQ0FBQyxVQUFVLEdBQUcsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1NBQzlDO2FBQU07WUFDTCxJQUFJLENBQUMsVUFBVSxHQUFHLEdBQXdCLENBQUM7U0FDNUM7UUFDRCxJQUFJLENBQUMsUUFBUSxHQUFHLEtBQUssQ0FBQztRQUN0QixJQUFJLENBQUMsTUFBTSxHQUFHLElBQUksQ0FBQztRQUNuQixJQUFJLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQztRQUN0QixJQUFJLENBQUMsWUFBWSxHQUFHLEtBQUssQ0FBQztRQUMxQixJQUFJLENBQUMsYUFBYSxHQUFHLElBQUksQ0FB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
Linqer={ Enumerable: Enumerable };
