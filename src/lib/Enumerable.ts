/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-this-alias */
/* eslint-disable @typescript-eslint/no-unused-vars */

/**
 * wrapper class over iterable instances that exposes the methods usually found in .NET LINQ
 * @template T
 */
class Enumerable<T> implements Iterable<T> {
  /** @internal */
  protected _src: IterableType<T>;
  /** @internal */
  protected _generator: () => Iterator<T>;
  // indicates that count and elementAt functions will not cause iterating the enumerable
  /** @internal */
  protected _canSeek: boolean;
  /** @internal */
  protected _count: null | (() => number);
  /** @internal */
  protected _tryGetAt: null | ((index: number) => { value: T } | null);
  /** @internal */
  protected _useQuickSort: boolean;
  // true if the enumerable was iterated at least once
  /** @internal */
  _wasIterated: boolean;

  /**
   * Do not use directly - use the static 'from' method
   * @param src
   */
  protected constructor(src: IterableType<T>) {
    _ensureIterable(src);
    this._src = src;
    const iteratorFunction: () => Iterator<T> = (src as Iterable<T>)[
      Symbol.iterator
    ];
    // the generator is either the iterator of the source enumerable
    // or the generator function that was provided as the source itself
    if (iteratorFunction) {
      this._generator = iteratorFunction.bind(src);
    } else {
      this._generator = src as () => Iterator<T>;
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
  public static from<T>(iterable: IterableType<T>): Enumerable<T> {
    if (iterable instanceof Enumerable) return iterable as Enumerable<T>;
    return new Enumerable<T>(iterable);
  }

  /**
   * returns an empty Enumerable
   * @template T
   * @returns empty
   */
  public static empty<T>(): Enumerable<T> {
    const result = new Enumerable<T>([]);
    result._count = () => 0;
    result._tryGetAt = (_index: number) => null;
    result._canSeek = true;
    return result;
  }

  /**
   * generates a sequence of integer numbers within a specified range.
   * @param start
   * @param count
   * @returns range
   */
  public static range(start: number, count: number): Enumerable<number> {
    const gen = function* () {
      for (let i = 0; i < count; i++) {
        yield start + i;
      }
    };
    const result = new Enumerable<number>(gen);
    result._count = () => count;
    result._tryGetAt = (index) => {
      if (index >= 0 && index < count) return { value: start + index };
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
  public static repeat<T>(item: T, count: number): Enumerable<T> {
    const gen = function* () {
      for (let i = 0; i < count; i++) {
        yield item;
      }
    };
    const result = new Enumerable(gen);
    result._count = () => count;
    result._tryGetAt = (index) => {
      if (index >= 0 && index < count) return { value: item };
      return null;
    };
    result._canSeek = true;
    return result;
  }

  /**
   * the Enumerable instance exposes the same iterator as the wrapped iterable or generator function
   * @returns [symbol.iterator]
   */
  public [Symbol.iterator](): Iterator<T> {
    this._wasIterated = true;
    return this._generator();
  }

  /**
   * Determines whether the Enumerable can seek (lookup an item by index)
   * @returns
   */
  public canSeek() {
    this._ensureInternalTryGetAt();
    return this._canSeek;
  }

  /**
   * Gets the number of items in the enumerable
   * or throws an error if it needs to be enumerated to get it
   */
  public get length(): number {
    if (!this.canSeek())
      throw new Error(
        'Calling length on this enumerable will iterate it. Use count()'
      );
    return this.count();
  }

  /**
   * Concatenates two sequences by appending iterable to the existing one
   * @param iterable
   * @returns concat
   */
  public concat(iterable: IterableType<T>): Enumerable<T> {
    _ensureIterable(iterable);
    const self: Enumerable<T> = this;
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
    const result = new Enumerable<T>(gen);
    const other = Enumerable.from<T>(iterable);
    result._count = () => self.count() + other.count();
    this._ensureInternalTryGetAt();
    other._ensureInternalTryGetAt();
    result._canSeek = self._canSeek && other._canSeek;
    if (self._canSeek) {
      result._tryGetAt = (index) => {
        return self._tryGetAt!(index) || other._tryGetAt!(index - self.count());
      };
    }
    return result;
  }

  /**
   * Returns the number of items in the Enumerable, even if it has to enumerate all items to do it
   * @returns count
   */
  public count(): number {
    this._ensureInternalCount();
    return this._count!();
  }

  /**
   * Returns distinct elements from a sequence.
   * WARNING: using a comparer makes this slower. Not specifying it uses a Set to determine distinctiveness.
   * @param [equalityComparer]
   * @returns distinct
   */
  public distinct(equalityComparer?: IEqualityComparer<T>): Enumerable<T> {
    const self: Enumerable<T> = this;
    // if the comparer function is not provided, a Set will be used to quickly determine distinctiveness
    const gen =
      equalityComparer === undefined
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
              if (unique) yield item;
              values.push(item);
            }
          };
    return new Enumerable<T>(gen);
  }

  /**
   * Returns the element at a specified index in a sequence
   * @param index
   * @returns at
   */
  public elementAt(index: number): T {
    this._ensureInternalTryGetAt();
    const result = this._tryGetAt!(index);
    if (!result) throw new Error('Index out of range');
    return result.value;
  }

  /**
   * Returns the element at a specified index in a sequence
   * or undefined if the index is out of range.
   * @param index
   * @returns at or default
   */
  public elementAtOrDefault(index: number): T | undefined {
    this._ensureInternalTryGetAt();
    const result = this._tryGetAt!(index);
    if (!result) return undefined;
    return result.value;
  }

  /**
   * Returns the first element of a sequence
   * @returns first
   */
  public first(): T {
    return this.elementAt(0);
  }

  /**
   * Returns the first element of a sequence, or undefined if no element is found
   * @returns or default
   */
  public firstOrDefault(): T | undefined {
    return this.elementAtOrDefault(0);
  }

  /**
   * Returns the last element of a sequence
   * @returns last
   */
  public last(): T {
    this._ensureInternalTryGetAt();
    // if this cannot seek, getting the last element requires iterating the whole thing
    if (!this._canSeek) {
      let result: T | null = null;
      let found = false;
      for (const item of this) {
        result = item;
        found = true;
      }
      if (found) return result!;
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
  public lastOrDefault(): T | undefined {
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
  public stats(comparer?: IComparer<T>): {
    count: number;
    min?: T;
    max?: T;
  } {
    if (comparer) {
      _ensureFunction(comparer);
    } else {
      comparer = this._defaultComparer;
    }
    const agg = {
      count: 0,
      min: undefined as T | undefined,
      max: undefined as T | undefined,
    };
    const iterator=this[Symbol.iterator]();
    let val1=iterator.next();
    let val2=iterator.next();
    while (!val1.done && !val2.done)
    {
      if (comparer(val1.value,val2.value)>0) {
        if (agg.max === undefined || comparer(val1.value,agg.max)>0) agg.max=val1.value;
        if (agg.min === undefined || comparer(val2.value,agg.min)<0) agg.min=val2.value;
      } else {
        if (agg.max === undefined || comparer(val2.value,agg.max)>0) agg.max=val2.value;
        if (agg.min === undefined || comparer(val1.value,agg.min)<0) agg.min=val1.value;
      }
      agg.count+=2;
      val1=iterator.next();
      val2=iterator.next();
    }
    if (!val1.done) {
      if (agg.max === undefined || comparer(val1.value,agg.max)>0) agg.max=val1.value;
      else if (agg.min === undefined || comparer(val1.value,agg.min)<0) agg.min=val1.value;
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
  public min(comparer?: IComparer<T>): T | undefined {
    const stats = this.stats(comparer);
    return stats.count === 0 ? undefined : stats.min;
  }

  /**
   *  Returns the maximum value in a sequence of values.
   *  A custom function can be used to establish order (the result 0 means equal, 1 means larger, -1 means smaller)
   * @param [comparer]
   * @returns max
   */
  public max(comparer?: IComparer<T>): T | undefined {
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
  public select<TResult>(selector: ISelector<T, TResult>): Enumerable<TResult> {
    _ensureFunction(selector);
    const self: Enumerable<T> = this;
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
      const res = self._tryGetAt!(index);
      if (!res) return res;
      return { value: selector(res.value) };
    };
    return result;
  }

  /**
   * Bypasses a specified number of elements in a sequence and then returns an Enumerable of the remaining elements
   * @param nr
   * @returns skip
   */
  public skip(nr: number): Enumerable<T> {
    const self: Enumerable<T> = this;
    // the generator just enumerates the first nr numbers then starts yielding values
    // the count is the same as the original enumerable, minus the skipped items and at least 0
    // the indexer is the same as for the original, with an offset
    const gen = function* () {
      let nrLeft = nr;
      for (const item of self) {
        if (nrLeft > 0) {
          nrLeft--;
        } else {
          yield item;
        }
      }
    };
    const result = new Enumerable(gen);

    result._count = () => Math.max(0, self.count() - nr);
    this._ensureInternalTryGetAt();
    result._canSeek = this._canSeek;
    result._tryGetAt = (index) => self._tryGetAt!(index + nr);
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
  public splice(
    start: number,
    howmany: number,
    ...newItems: T[]
  ): Enumerable<T> {
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
  public sum(): number | undefined {
    const stats = this.sumAndCount();
    return stats.count === 0 ? undefined : stats.sum;
  }

  /**
   * Computes the sum and count of a sequence of numeric values
   * @returns and count
   */
  public sumAndCount(): { sum: number; count: number } {
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
  public take(nr: number): Enumerable<T> {
    const self: Enumerable<T> = this;
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
        if (index >= nr) return null;
        return self._tryGetAt!(index);
      };
    }
    return result;
  }

  /**
   * Creates an array from an Enumerable
   * @returns array
   */
  public toArray(): T[] {
    this._ensureInternalTryGetAt();
    // this should be faster than Array.from(this)
    if (this._canSeek) {
      const arr = new Array(this.count());
      for (let i = 0; i < arr.length; i++) {
        arr[i] = this._tryGetAt!(i)?.value;
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
  public toList(): Enumerable<T> {
    this._ensureInternalTryGetAt();
    if (this._canSeek) return this;
    return Enumerable.from(this.toArray());
  }

  /**
   * Filters a sequence of values based on a predicate
   * (equivalent to Javascript filter)
   * @param condition
   * @returns where
   */
  public where(condition: IFilter<T>): Enumerable<T> {
    _ensureFunction(condition);
    const self: Enumerable<T> = this;
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
  public aggregate<TAcc>(
    accumulator: TAcc,
    aggregator: (acc: TAcc, item: T) => TAcc
  ): TAcc {
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
  public all(condition: IFilter<T>): boolean {
    _ensureFunction(condition);
    return !this.any((x) => !condition(x));
  }

  /**
   * Determines whether any element of a sequence exists or satisfies a condition.
   * @param condition
   * @returns true if any
   */
  public any(condition: IFilter<T>): boolean {
    _ensureFunction(condition);
    let index = 0;
    for (const item of this) {
      if (condition(item, index)) return true;
      index++;
    }
    return false;
  }

  /**
   * Appends a value to the end of the sequence
   * @param item
   * @returns append
   */
  public append(item: T): Enumerable<T> {
    return this.concat([item]);
  }

  /**
   * Computes the average of a sequence of numeric values
   * @returns average
   */
  public average(): number | undefined {
    const stats = this.sumAndCount();
    return stats.count === 0 ? undefined : stats.sum / stats.count;
  }

  /**
   * Returns itself
   * @returns enumerable
   */
  public asEnumerable(): Enumerable<T> {
    return this;
  }

  /**
   * Checks the elements of a sequence based on their type
   *  If type is a string, it will check based on typeof, else it will use instanceof.
   *  Throws if types are different.
   * @param type
   * @returns cast
   */
  public cast(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    type: any
  ): Enumerable<T> {
    const f: (x: unknown) => boolean =
      typeof type === 'string'
        ? (x) => typeof x === type
        : (x) => x instanceof type;
    return this.select((item) => {
      if (!f(item)) throw new Error(item + ' not of type ' + type);
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
  public contains(
    item: T,
    equalityComparer: IEqualityComparer<T> = (i1, i2) => i1 == i2
  ): boolean {
    _ensureFunction(equalityComparer);
    return this.any((x) => equalityComparer(x, item));
  }

  /**
   * Not implemented
   * @returns if empty
   */
  public defaultIfEmpty(): never {
    throw new Error('defaultIfEmpty not implemented for Javascript');
  }

  /**
   * Produces the set difference of two sequences
   * WARNING: using the comparer is slower
   * @param iterable
   * @param [equalityComparer]
   * @returns except
   */
  public except(
    iterable: IterableType<T>,
    equalityComparer?: IEqualityComparer<T>
  ): Enumerable<T> {
    _ensureIterable(iterable);
    const self: Enumerable<T> = this;
    // use a Set for performance if the comparer is not set
    const gen =
      equalityComparer === undefined
        ? function* () {
            const distinctValues = Enumerable.from(iterable).toSet();
            for (const item of self) {
              if (!distinctValues.has(item)) yield item;
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
              if (unique) yield item;
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
  public intersect(
    iterable: IterableType<T>,
    equalityComparer?: IEqualityComparer<T>
  ): Enumerable<T> {
    _ensureIterable(iterable);
    const self: Enumerable<T> = this;
    // use a Set for performance if the comparer is not set
    const gen =
      equalityComparer === undefined
        ? function* () {
            const distinctValues = new Set(Enumerable.from(iterable));
            for (const item of self) {
              if (distinctValues.has(item)) yield item;
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
              if (!unique) yield item;
            }
          };
    return new Enumerable(gen);
  }

  /**
   * Same as count
   * @returns count
   */
  public longCount(): number {
    return this.count();
  }

  /**
   * Filters the elements of a sequence based on their type
   * If type is a string, it will filter based on typeof, else it will use instanceof
   * @param type
   * @returns type
   */
  public ofType(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    type: any
  ): Enumerable<T> {
    const condition: IFilter<T> =
      typeof type === 'string'
        ? (x) => typeof x === type
        : (x) => x instanceof type;
    return this.where(condition);
  }

  /**
   * Adds a value to the beginning of the sequence.
   * @param item
   * @returns prepend
   */
  public prepend(item: T): Enumerable<T> {
    return new Enumerable([item]).concat(this);
  }

  /**
   * Inverts the order of the elements in a sequence
   * @returns reverse
   */
  public reverse(): Enumerable<T> {
    this._ensureInternalTryGetAt();
    const self: Enumerable<T> = this;
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
      result._tryGetAt = (index) => self._tryGetAt!(self.count() - index - 1);
    }
    return result;
  }

  /**
   * Projects each element of a sequence to an iterable and flattens the resulting sequences into one sequence
   * @template TResult
   * @param [selector]
   * @returns many
   */
  public selectMany<TResult>(
    selector?: ISelector<T, Iterable<TResult>>
  ): Enumerable<TResult> {
    if (selector) {
      _ensureFunction(selector);
    } else {
      selector = (i) => i as unknown as Iterable<TResult>;
    }
    const self: Enumerable<T> = this;
    const gen = function* () {
      let index = 0;
      for (const item of self) {
        const iter = selector!(item, index);
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
  public sequenceEqual(
    iterable: IterableType<T>,
    equalityComparer: IEqualityComparer<T> = (i1, i2) => i1 == i2
  ): boolean {
    _ensureIterable(iterable);
    _ensureFunction(equalityComparer);
    const iterator1 = this[Symbol.iterator]();
    const iterator2 = Enumerable.from(iterable)[Symbol.iterator]();
    let done = false;
    do {
      const val1 = iterator1.next();
      const val2 = iterator2.next();
      const equal =
        (val1.done && val2.done) ||
        (!val1.done && !val2.done && equalityComparer(val1.value, val2.value));
      if (!equal) return false;
      done = !!val1.done;
    } while (!done);
    return true;
  }

  /**
   * Returns the single element of a sequence and throws if it doesn't have exactly one
   * @returns single
   */
  public single(): T {
    const iterator = this[Symbol.iterator]();
    let val = iterator.next();
    if (val.done) throw new Error('Sequence contains no elements');
    const result = val.value;
    val = iterator.next();
    if (!val.done) throw new Error('Sequence contains more than one element');
    return result;
  }

  /**
   * Returns the single element of a sequence or undefined if none found. It throws if the sequence contains multiple items
   * @returns or default
   */
  public singleOrDefault(): T | undefined {
    const iterator = this[Symbol.iterator]();
    let val = iterator.next();
    if (val.done) return undefined;
    const result = val.value;
    val = iterator.next();
    if (!val.done) throw new Error('Sequence contains more than one element');
    return result;
  }

  /**
   * Selects the elements starting at the given start argument, and ends at, but does not include, the given end argument
   * @param [start]
   * @param [end]
   * @returns slice
   */
  public slice(start = 0, end?: number): Enumerable<T> {
    let enumerable: Enumerable<T> = this;
    // when the end is defined and positive and start is negative,
    // the only way to compute the last index is to know the count
    if (end !== undefined && end >= 0 && (start || 0) < 0) {
      enumerable = enumerable.toList();
      start = enumerable.count() + start;
    }
    if (start !== 0) {
      if (start > 0) {
        enumerable = enumerable.skip(start);
      } else {
        enumerable = enumerable.takeLast(-start);
      }
    }
    if (end !== undefined) {
      if (end >= 0) {
        enumerable = enumerable.take(end - start);
      } else {
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
  public skipLast(nr: number): Enumerable<T> {
    const self: Enumerable<T> = this;
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
        if (index >= result.count()) return null;
        return self._tryGetAt!(index);
      };
    }
    return result;
  }

  /**
   * Bypasses elements in a sequence as long as a specified condition is true and then returns the remaining elements.
   * @param condition
   * @returns while
   */
  public skipWhile(condition: IFilter<T>): Enumerable<T> {
    _ensureFunction(condition);
    const self: Enumerable<T> = this;
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
  public takeLast(nr: number): Enumerable<T> {
    this._ensureInternalTryGetAt();
    const self: Enumerable<T> = this;
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
        if (index < 0 || index >= result.count()) return null;
        return self._tryGetAt!(self.count() - nr + index);
      };
    }
    return result;
  }

  /**
   * Returns elements from a sequence as long as a specified condition is true, and then skips the remaining elements
   * @param condition
   * @returns while
   */
  public takeWhile(condition: IFilter<T>): Enumerable<T> {
    _ensureFunction(condition);
    const self: Enumerable<T> = this;
    const gen = function* () {
      let index = 0;
      for (const item of self) {
        if (condition(item, index)) {
          yield item;
        } else {
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
  public toDictionary(): never {
    throw new Error('use toMap or toObject instead of toDictionary');
  }

  /**
   * Creates a map from an Enumerable based on a key function and a value function
   * @template TKey
   * @template TResult
   * @param keySelector
   * @param valueSelector
   * @returns map
   */
  public toMap<TKey, TResult>(
    keySelector: ISelector<T, TKey>,
    valueSelector: ISelector<T, TResult>
  ): Map<TKey, TResult>;

  /**
   * Creates a map from an Enumerable based on a key function and the value from the Enumerable
   * @template TKey
   * @template TResult
   * @param keySelector
   * @returns map
   */
  public toMap<TKey>(keySelector: ISelector<T, TKey>): Map<TKey, T>;

  public toMap<TKey, TResult>(
    keySelector: ISelector<T, TKey>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    valueSelector: ISelector<T, any> = (i) => i
  ): Map<TKey, TResult> {
    _ensureFunction(keySelector);
    _ensureFunction(valueSelector);
    const result = new Map<TKey, TResult>();
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
  public toObject(
    keySelector: ISelector<T, string>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    valueSelector: ISelector<T, any> = (x) => x
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): { [key: string]: any } {
    _ensureFunction(keySelector);
    _ensureFunction(valueSelector);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: { [key: string]: any } = {};
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
  public toHashSet(): never {
    throw new Error('use toSet instead of toHashSet');
  }

  /**
   * Creates a set from an enumerable
   * @returns set
   */
  public toSet(): Set<T> {
    const result = new Set<T>();
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
  public union(
    iterable: IterableType<T>,
    equalityComparer?: IEqualityComparer<T>
  ): Enumerable<T> {
    _ensureIterable(iterable);
    return this.concat(iterable).distinct(equalityComparer);
  }

  /**
   * Returns a randomized sequence of items from an initial source
   * @returns shuffle
   */
  public shuffle(): Enumerable<T> {
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
  public randomSample(
    k: number,
    limit: number = Number.MAX_SAFE_INTEGER
  ): Enumerable<T> {
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
    } else {
      // R algorithm
      for (const item of this) {
        if (index < k) {
          sample.push(item);
        } else {
          const j = Math.floor(Math.random() * index);
          if (j < k) {
            sample[j] = item;
          }
        }
        index++;
        if (index >= limit) break;
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
  public distinctByHash<TResult>(
    hashFunc: ISelector<T, TResult>
  ): Enumerable<T> {
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
  public exceptByHash<TResult>(
    iterable: IterableType<T>,
    hashFunc: ISelector<T, TResult>
  ): Enumerable<T> {
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
  public intersectByHash<TResult>(
    iterable: IterableType<T>,
    hashFunc: ISelector<T, TResult>
  ): Enumerable<T> {
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
  public binarySearch(
    value: T,
    comparer: IComparer<T> = this._defaultComparer
  ): number | boolean {
    const enumerable: Enumerable<T> = this.toList();
    let start = 0;
    let end = enumerable.count() - 1;

    while (start <= end) {
      const mid = (start + end) >> 1;
      const comp = comparer(enumerable.elementAt(mid), value);
      if (comp == 0) return mid;
      if (comp < 0) {
        start = mid + 1;
      } else {
        end = mid - 1;
      }
    }

    return false;
  }

  /**
   * Joins each item of the enumerable with previous items from the same enumerable
   * @template TResult
   * @param offset
   * @param zipper
   * @returns lag
   */
  public lag<TResult>(
    offset: number,
    zipper: (item1: T, item2?: T) => TResult
  ): Enumerable<TResult>;
  /**
   * Joins each item of the enumerable with previous items from the same enumerable
   * @param offset
   * @returns lag
   */
  public lag(offset: number): Enumerable<[T, T | undefined]>;

  /// joins each item of the enumerable with previous items from the same enumerable
  public lag(
    offset: number,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    zipper?: (item1: T, item2?: T) => any
  ) {
    if (!offset) {
      throw new Error('offset has to be positive');
    }
    if (offset < 0) {
      throw new Error(
        'offset has to be positive. Use .lead if you want to join with next items'
      );
    }
    if (!zipper) {
      zipper = (i1, i2) => [i1, i2];
    } else {
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
        yield zipper!(item, item2);
        buffer[index % offset] = item;
        index++;
      }
    };
    const result = new Enumerable(gen);
    // count is the same as of the original enumerable
    result._count = () => {
      const count = self.count();
      if (!result._wasIterated) result._wasIterated = self._wasIterated;
      return count;
    };
    // seeking is possible only if the original was seekable
    if (self._canSeek) {
      result._canSeek = true;
      result._tryGetAt = (index: number) => {
        const val1 = self._tryGetAt!(index);
        const val2 = self._tryGetAt!(index - offset);
        if (val1) {
          return {
            value: zipper!(val1.value, val2 ? val2.value : undefined),
          };
        }
        return null;
      };
    }
    return result;
  }

  /**
   * Joins each item of the enumerable with next items from the same enumerable
   * @template TResult
   * @param offset
   * @param zipper
   * @returns lead
   */
  public lead<TResult>(
    offset: number,
    zipper: (item1: T, item2?: T) => TResult
  ): Enumerable<TResult>;
  /**
   * Joins each item of the enumerable with next items from the same enumerable
   * @param offset
   * @returns lead
   */
  public lead(offset: number): Enumerable<[T, T | undefined]>;

  /// joins each item of the enumerable with next items from the same enumerable
  public lead(
    offset: number,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    zipper?: (item1: T, item2?: T) => any
  ) {
    if (!offset) {
      throw new Error('offset has to be positive');
    }
    if (offset < 0) {
      throw new Error(
        'offset has to be positive. Use .lag if you want to join with previous items'
      );
    }
    if (!zipper) {
      zipper = (i1, i2) => [i1, i2];
    } else {
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
          yield zipper!(item2, item);
        }
        buffer[index % offset] = item;
        index++;
      }
      for (let i = 0; i < offset; i++) {
        const item = buffer[(index + i) % offset];
        yield zipper!(item, undefined);
      }
    };
    const result = new Enumerable(gen);
    // count is the same as of the original enumerable
    result._count = () => {
      const count = self.count();
      if (!result._wasIterated) result._wasIterated = self._wasIterated;
      return count;
    };
    // seeking is possible only if the original was seekable
    if (self._canSeek) {
      result._canSeek = true;
      result._tryGetAt = (index: number) => {
        const val1 = self._tryGetAt!(index);
        const val2 = self._tryGetAt!(index + offset);
        if (val1) {
          return {
            value: zipper!(val1.value, val2 ? val2.value : undefined),
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
  public padEnd(
    minLength: number,
    filler: T | ((index: number) => T)
  ): Enumerable<T> {
    if (minLength <= 0) {
      throw new Error('minLength has to be positive.');
    }
    let fillerFunc: (index: number) => T;
    if (typeof filler !== 'function') {
      fillerFunc = (_index: number) => filler;
    } else {
      fillerFunc = filler as (index: number) => T;
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
      if (!result._wasIterated) result._wasIterated = self._wasIterated;
      return count;
    };
    // seeking is possible if the original was seekable
    if (self._canSeek) {
      result._canSeek = true;
      result._tryGetAt = (index: number) => {
        const val = self._tryGetAt!(index);
        if (val) return val;
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
  public padStart(
    minLength: number,
    filler: T | ((index: number) => T)
  ): Enumerable<T> {
    if (minLength <= 0) {
      throw new Error('minLength has to be positive.');
    }
    let fillerFunc: (index: number) => T;
    if (typeof filler !== 'function') {
      fillerFunc = (_index: number) => filler;
    } else {
      fillerFunc = filler as (index: number) => T;
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
        } else {
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
      if (!result._wasIterated) result._wasIterated = self._wasIterated;
      return count;
    };
    // seeking is possible only if the original was seekable
    if (self._canSeek) {
      result._canSeek = true;
      result._tryGetAt = (index: number) => {
        const count = self.count();
        const delta = minLength - count;
        if (delta <= 0) {
          return self._tryGetAt!(index);
        }
        if (index < delta) {
          return { value: fillerFunc(index) };
        }
        return self._tryGetAt!(index - delta);
      };
    }
    return result;
  }

  /**
   * Applies a specified function to the corresponding elements of two sequences, producing a sequence of the results.
   * @template TOther
   * @template TResult
   * @param iterable
   * @param zipper
   * @returns zip
   */
  public zip<TOther, TResult>(
    iterable: IterableType<TOther>,
    zipper: (item1: T, item2: TOther, index: number) => TResult
  ): Enumerable<TResult>;
  /**
   * Takes the corresponding elements of two sequences, producing a sequence of tuples of elements.
   * @template TOther
   * @param iterable
   * @returns zip
   */
  public zip<TOther>(iterable: IterableType<TOther>): Enumerable<[T, TOther]>;

  /// Applies a specified function to the corresponding elements of two sequences, producing a sequence of the results.
  public zip<TOther>(
    iterable: IterableType<TOther>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    zipper?: (item1: T, item2: TOther, index: number) => any
  ) {
    _ensureIterable(iterable);
    if (!zipper) {
      zipper = (i1, i2): [T, TOther] => [i1, i2];
    } else {
      _ensureFunction(zipper);
    }
    const self: Enumerable<T> = this;
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
          yield zipper!(val1.value, val2.value, index);
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
  public groupBy<TKey>(
    keySelector: ISelector<T, TKey>
  ): Enumerable<GroupEnumerable<T, TKey>> {
    _ensureFunction(keySelector);
    const self: Enumerable<T> = this;
    const gen = function* () {
      const groupMap = new Map<TKey, Array<T>>();
      let index = 0;
      // iterate all items and group them in a Map
      for (const item of self) {
        const key = keySelector(item, index);
        const group = groupMap.get(key);
        if (group) {
          group.push(item);
        } else {
          groupMap.set(key, [item]);
        }
        index++;
      }
      // then yield a GroupEnumerable for each group
      for (const [key, items] of groupMap) {
        const group = new GroupEnumerable<T, TKey>(items, key);
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
  public groupJoin<TOther, TKey, TResult>(
    iterable: IterableType<TOther>,
    innerKeySelector: ISelector<T, TKey>,
    outerKeySelector: ISelector<TOther, TKey>,
    resultSelector: (item1: T, item2: TOther[]) => TResult,
    equalityComparer?: IEqualityComparer<TKey>
  ): Enumerable<TResult> {
    const self: Enumerable<T> = this;
    const gen =
      equalityComparer === undefined
        ? function* () {
            const lookup = new Enumerable(iterable)
              .groupBy(outerKeySelector)
              .toMap(
                (g) => g.key,
                (g) => g
              );
            let index = 0;
            for (const innerItem of self) {
              const arr = _toArray(
                lookup.get(innerKeySelector(innerItem, index)) ?? []
              );
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
                if (
                  equalityComparer(
                    innerKeySelector(innerItem, innerIndex),
                    outerKeySelector(outerItem, outerIndex)
                  )
                ) {
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
  public join<TOther, TKey, TResult>(
    iterable: IterableType<TOther>,
    innerKeySelector: ISelector<T, TKey>,
    outerKeySelector: ISelector<TOther, TKey>,
    resultSelector: (item1: T, item2: TOther) => TResult,
    equalityComparer?: IEqualityComparer<TKey>
  ): Enumerable<TResult> {
    const self: Enumerable<T> = this;
    const gen =
      equalityComparer === undefined
        ? function* () {
            const lookup = new Enumerable(iterable)
              .groupBy(outerKeySelector)
              .toMap(
                (g) => g.key,
                (g) => g
              );
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
                if (
                  equalityComparer(
                    innerKeySelector(innerItem, innerIndex),
                    outerKeySelector(outerItem, outerIndex)
                  )
                ) {
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
  public toLookup(): never {
    throw new Error('use groupBy instead of toLookup');
  }

  /**
   * Sorts the elements of a sequence in ascending order
   * @template TOther
   * @param keySelector
   * @returns by
   */
  public orderBy<TOther>(
    keySelector: ISelector<T, TOther>
  ): OrderedEnumerable<T>;
  /**
   * Sorts the elements of a sequence in ascending order
   * @returns by
   */
  public orderBy(): OrderedEnumerable<T>;

  /// Sorts the elements of a sequence in ascending order.
  public orderBy(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    keySelector?: ISelector<T, any>
  ): OrderedEnumerable<T> {
    if (keySelector) {
      _ensureFunction(keySelector);
    } else {
      keySelector = (i) => i;
    }
    return new OrderedEnumerable(this, keySelector, true);
  }

  /**
   * Sorts the elements of a sequence in descending order
   * @template TOther
   * @param keySelector
   * @returns by descending
   */
  public orderByDescending<TOther>(
    keySelector: ISelector<T, TOther>
  ): OrderedEnumerable<T>;
  /**
   * Sorts the elements of a sequence in descending order
   * @returns by descending
   */
  public orderByDescending(): OrderedEnumerable<T>;

  /// Sorts the elements of a sequence in descending order.
  public orderByDescending(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    keySelector?: ISelector<T, any>
  ): OrderedEnumerable<T> {
    if (keySelector) {
      _ensureFunction(keySelector);
    } else {
      keySelector = (i) => i;
    }
    return new OrderedEnumerable(this, keySelector, false);
  }

  /**
   * use QuickSort for ordering (default). Recommended when take, skip, takeLast, skipLast are used after orderBy
   * @returns quick sort
   */
  public useQuickSort(): Enumerable<T> {
    this._useQuickSort = true;
    return this;
  }

  /**
   * use the default browser sort implementation for ordering at all times
   * @returns browser sort
   */
  public useBrowserSort(): Enumerable<T> {
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
  public static sort<T>(arr: T[], comparer?: IComparer<T>): T[] {
    _quickSort<T>(arr, 0, arr.length - 1, comparer, 0, Number.MAX_SAFE_INTEGER);
    return arr;
  }

  /**
   * If the internal count function is not defined, set it to the most appropriate one
   * @internal
   * @template T
   * @returns internal count
   */
  private _ensureInternalCount<T>(): void {
    const enumerable = this;
    if (enumerable._count) return;
    if (enumerable._src instanceof Enumerable) {
      // the count is the same as the underlying enumerable
      const innerEnumerable = enumerable._src as Enumerable<T>;
      innerEnumerable._ensureInternalCount();
      enumerable._count = () => innerEnumerable._count!();
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const src = enumerable._src as any;
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
      for (const _item of enumerable) x++;
      return x;
    };
  }

  /**
   * Ensure there is an internal indexer function adequate for this enumerable
   * This also determines if the enumerable can seek
   * @internal
   * @returns
   */
  protected _ensureInternalTryGetAt() {
    const enumerable = this;
    if (enumerable._tryGetAt) return;
    enumerable._canSeek = true;
    if (enumerable._src instanceof Enumerable) {
      // indexer and seekability is the same as for the underlying enumerable
      const innerEnumerable = enumerable._src as Enumerable<T>;
      innerEnumerable._ensureInternalTryGetAt();
      enumerable._tryGetAt = (index) => innerEnumerable._tryGetAt!(index);
      enumerable._canSeek = innerEnumerable._canSeek;
      return;
    }
    if (typeof enumerable._src === 'string') {
      const str = enumerable._src as string;
      // a string can be accessed by index
      enumerable._tryGetAt = (index) => {
        if (index < str.length) {
          return {
            value: str.charAt(index) as unknown as T,
          };
        }
        return null;
      };
      return;
    }
    if (Array.isArray(enumerable._src)) {
      const arr = enumerable._src as T[];
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
    const src = enumerable._src as any;
    if (
      typeof enumerable._src !== 'function' &&
      typeof src.length === 'number'
    ) {
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
        if (index === x) return { value: item };
        x++;
      }
      return null;
    };
  }

  // default comparer function
  /** @internal */
  private _defaultComparer: IComparer<T> = (item1, item2) => {
    if (item1 > item2) return 1;
    if (item1 < item2) return -1;
    return 0;
  };
}

/**
 * Enumerable of groups, generated by the groupBy methods
 * @internal
 * @template T
 * @template TKey
 */
class GroupEnumerable<T, TKey> extends Enumerable<T> {
  key: TKey;
  constructor(iterable: IterableType<T>, key: TKey) {
    super(iterable);
    this.key = key;
  }
}

/**
 * Ordered enumerable, keeps a record of all the orderBy operations and uses them when iterating over it
 * @internal
 * @template T
 */
class OrderedEnumerable<T> extends Enumerable<T> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _keySelectors: { keySelector: ISelector<T, any>; ascending: boolean }[];
  _restrictions: { type: RestrictionType; nr: number }[];

  constructor(
    src: IterableType<T>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    keySelector?: ISelector<T, any>,
    ascending = true
  ) {
    super(src);
    this._keySelectors = [];
    this._restrictions = [];
    if (keySelector) {
      this._keySelectors.push({
        keySelector: keySelector,
        ascending: ascending,
      });
    }
    const self: OrderedEnumerable<T> = this;
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
      const { startIndex, endIndex } = this.getStartAndEndIndexes(
        self._restrictions,
        totalCount
      );
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
  private getSortedArray() {
    const self = this;
    let startIndex: number;
    let endIndex: number;
    let arr: T[] | null = null;
    const innerEnumerable = Enumerable.from(self._src);
    // try to avoid enumerating the entire original into an array
    if (innerEnumerable.canSeek()) {
      ({ startIndex, endIndex } = self.getStartAndEndIndexes(
        self._restrictions,
        innerEnumerable.count()
      ));
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      arr = Array.from(self._src as any);
      ({ startIndex, endIndex } = self.getStartAndEndIndexes(
        self._restrictions,
        arr.length
      ));
    }
    if (startIndex < endIndex) {
      if (!arr) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        arr = Array.from(self._src as any);
      }
      // only quicksort supports partial ordering inside an interval
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sort: (item1: any, item2: any) => void = self._useQuickSort
        ? (a, c) => _quickSort(a, 0, a.length - 1, c, startIndex, endIndex)
        : (a, c) => a.sort(c);
      const sortFunc = self.generateSortFunc(self._keySelectors);
      sort(arr, sortFunc);
      return {
        startIndex,
        endIndex,
        arr,
      };
    } else {
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
  private generateSortFunc(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    selectors: { keySelector: ISelector<T, any>; ascending: boolean }[]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): (i1: any, i2: any) => number {
    // simplify the selectors into an array of comparers
    const comparers = selectors.map((s) => {
      const f = s.keySelector;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const comparer = (i1: any, i2: any) => {
        const k1 = f(i1);
        const k2 = f(i2);
        if (k1 > k2) return 1;
        if (k1 < k2) return -1;
        return 0;
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return s.ascending ? comparer : (i1: any, i2: any) => -comparer(i1, i2);
    });
    // optimize the resulting sort function in the most common case
    // (ordered by a single criterion)
    return comparers.length == 1
      ? comparers[0]
      : // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (i1: any, i2: any) => {
          for (let i = 0; i < comparers.length; i++) {
            const v = comparers[i](i1, i2);
            if (v) return v;
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
  private getStartAndEndIndexes(
    restrictions: { type: RestrictionType; nr: number }[],
    arrLength: number
  ) {
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
  public thenBy<TKey>(keySelector: ISelector<T, TKey>): OrderedEnumerable<T> {
    this._keySelectors.push({ keySelector: keySelector, ascending: true });
    return this;
  }

  /**
   * Performs a subsequent ordering of the elements in a sequence in descending order
   * @template TKey
   * @param keySelector
   * @returns by descending
   */
  public thenByDescending<TKey>(
    keySelector: ISelector<T, TKey>
  ): OrderedEnumerable<T> {
    this._keySelectors.push({ keySelector: keySelector, ascending: false });
    return this;
  }

  /**
   * Deferred and optimized implementation of take
   * @param nr
   * @returns take
   */
  public take(nr: number): OrderedEnumerable<T> {
    this._restrictions.push({ type: RestrictionType.take, nr: nr });
    return this;
  }

  /**
   * Deferred and optimized implementation of takeLast
   * @param nr
   * @returns last
   */
  public takeLast(nr: number): OrderedEnumerable<T> {
    this._restrictions.push({ type: RestrictionType.takeLast, nr: nr });
    return this;
  }

  /**
   * Deferred and optimized implementation of skip
   * @param nr
   * @returns skip
   */
  public skip(nr: number): OrderedEnumerable<T> {
    this._restrictions.push({ type: RestrictionType.skip, nr: nr });
    return this;
  }

  /**
   * Deferred and optimized implementation of skipLast
   * @param nr
   * @returns last
   */
  public skipLast(nr: number): OrderedEnumerable<T> {
    this._restrictions.push({ type: RestrictionType.skipLast, nr: nr });
    return this;
  }

  /**
   * An optimized implementation of toArray
   * @returns array
   */
  public toArray(): T[] {
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
  public toMap<TKey, TValue>(
    keySelector: ISelector<T, TKey>,
    valueSelector: ISelector<T, TValue> = (x) => x as unknown as TValue
  ): Map<TKey, TValue> {
    _ensureFunction(keySelector);
    _ensureFunction(valueSelector);
    const result = new Map<TKey, TValue>();
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
  public toObject(
    keySelector: ISelector<T, string>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    valueSelector: ISelector<T, any> = (x) => x
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): { [key: string]: any } {
    _ensureFunction(keySelector);
    _ensureFunction(valueSelector);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: { [key: string]: any } = {};
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
  public toSet(): Set<T> {
    const result = new Set<T>();
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
enum RestrictionType {
  skip,
  skipLast,
  take,
  takeLast,
}

/** @internal */
const _insertionSortThreshold = 64;

/// insertion sort is used for small intervals
/** @internal */
function _insertionsort<T>(
  arr: T[],
  leftIndex: number,
  rightIndex: number,
  comparer: IComparer<T>
) {
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
function _swapArrayItems<T>(
  array: T[],
  leftIndex: number,
  rightIndex: number
): void {
  const temp = array[leftIndex];
  array[leftIndex] = array[rightIndex];
  array[rightIndex] = temp;
}

// Quicksort partition by center value coming from both sides
/** @internal */
function _partition<T>(
  items: T[],
  left: number,
  right: number,
  comparer: IComparer<T>
) {
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
    } else {
      if (left === right) return left + 1;
    }
  }
  return left;
}

/// optimized Quicksort algorithm
/** @internal */
function _quickSort<T>(
  items: T[],
  left: number,
  right: number,
  comparer: IComparer<T> = (i1, i2) => (i1 > i2 ? 1 : i1 < i2 ? -1 : 0),
  minIndex = 0,
  maxIndex: number = Number.MAX_SAFE_INTEGER
) {
  if (!items.length) return items;

  // store partition indexes to be processed in here
  const partitions: { left: number; right: number }[] = [];
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
    } else {
      if (index < right && index < maxIndex) {
        partition.left = index;
      } else {
        size--;
      }
    }
  }
  return items;
}

// throw if src is not a generator function or an iterable
/** @internal */
function _ensureIterable<T>(src: IterableType<T>): void {
  if (src) {
    if ((src as Iterable<T>)[Symbol.iterator]) return;
    if (
      typeof src === 'function' &&
      // eslint-disable-next-line @typescript-eslint/ban-types
      (src as Function).constructor.name === 'GeneratorFunction'
    )
      return;
  }
  throw new Error('the argument must be iterable!');
}

// throw if f is not a function
/** @internal */
function _ensureFunction<T>(f: T): void {
  if (!f || typeof f !== 'function')
    throw new Error('the argument needs to be a function!');
}
// return Nan if this is not a number
// different from Number(obj), which would cast strings to numbers
/** @internal */
function _toNumber<T>(obj: T): number {
  return typeof obj === 'number' ? obj : Number.NaN;
}
// return the iterable if already an array or use Array.from to create one
/** @internal */
function _toArray<T>(iterable: IterableType<T>): Array<T> {
  if (!iterable) return [];
  if (Array.isArray(iterable)) return iterable;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return Array.from(iterable as any);
}

type IterableType<T> = Iterable<T> | (() => Iterator<T>);
type IEqualityComparer<T> = (item1: T, item2: T) => boolean;
type IComparer<T> = (item1: T, item2: T) => -1 | 0 | 1;
type ISelector<TItem, TResult> = (item: TItem, index?: number) => TResult;
type IFilter<T> = ISelector<T, boolean>;

export default Enumerable;
