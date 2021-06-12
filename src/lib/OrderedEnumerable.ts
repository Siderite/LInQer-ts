/* eslint-disable @typescript-eslint/no-this-alias */
import Enumerable from './Enumerable';
import { RestrictionType } from './RestrictionType';
import { _ensureFunction, _quickSort, ISelector, IterableType } from './utils';

/**
 * Ordered enumerable, keeps a record of all the orderBy operations and uses them when iterating over it
 * @internal
 * @template T
 */
export default class OrderedEnumerable<T> extends Enumerable<T> {
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
