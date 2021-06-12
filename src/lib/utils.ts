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
export function _quickSort<T>(
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
export function _ensureIterable<T>(src: IterableType<T>): void {
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
export function _ensureFunction<T>(f: T): void {
  if (!f || typeof f !== 'function')
    throw new Error('the argument needs to be a function!');
}
// return Nan if this is not a number
// different from Number(obj), which would cast strings to numbers
/** @internal */
export function _toNumber<T>(obj: T): number {
  return typeof obj === 'number' ? obj : Number.NaN;
}
// return the iterable if already an array or use Array.from to create one
/** @internal */
export function _toArray<T>(iterable: IterableType<T>): Array<T> {
  if (!iterable) return [];
  if (Array.isArray(iterable)) return iterable;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return Array.from(iterable as any);
}

export type IterableType<T> = Iterable<T> | (() => Iterator<T>);
export type IEqualityComparer<T> = (item1: T, item2: T) => boolean;
export type IComparer<T> = (item1: T, item2: T) => -1 | 0 | 1;
export type ISelector<TItem, TResult> = (
  item: TItem,
  index?: number
) => TResult;
export type IFilter<T> = ISelector<T, boolean>;
