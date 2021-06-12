"use strict";
//Object.defineProperty(exports, "__esModule", { value: true });
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-this-alias */
/* eslint-disable @typescript-eslint/no-unused-vars */
class Enumerable {
    // not to be used
    constructor(src) {
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
    static from(iterable) {
        if (iterable instanceof Enumerable)
            return iterable;
        return new Enumerable(iterable);
    }
    static empty() {
        const result = new Enumerable([]);
        result._count = () => 0;
        result._tryGetAt = (_index) => null;
        result._canSeek = true;
        return result;
    }
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
    [Symbol.iterator]() {
        this._wasIterated = true;
        return this._generator();
    }
    canSeek() {
        this._ensureInternalTryGetAt();
        return this._canSeek;
    }
    get length() {
        this._ensureInternalTryGetAt();
        if (!this._canSeek)
            throw new Error('Calling length on this enumerable will iterate it. Use count()');
        return this.count();
    }
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
    count() {
        this._ensureInternalCount();
        return this._count();
    }
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
    elementAt(index) {
        this._ensureInternalTryGetAt();
        const result = this._tryGetAt(index);
        if (!result)
            throw new Error('Index out of range');
        return result.value;
    }
    elementAtOrDefault(index) {
        this._ensureInternalTryGetAt();
        const result = this._tryGetAt(index);
        if (!result)
            return undefined;
        return result.value;
    }
    first() {
        return this.elementAt(0);
    }
    firstOrDefault() {
        return this.elementAtOrDefault(0);
    }
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
        for (const item of this) {
            if (typeof agg.min === 'undefined' || comparer(item, agg.min) < 0)
                agg.min = item;
            if (typeof agg.max === 'undefined' || comparer(item, agg.max) > 0)
                agg.max = item;
            agg.count++;
        }
        return agg;
    }
    min(comparer) {
        const stats = this.stats(comparer);
        return stats.count === 0 ? undefined : stats.min;
    }
    max(comparer) {
        const stats = this.stats(comparer);
        return stats.count === 0 ? undefined : stats.max;
    }
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
    splice(start, howmany, ...newItems) {
        // tried to define length and splice so that this is seen as an Array-like object,
        // but it doesn't work on properties. length needs to be a field.
        return this.take(start)
            .concat(newItems)
            .concat(this.skip(start + howmany));
    }
    sum() {
        const stats = this.sumAndCount();
        return stats.count === 0 ? undefined : stats.sum;
    }
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
    toList() {
        this._ensureInternalTryGetAt();
        if (this._canSeek)
            return this;
        return Enumerable.from(this.toArray());
    }
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
    /// Applies an accumulator function over a sequence.
    /// The specified seed value is used as the initial accumulator value, and the specified function is used to select the result value.
    aggregate(accumulator, aggregator) {
        _ensureFunction(aggregator);
        for (const item of this) {
            accumulator = aggregator(accumulator, item);
        }
        return accumulator;
    }
    /// Determines whether all elements of a sequence satisfy a condition.
    all(condition) {
        _ensureFunction(condition);
        return !this.any((x) => !condition(x));
    }
    /// Determines whether any element of a sequence exists or satisfies a condition.
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
    /// Appends a value to the end of the sequence.
    append(item) {
        return this.concat([item]);
    }
    /// Computes the average of a sequence of numeric values.
    average() {
        const stats = this.sumAndCount();
        return stats.count === 0 ? undefined : stats.sum / stats.count;
    }
    /// Returns the same enumerable
    asEnumerable() {
        return this;
    }
    /// Checks the elements of a sequence based on their type
    /// If type is a string, it will check based on typeof, else it will use instanceof.
    /// Throws if types are different.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cast(type) {
        const f = typeof type === 'string'
            ? (x) => typeof x === type
            : (x) => x instanceof type;
        return this.select((item) => {
            if (!f(item))
                throw new Error(item + ' not of type ' + type);
            return item;
        });
    }
    /// Determines whether a sequence contains a specified element.
    /// A custom function can be used to determine equality between elements.
    contains(item, equalityComparer = (i1, i2) => i1 == i2) {
        _ensureFunction(equalityComparer);
        return this.any((x) => equalityComparer(x, item));
    }
    defaultIfEmpty() {
        throw new Error('defaultIfEmpty not implemented for Javascript');
    }
    /// Produces the set difference of two sequences WARNING: using the comparer is slower
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
    /// Produces the set intersection of two sequences. WARNING: using a comparer is slower
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
    /// same as count
    longCount() {
        return this.count();
    }
    /// Filters the elements of a sequence based on their type
    /// If type is a string, it will filter based on typeof, else it will use instanceof
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ofType(type) {
        const condition = typeof type === 'string'
            ? (x) => typeof x === type
            : (x) => x instanceof type;
        return this.where(condition);
    }
    /// Adds a value to the beginning of the sequence.
    prepend(item) {
        return new Enumerable([item]).concat(this);
    }
    /// Inverts the order of the elements in a sequence.
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
    /// Projects each element of a sequence to an iterable and flattens the resulting sequences into one sequence.
    selectMany(selector) {
        if (typeof selector !== 'undefined') {
            _ensureFunction(selector);
        }
        const self = this;
        const gen = function* () {
            let index = 0;
            for (const item of self) {
                const iter = selector
                    ? selector(item, index)
                    : item;
                _ensureIterable(iter);
                for (const child of iter) {
                    yield child;
                }
                index++;
            }
        };
        return new Enumerable(gen);
    }
    /// Determines whether two sequences are equal and in the same order according to an equality comparer.
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
    /// Returns the single element of a sequence and throws if it doesn't have exactly one
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
    /// Returns the single element of a sequence or undefined if none found. It throws if the sequence contains multiple items.
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
    /// Selects the elements starting at the given start argument, and ends at, but does not include, the given end argument.
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
    /// Returns a new enumerable collection that contains the elements from source with the last nr elements of the source collection omitted.
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
    /// Bypasses elements in a sequence as long as a specified condition is true and then returns the remaining elements.
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
    /// Returns a new enumerable collection that contains the last nr elements from source.
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
    /// Returns elements from a sequence as long as a specified condition is true, and then skips the remaining elements.
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
    toDictionary() {
        throw new Error('use toMap or toObject instead of toDictionary');
    }
    /// creates a map from an Enumerable
    toMap(keySelector, valueSelector = (i) => i) {
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
    /// creates an object from an enumerable
    toObject(keySelector, valueSelector = (x) => x) {
        _ensureFunction(keySelector);
        _ensureFunction(valueSelector);
        const result = {};
        let index = 0;
        for (const item of this) {
            result[keySelector(item, index)] = valueSelector(item);
            index++;
        }
        return result;
    }
    toHashSet() {
        throw new Error('use toSet instead of toHashSet');
    }
    /// creates a set from an enumerable
    toSet() {
        const result = new Set();
        for (const item of this) {
            result.add(item);
        }
        return result;
    }
    /// Produces the set union of two sequences.
    union(iterable, equalityComparer) {
        _ensureIterable(iterable);
        return this.concat(iterable).distinct(equalityComparer);
    }
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
    /// implements random reservoir sampling of k items, with the option to specify a maximum limit for the items
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
    /// returns the distinct values based on a hashing function
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
    /// returns the values that have different hashes from the items of the iterable provided
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
    /// returns the values that have the same hashes as items of the iterable provided
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
    /// returns the index of a value in an ordered enumerable or false if not found
    /// WARNING: use the same comparer as the one used in the ordered enumerable. The algorithm assumes the enumerable is already sorted.
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
    /// returns an enumerable of at least minLength, padding the end with a value or the result of a function
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
    /// returns an enumerable of at least minLength, padding the start with a value or the result of a function
    /// if the enumerable cannot seek, then it will be iterated minLength time
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
    /// Correlates the elements of two sequences based on key equality and groups the results. A specified equalityComparer is used to compare keys.
    /// WARNING: using the equality comparer will be slower
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
    /// Correlates the elements of two sequences based on matching keys.
    /// WARNING: using the equality comparer will be slower
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
    toLookup() {
        throw new Error('use groupBy instead of toLookup');
    }
    /// Sorts the elements of a sequence in ascending order.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    orderBy(keySelector) {
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
    /// use QuickSort for ordering (default). Recommended when take, skip, takeLast, skipLast are used after orderBy
    useQuickSort() {
        this._useQuickSort = true;
        return this;
    }
    /// use the default browser sort implementation for ordering at all times
    useBrowserSort() {
        this._useQuickSort = false;
        return this;
    }
    static sort(arr, comparer) {
        _quickSort(arr, 0, arr.length - 1, comparer, 0, Number.MAX_SAFE_INTEGER);
        return arr;
    }
    // if the internal count function is not defined, set it to the most appropriate one
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
    // ensure there is an internal indexer function adequate for this enumerable
    // this also determines if the enumerable can seek
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
class GroupEnumerable extends Enumerable {
    constructor(iterable, key) {
        super(iterable);
        this.key = key;
    }
}
var RestrictionType;
(function (RestrictionType) {
    RestrictionType[RestrictionType["skip"] = 0] = "skip";
    RestrictionType[RestrictionType["skipLast"] = 1] = "skipLast";
    RestrictionType[RestrictionType["take"] = 2] = "take";
    RestrictionType[RestrictionType["takeLast"] = 3] = "takeLast";
})(RestrictionType || (RestrictionType = {}));
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
    /// calculate the interval in which an array needs to have ordered items for this ordered enumerable
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
    thenBy(keySelector) {
        this._keySelectors.push({ keySelector: keySelector, ascending: true });
        return this;
    }
    thenByDescending(keySelector) {
        this._keySelectors.push({ keySelector: keySelector, ascending: false });
        return this;
    }
    take(nr) {
        this._restrictions.push({ type: RestrictionType.take, nr: nr });
        return this;
    }
    takeLast(nr) {
        this._restrictions.push({ type: RestrictionType.takeLast, nr: nr });
        return this;
    }
    skip(nr) {
        this._restrictions.push({ type: RestrictionType.skip, nr: nr });
        return this;
    }
    skipLast(nr) {
        this._restrictions.push({ type: RestrictionType.skipLast, nr: nr });
        return this;
    }
    toArray() {
        const { startIndex, endIndex, arr } = this.getSortedArray();
        return arr ? arr.slice(startIndex, endIndex) : [];
    }
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
    toObject(keySelector, valueSelector = (x) => x
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
    toSet() {
        const result = new Set();
        const arr = this.toArray();
        for (let i = 0; i < arr.length; i++) {
            result.add(arr[i]);
        }
        return result;
    }
}
const _insertionSortThreshold = 64;
/// insertion sort is used for small intervals
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
function _swapArrayItems(array, leftIndex, rightIndex) {
    const temp = array[leftIndex];
    array[leftIndex] = array[rightIndex];
    array[rightIndex] = temp;
}
// Quicksort partition by center value coming from both sides
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
function _ensureFunction(f) {
    if (!f || typeof f !== 'function')
        throw new Error('the argument needs to be a function!');
}
// return Nan if this is not a number
// different from Number(obj), which would cast strings to numbers
function _toNumber(obj) {
    return typeof obj === 'number' ? obj : Number.NaN;
}
// return the iterable if already an array or use Array.from to create one
function _toArray(iterable) {
    if (!iterable)
        return [];
    if (Array.isArray(iterable))
        return iterable;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return Array.from(iterable);
}
//exports.default = Enumerable;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiRW51bWVyYWJsZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9saWIvRW51bWVyYWJsZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUFBLDZEQUE2RDtBQUM3RCxxREFBcUQ7QUFDckQsc0RBQXNEO0FBQ3RELE1BQU0sVUFBVTtJQVdkLGlCQUFpQjtJQUNqQixZQUFzQixHQUFvQjtRQXVpRGxDLHFCQUFnQixHQUFpQixDQUFDLEtBQUssRUFBRSxLQUFLLEVBQUUsRUFBRTtZQUN4RCxJQUFJLEtBQUssR0FBRyxLQUFLO2dCQUFFLE9BQU8sQ0FBQyxDQUFDO1lBQzVCLElBQUksS0FBSyxHQUFHLEtBQUs7Z0JBQUUsT0FBTyxDQUFDLENBQUMsQ0FBQztZQUM3QixPQUFPLENBQUMsQ0FBQztRQUNYLENBQUMsQ0FBQztRQTFpREEsZUFBZSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQ3JCLElBQUksQ0FBQyxJQUFJLEdBQUcsR0FBRyxDQUFDO1FBQ2hCLE1BQU0sZ0JBQWdCLEdBQXVCLEdBQW1CLENBQzlELE1BQU0sQ0FBQyxRQUFRLENBQ2hCLENBQUM7UUFDRixnRUFBZ0U7UUFDaEUsbUVBQW1FO1FBQ25FLElBQUksZ0JBQWdCLEVBQUU7WUFDcEIsSUFBSSxDQUFDLFVBQVUsR0FBRyxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7U0FDOUM7YUFBTTtZQUNMLElBQUksQ0FBQyxVQUFVLEdBQUcsR0FBd0IsQ0FBQztTQUM1QztRQUNELElBQUksQ0FBQyxRQUFRLEdBQUcsS0FBSyxDQUFDO1FBQ3RCLElBQUksQ0FBQyxNQUFNLEdBQUcsSUFBSSxDQUFDO1FBQ25CLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDO1FBQ3RCLElBQUksQ0FBQyxZQUFZLEdBQUcsS0FBSyxDQUFDO1FBQzFCLElBQUksQ0FBQyxhQUFhLEdBQUcsSUFBSSxDQUFDO0lBQzVCLENBQUM7SUFFTSxNQUFNLENBQUMsSUFBSSxDQUFJ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