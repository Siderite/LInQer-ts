/* eslint-disable @typescript-eslint/no-unused-vars */
import test from 'ava';

import Enumerable from '../lib/Enumerable';

// object and method tests

test('Enumerable.from with empty array', function (assert) {
  const enumerable = Enumerable.from([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: any[] = [];
  for (const item of enumerable) result.push(item);

  assert.deepEqual(result, [], 'Passed!');
});

test('Enumerable.from with non empty array', function (assert) {
  const enumerable = Enumerable.from([1, 'a2', 3, null]);
  const result = [];
  for (const item of enumerable) result.push(item);

  assert.deepEqual(result, [1, 'a2', 3, null], 'Passed!');
});

test('Enumerable.from with generator function', function (assert) {
  function* gen() {
    yield 1;
    yield 'a2';
    yield 3;
    yield null;
  }
  const enumerable = Enumerable.from(gen());
  const result = [];
  for (const item of enumerable) result.push(item);

  assert.deepEqual(result, [1, 'a2', 3, null], 'Passed!');
});

test('Enumerable.empty', function (assert) {
  const enumerable = Enumerable.empty();
  const result = [];
  for (const item of enumerable) result.push(item);

  assert.deepEqual(result, [], 'Passed!');
});

test('Enumerable.range', function (assert) {
  const enumerable = Enumerable.range(10, 2);
  const result = [];
  for (const item of enumerable) result.push(item);

  assert.deepEqual(result, [10, 11], 'Passed!');
});

test('Enumerable.repeat', function (assert) {
  const enumerable = Enumerable.repeat(10, 2);
  const result = [];
  for (const item of enumerable) result.push(item);

  assert.deepEqual(result, [10, 10], 'Passed!');
});

test('Enumerable.aggregate with numbers', function (assert) {
  const result = Enumerable.from([1, 2, 3]).aggregate(
    10,
    (acc, item) => acc + item * 2
  );
  assert.deepEqual(result, 22, 'Passed!');
});

test('Enumerable.aggregate with text', function (assert) {
  const result = Enumerable.from([1, 2, 3]).aggregate(
    '10',
    (acc, item) => acc + ' ' + item * 2
  );
  assert.deepEqual(result, '10 2 4 6', 'Passed!');
});

test('Enumerable.all true', function (assert) {
  const result = Enumerable.from([1, 2, 3]).all((item) => item > 0);
  assert.deepEqual(result, true, 'Passed!');
});
test('Enumerable.all false', function (assert) {
  const result = Enumerable.from([1, 2, 3]).all((item) => item > 2);
  assert.deepEqual(result, false, 'Passed!');
});

test('Enumerable.any true', function (assert) {
  const result = Enumerable.from([1, 2, 3]).any((item) => item > 2);
  assert.deepEqual(result, true, 'Passed!');
});
test('Enumerable.any false', function (assert) {
  const result = Enumerable.from([1, 2, 3]).any((item) => item > 10);
  assert.deepEqual(result, false, 'Passed!');
});

test('Enumerable.append', function (assert) {
  const result = Enumerable.from([1, 2, 3]).append(4).toArray();
  assert.deepEqual(result, [1, 2, 3, 4], 'Passed!');
});

test('Enumerable.average empty', function (assert) {
  const result = Enumerable.from([]).average();
  assert.deepEqual(result, undefined, 'Passed!');
});
test('Enumerable.average numbers', function (assert) {
  const result = Enumerable.from([1, 2, 3]).average();
  assert.deepEqual(result, 2, 'Passed!');
});
test('Enumerable.average not numbers', function (assert) {
  const result = Enumerable.from([1, 'xx2', 5]).average();
  assert.deepEqual(result, Number.NaN, 'Passed!');
});

test('Enumerable.concat', function (assert) {
  const result = Enumerable.from([1, 'xx2', 5]).concat([6, 7, 8]).toArray();
  assert.deepEqual(result, [1, 'xx2', 5, 6, 7, 8], 'Passed!');
});

test('Enumerable.contains true', function (assert) {
  const result = Enumerable.from([1, 'xx2', 5]).contains(5);
  assert.deepEqual(result, true, 'Passed!');
});
test('Enumerable.contains false', function (assert) {
  const result = Enumerable.from([1, 'xx2', 5]).contains(6);
  assert.deepEqual(result, false, 'Passed!');
});

test('Enumerable.count array', function (assert) {
  const result = Enumerable.from([1, 'xx2', 5]).count();
  assert.deepEqual(result, 3, 'Passed!');
});
test('Enumerable.count Map', function (assert) {
  const map = new Map();
  map.set(1, 2);
  map.set('a', '3');
  const result = Enumerable.from(map).count();
  assert.deepEqual(result, 2, 'Passed!');
});
test('Enumerable.count Set', function (assert) {
  const result = Enumerable.from(new Set().add(1).add(2).add(3).add(4)).count();
  assert.deepEqual(result, 4, 'Passed!');
});
test('Enumerable.count generator function', function (assert) {
  function* gen() {
    yield 'a';
    yield 1;
  }
  const result = Enumerable.from(gen()).count();
  assert.deepEqual(result, 2, 'Passed!');
});

test('Enumerable.distinct', function (assert) {
  const result = Enumerable.from([1, 2, 2, 3, '3']).distinct().toArray();
  assert.deepEqual(result, [1, 2, 3, '3'], 'Passed!');
});
test('Enumerable.distinct equality comparer', function (assert) {
  const result = Enumerable.from([1, 2, 2, 3, '3'])
    .distinct((i1, i2) => +i1 === +i2)
    .toArray();
  assert.deepEqual(result, [1, 2, 3], 'Passed!');
});

test('Enumerable.elementAt in range array', function (assert) {
  const result = Enumerable.from([1, 2, 2, 3, '3']).elementAt(3);
  assert.deepEqual(result, 3, 'Passed!');
});
test('Enumerable.elementAt below range array', function (assert) {
  assert.throws(() => Enumerable.from([1, 2, 2, 3, '3']).elementAt(-3));
});
test('Enumerable.elementAt above range array', function (assert) {
  assert.throws(() => Enumerable.from([1, 2, 2, 3, '3']).elementAt(30));
});
test('Enumerable.elementAtOrDefault in range array', function (assert) {
  const result = Enumerable.from([1, 2, 2, 3, '3']).elementAtOrDefault(3);
  assert.deepEqual(result, 3, 'Passed!');
});
test('Enumerable.elementAtOrDefault below range array', function (assert) {
  const result = Enumerable.from([1, 2, 2, 3, '3']).elementAtOrDefault(-3);
  assert.deepEqual(result, undefined, 'Passed!');
});
test('Enumerable.elementAtOrDefault above range array', function (assert) {
  const result = Enumerable.from([1, 2, 2, 3, '3']).elementAtOrDefault(30);
  assert.deepEqual(result, undefined, 'Passed!');
});

test('Enumerable.except', function (assert) {
  const result = Enumerable.from([1, 2, 2, 3, '3']).except([2, 3]).toArray();
  assert.deepEqual(result, [1, '3'], 'Passed!');
});
test('Enumerable.except equality comparer', function (assert) {
  const result = Enumerable.from([1, 2, 2, 3, '3'])
    .except([2, 3], (i1, i2) => +i1 === +i2)
    .toArray();
  assert.deepEqual(result, [1], 'Passed!');
});

test('Enumerable.first', function (assert) {
  const result = Enumerable.from([1, 2, 2, 3, '3']).first();
  assert.deepEqual(result, 1, 'Passed!');
});
test('Enumerable.first empty', function (assert) {
  assert.throws(() => Enumerable.from([]).first());
});
test('Enumerable.firstOrDefault', function (assert) {
  const result = Enumerable.from([]).firstOrDefault();
  assert.deepEqual(result, undefined, 'Passed!');
});

test('Enumerable.groupBy', function (assert) {
  const result = Enumerable.from([1, 2, 2, 3, '3', 'sasa', '0x4'])
    .groupBy((item) => +item > 2)
    .toArray();
  assert.deepEqual(result.length, 2, 'Passed!');
  assert.deepEqual(result[0].key, false, 'Passed!');
  assert.deepEqual(result[0].toArray(), [1, 2, 2, 'sasa'], 'Passed!');
  assert.deepEqual(result[1].key, true, 'Passed!');
  assert.deepEqual(result[1].toArray(), [3, '3', '0x4'], 'Passed!');
});

test('Enumerable.groupJoin', function (assert) {
  const result = Enumerable.from([1, 2, 3, 4, 37])
    .groupJoin(
      [10, 12, 331, 13, 56, 3, 22, 57, 43, 467, 212],
      (i) => i + '',
      (i) => (i + '').charAt(0),
      (i1, i2) => {
        return { i1: i1, i2: i2 };
      }
    )
    .toArray();
  assert.deepEqual(
    result,
    [
      { i1: 1, i2: [10, 12, 13] },
      { i1: 2, i2: [22, 212] },
      { i1: 3, i2: [331, 3] },
      { i1: 4, i2: [43, 467] },
      { i1: 37, i2: [] },
    ],
    'Passed!'
  );
});
test('Enumerable.groupJoin equality comparer', function (assert) {
  const result = Enumerable.from([1, 2, 3, 4, 37])
    .groupJoin(
      [10, 12, 331, 13, 56, 3, 22, 57, 43, 467, 212],
      (i) => i,
      (i) => i,
      (i1, i2) => {
        return { i1: i1, i2: i2 };
      },
      (i1, i2) => i2 % i1 === 0
    )
    .toArray();
  assert.deepEqual(
    result,
    [
      { i1: 1, i2: [10, 12, 331, 13, 56, 3, 22, 57, 43, 467, 212] },
      { i1: 2, i2: [10, 12, 56, 22, 212] },
      { i1: 3, i2: [12, 3, 57] },
      { i1: 4, i2: [12, 56, 212] },
      { i1: 37, i2: [] },
    ],
    'Passed!'
  );
});

test('Enumerable.intersect', function (assert) {
  const result = Enumerable.from([1, 2, 2, 3, '3'])
    .intersect([2, 3, 4])
    .toArray();
  assert.deepEqual(result, [2, 2, 3], 'Passed!');
});
test('Enumerable.intersect equality comparer', function (assert) {
  const result = Enumerable.from([1, 2, 2, 3, '3'])
    .intersect([2, 3, 4], (i1, i2) => +i1 === +i2)
    .toArray();
  assert.deepEqual(result, [2, 2, 3, '3'], 'Passed!');
});

test('Enumerable.join', function (assert) {
  const result = Enumerable.from([1, 2, 3, 4, 37])
    .join(
      [10, 12, 331, 13, 56, 3, 22, 57, 43, 467, 212],
      (i) => i + '',
      (i) => (i + '').charAt(0),
      (i1, i2) => i1 + ':' + i2
    )
    .toArray();
  assert.deepEqual(
    result,
    ['1:10', '1:12', '1:13', '2:22', '2:212', '3:331', '3:3', '4:43', '4:467'],
    'Passed!'
  );
});
test('Enumerable.join equality comparer', function (assert) {
  const result = Enumerable.from([1, 2, 3, 4, 37])
    .join(
      [10, 12, 331, 13, 56, 3, 22, 57, 43, 467, 212],
      (i) => i,
      (i) => i,
      (i1, i2) => i1 + ':' + i2,
      (i1, i2) => i2 % i1 === 0
    )
    .toArray();
  assert.deepEqual(
    result,
    [
      '1:10',
      '1:12',
      '1:331',
      '1:13',
      '1:56',
      '1:3',
      '1:22',
      '1:57',
      '1:43',
      '1:467',
      '1:212',
      '2:10',
      '2:12',
      '2:56',
      '2:22',
      '2:212',
      '3:12',
      '3:3',
      '3:57',
      '4:12',
      '4:56',
      '4:212',
    ],
    'Passed!'
  );
});

test('Enumerable.last', function (assert) {
  const result = Enumerable.from([1, 2, 2, 3, '3']).last();
  assert.deepEqual(result, '3', 'Passed!');
});
test('Enumerable.last empty', function (assert) {
  assert.throws(() => Enumerable.from([]).last());
});
test('Enumerable.lastOrDefault', function (assert) {
  const result = Enumerable.from([]).lastOrDefault();
  assert.deepEqual(result, undefined, 'Passed!');
});

test('Enumerable.longCount empty', function (assert) {
  const result = Enumerable.from([]).longCount();
  assert.deepEqual(result, 0, 'Passed!');
});
test('Enumerable.longCount array', function (assert) {
  const result = Enumerable.from([1, 2, 3]).longCount();
  assert.deepEqual(result, 3, 'Passed!');
});

test('Enumerable.max numbers', function (assert) {
  const result = Enumerable.from([3, 5, 1, 2, 56, 2, -100, 43]).max();
  assert.deepEqual(result, 56, 'Passed!');
});
test('Enumerable.max strings', function (assert) {
  const result = Enumerable.from(['ba', 'a', 'abba', 'aaa', 'bb']).max();
  assert.deepEqual(result, 'bb', 'Passed!');
});

test('Enumerable.min number', function (assert) {
  const result = Enumerable.from([3, 5, 1, 2, 56, 2, -100, 43]).min();
  assert.deepEqual(result, -100, 'Passed!');
});
test('Enumerable.min custom comparer', function (assert) {
  const result = Enumerable.from([3, 5, 1, 2, 56, 2, -100, 43]).min((i1, i2) =>
    _sign(i1.toString().length - i2.toString().length)
  );
  assert.deepEqual(result, 3, 'Passed!');
});

test('Enumerable.ofType string parameter', function (assert) {
  const result = Enumerable.from([
    undefined,
    null,
    Number.NaN,
    1,
    -1000,
    'some text',
    { value: 'an object' },
    Enumerable.empty,
  ])
    .ofType('string')
    .toArray();
  assert.deepEqual(result, ['some text'], 'Passed!');
});
test('Enumerable.ofType type parameter', function (assert) {
  const enumerable = Enumerable.empty();
  const result = Enumerable.from([
    undefined,
    null,
    Number.NaN,
    1,
    -1000,
    'some text',
    { value: 'an object' },
    enumerable,
  ])
    .ofType(Enumerable)
    .toArray();
  assert.deepEqual(result, [enumerable], 'Passed!');
});

test('Enumerable.orderBy', function (assert) {
  const result = Enumerable.from([1, 3, 2, 4, 5, 0]).orderBy().toArray();
  assert.deepEqual(result, [0, 1, 2, 3, 4, 5], 'Passed!');
});
test('Enumerable.orderBy custom comparer forced QuickSort', function (assert) {
  const result = Enumerable.from([1, 3, 2, 4, 5, 0])
    .orderBy((i) => i % 2)
    .take(Number.MAX_SAFE_INTEGER) // force QuickSort
    .toArray();
  assert.deepEqual(
    result.map((i) => i % 2),
    [0, 0, 0, 1, 1, 1],
    'Passed!'
  );
});
test('Enumerable.orderBy custom comparer browser sort', function (assert) {
  const result = Enumerable.from([1, 3, 2, 4, 5, 0])
    .useBrowserSort()
    .orderBy((i) => i % 2)
    .toArray();
  assert.deepEqual(result, [2, 4, 0, 1, 3, 5], 'Passed!');
});
test('Enumerable.orderByDescending', function (assert) {
  const result = Enumerable.from([1, 3, 2, 4, 5, 0])
    .orderByDescending()
    .toArray();
  assert.deepEqual(result, [5, 4, 3, 2, 1, 0], 'Passed!');
});

test('Enumerable.prepend', function (assert) {
  const result = Enumerable.from([1, 3, 2]).prepend(0).toArray();
  assert.deepEqual(result, [0, 1, 3, 2], 'Passed!');
});

test('Enumerable.reverse', function (assert) {
  const result = Enumerable.from(['a', 1, 3, 2]).reverse().toArray();
  assert.deepEqual(result, [2, 3, 1, 'a'], 'Passed!');
});

test('Enumerable.select', function (assert) {
  const result = Enumerable.from(['a', 1, 3, 2])
    .select((item) =>
      typeof item === 'number' && Number.isInteger(item)
        ? item * item
        : item + '^2'
    )
    .toArray();
  assert.deepEqual(result, ['a^2', 1, 9, 4], 'Passed!');
});

test('Enumerable.selectMany', function (assert) {
  const result = Enumerable.from([
    [1, 2],
    [2, 3],
  ])
    .selectMany()
    .toArray();
  assert.deepEqual(result, [1, 2, 2, 3], 'Passed!');
});
test('Enumerable.selectMany custom function', function (assert) {
  const result = Enumerable.from([
    [1, 2],
    [2, 3, 4],
  ])
    .selectMany((item) => [item.length])
    .toArray();
  assert.deepEqual(result, [2, 3], 'Passed!');
});

test('Enumerable.sequenceEqual true', function (assert) {
  const result = Enumerable.from([1, 2, 3]).sequenceEqual([1, 2, 3]);
  assert.deepEqual(result, true, 'Passed!');
});
test('Enumerable.sequenceEqual false shorter', function (assert) {
  const result = Enumerable.from([1, 2]).sequenceEqual([1, 2, 3]);
  assert.deepEqual(result, false, 'Passed!');
});
test('Enumerable.sequenceEqual false shorter 2', function (assert) {
  const result = Enumerable.from([1, 2, 3]).sequenceEqual([1, 2]);
  assert.deepEqual(result, false, 'Passed!');
});
test('Enumerable.sequenceEqual false out of order', function (assert) {
  const result = Enumerable.from([1, 3, 2]).sequenceEqual([1, 2, 3]);
  assert.deepEqual(result, false, 'Passed!');
});

test('Enumerable.single true', function (assert) {
  const result = Enumerable.from([11]).single();
  assert.deepEqual(result, 11, 'Passed!');
});
test('Enumerable.single empty throws', function (assert) {
  assert.throws(() => Enumerable.empty().single());
});
test('Enumerable.single multiple throws', function (assert) {
  assert.throws(() => Enumerable.from([1, 2]).single());
});
test('Enumerable.singleOrDefault true', function (assert) {
  const result = Enumerable.from([11]).singleOrDefault();
  assert.deepEqual(result, 11, 'Passed!');
});
test('Enumerable.singleOrDefault empty', function (assert) {
  const result = Enumerable.from([]).singleOrDefault();
  assert.deepEqual(result, undefined, 'Passed!');
});
test('Enumerable.singleOrDefault multiple throws', function (assert) {
  assert.throws(() => Enumerable.from([1, 2]).singleOrDefault());
});

test('Enumerable.skip', function (assert) {
  const result = Enumerable.from([1, 2, 3, 4, 5]).skip(2).toArray();
  assert.deepEqual(result, [3, 4, 5], 'Passed!');
});
test('Enumerable.skipLast', function (assert) {
  const result = Enumerable.from([1, 2, 3, 4, 5]).skipLast(2).toArray();
  assert.deepEqual(result, [1, 2, 3], 'Passed!');
});
test('Enumerable.skipWhile', function (assert) {
  const result = Enumerable.from([1, 2, 3, 2, 1])
    .skipWhile((item) => item < 3)
    .toArray();
  assert.deepEqual(result, [3, 2, 1], 'Passed!');
});

test('Enumerable.slice empty', function (assert) {
  const arr = [1, 2, 3, 4, 5];
  const result = Enumerable.from(arr).slice().toArray();
  assert.deepEqual(result, arr.slice(), 'Passed!');
});
test('Enumerable.slice positive', function (assert) {
  const arr = [1, 2, 3, 4, 5];
  const result = Enumerable.from(arr).slice(2).toArray();
  assert.deepEqual(result, arr.slice(2), 'Passed!');
});
test('Enumerable.slice positive positive', function (assert) {
  const arr = [1, 2, 3, 4, 5];
  const result = Enumerable.from(arr).slice(2, 4).toArray();
  assert.deepEqual(result, arr.slice(2, 4), 'Passed!');
});
test('Enumerable.slice negative', function (assert) {
  const arr = [1, 2, 3, 4, 5];
  const result = Enumerable.from(arr).slice(-2).toArray();
  assert.deepEqual(result, arr.slice(-2), 'Passed!');
});
test('Enumerable.slice negative positive', function (assert) {
  const arr = [1, 2, 3, 4, 5];
  const result = Enumerable.from(arr).slice(-2, 4).toArray();
  assert.deepEqual(result, arr.slice(-2, 4), 'Passed!');
});
test('Enumerable.slice negative positive 2', function (assert) {
  const arr = [1, 2, 3, 4, 5];
  const result = Enumerable.from(arr).slice(-4, 2).toArray();
  assert.deepEqual(result, arr.slice(-4, 2), 'Passed!');
});
test('Enumerable.slice negative negative', function (assert) {
  const arr = [1, 2, 3, 4, 5];
  const result = Enumerable.from(arr).slice(-4, -1).toArray();
  assert.deepEqual(result, arr.slice(-4, -1), 'Passed!');
});

test('Enumerable.sum numbers', function (assert) {
  const result = Enumerable.from([1, 2, 3, 4, 5]).sum();
  assert.deepEqual(result, 15, 'Passed!');
});
test('Enumerable.sum numbers with some strings', function (assert) {
  const result = Enumerable.from([1, 2, 3, 4, 5, '6']).sum();
  assert.deepEqual(result, Number.NaN, 'Passed!');
});

test('Enumerable.take', function (assert) {
  const result = Enumerable.from([1, 2, 3, 4, 5]).take(2).toArray();
  assert.deepEqual(result, [1, 2], 'Passed!');
});
test('Enumerable.takeLast array', function (assert) {
  const result = Enumerable.from([1, 2, 3, 4, 5]).takeLast(2).toArray();
  assert.deepEqual(result, [4, 5], 'Passed!');
});
test('Enumerable.takeLast generator', function (assert) {
  function* gen() {
    yield 1;
    yield 2;
    yield 3;
    yield 4;
    yield 5;
  }
  const result = Enumerable.from(gen()).takeLast(2).toArray();
  assert.deepEqual(result, [4, 5], 'Passed!');
});
test('Enumerable.takeWhile', function (assert) {
  const result = Enumerable.from([1, 2, 3, 2, 1])
    .takeWhile((item) => item < 3)
    .toArray();
  assert.deepEqual(result, [1, 2], 'Passed!');
});

test('Enumerable.toMap', function (assert) {
  const result = Enumerable.from([1, 2, 3, 4, 5]).toMap(
    (item) => item,
    (item) => item * item
  );
  assert.deepEqual(
    result,
    new Map([
      [1, 1],
      [2, 4],
      [3, 9],
      [4, 16],
      [5, 25],
    ]),
    'Passed!'
  );
});
test('Enumerable.toObject', function (assert) {
  const result = Enumerable.from([1, 2, 3, 4, 5]).toObject(
    (item) => 'k' + item
  );
  assert.deepEqual(result, { k1: 1, k2: 2, k3: 3, k4: 4, k5: 5 }, 'Passed!');
});
test('Enumerable.toSet', function (assert) {
  const result = Enumerable.from([1, 2, 3, 4, 5]).toSet();
  assert.deepEqual(result, new Set([1, 2, 3, 4, 5]), 'Passed!');
});

test('Enumerable.union', function (assert) {
  const result = Enumerable.from([1, 1, 2]).union([3, 2]).toArray();
  assert.deepEqual(result, [1, 2, 3], 'Passed!');
});
test('Enumerable.union equality comparer', function (assert) {
  const result = Enumerable.from([11, 12, 26])
    .union([31, 23], (i1, i2) => (i1 + '').charAt(0) === (i2 + '').charAt(0))
    .toArray();
  assert.deepEqual(result, [11, 26, 31], 'Passed!');
});

test('Enumerable.where', function (assert) {
  const result = Enumerable.from([1, 2, 3, 4, 5])
    .where((item) => item % 2 > 0)
    .toArray();
  assert.deepEqual(result, [1, 3, 5], 'Passed!');
});
test('Enumerable.where with index', function (assert) {
  const idxs: Array<number | undefined> = [];
  const result = Enumerable.from([1, 2, 3, 4, 5])
    .where((item, index) => {
      idxs.push(index);
      return item % 2 > 0;
    })
    .toArray();
  assert.deepEqual(result, [1, 3, 5], 'Passed!');
  assert.deepEqual(idxs, [0, 1, 2, 3, 4], 'Passed!');
});

test('Enumerable.zip', function (assert) {
  const result = Enumerable.from([1, 2, 3, 4])
    .zip(['a', 'b', 'c'], (i1, i2) => i2 + ' ' + i1)
    .toArray();
  assert.deepEqual(result, ['a 1', 'b 2', 'c 3'], 'Passed!');
});
test('Enumerable.zip with index', function (assert) {
  const idxs: Array<number | undefined> = [];
  const result = Enumerable.from([1, 2, 3, 4])
    .zip(['a', 'b', 'c'], (i1, i2, index) => {
      idxs.push(index);
      return i2 + ' ' + i1;
    })
    .toArray();
  assert.deepEqual(result, ['a 1', 'b 2', 'c 3'], 'Passed!');
  assert.deepEqual(idxs, [0, 1, 2], 'Passed!');
});

// OrderedEnumerable tests

test('OrderedEnumerable.thenBy', function (assert) {
  const result = Enumerable.from([1, 2, 3, 4])
    .orderBy((i) => i % 2 == 0)
    .thenBy((i) => -i)
    .toArray();
  assert.deepEqual(result, [3, 1, 4, 2], 'Passed!');
});
test('OrderedEnumerable.thenByDescending', function (assert) {
  const result = Enumerable.from([1, 2, 3, 4])
    .orderByDescending((i) => i % 2 == 0)
    .thenByDescending((i) => -i)
    .toArray();
  assert.deepEqual(result, [2, 4, 1, 3], 'Passed!');
});
test('OrderedEnumerable.thenByDescending and thenBy and select QuickSort', function (assert) {
  const result = Enumerable.from(['a1', 'a2', 'a3', 'b1', 'b2', 'c1', 'c3'])
    .useQuickSort()
    .orderBy((_i) => 0)
    .thenByDescending((i) => i.charAt(1))
    .thenBy((i) => i.charAt(0) == 'b')
    .select((i) => 'x' + i)
    .toArray();
  //assert.deepEqual( result,['xa3','xc3','xa2','xb2','xc1','xa1','xb1'], "Passed!" );
  assert.deepEqual(
    result.map((i) => i.charAt(2)),
    ['3', '3', '2', '2', '1', '1', '1'],
    'Passed!'
  );
  assert.deepEqual(result[3].charAt(1), 'b', 'Passed!');
  assert.deepEqual(result[6].charAt(1), 'b', 'Passed!');
});
test('OrderedEnumerable.thenByDescending and thenBy and select default sort', function (assert) {
  const result = Enumerable.from(['a1', 'a2', 'a3', 'b1', 'b2', 'c1', 'c3'])
    .useBrowserSort()
    .orderBy((_i) => 0)
    .thenByDescending((i) => i.charAt(1))
    .thenBy((i) => i.charAt(0) == 'b')
    .select((i) => 'x' + i)
    .toArray();
  assert.deepEqual(
    result,
    ['xa3', 'xc3', 'xa2', 'xb2', 'xa1', 'xc1', 'xb1'],
    'Passed!'
  );
});

test('OrderedEnumerable then take', function (assert) {
  const result = Enumerable.from([3, 2, 1, 4]).orderBy().take(2).toArray();
  assert.deepEqual(result, [1, 2], 'Passed!');
});
test('OrderedEnumerable then skip', function (assert) {
  const result = Enumerable.from([3, 2, 1, 4]).orderBy().skip(2).toArray();
  assert.deepEqual(result, [3, 4], 'Passed!');
});
test('OrderedEnumerable then takeLast', function (assert) {
  const result = Enumerable.from([3, 2, 1, 4]).orderBy().takeLast(2).toArray();
  assert.deepEqual(result, [3, 4], 'Passed!');
});
test('OrderedEnumerable then skipLast', function (assert) {
  const result = Enumerable.from([3, 2, 1, 4]).orderBy().take(2).toArray();
  assert.deepEqual(result, [1, 2], 'Passed!');
});
test('OrderedEnumerable with multiple restrictions', function (assert) {
  const result = Enumerable.from([3, 2, 1, 4, 6, 5, 9, 8, 7, 0])
    .orderBy()
    .skip(2)
    .take(7)
    .skipLast(3)
    .takeLast(2);
  assert.deepEqual(result._wasIterated, false, 'Passed!');
  const arr = result.toArray();
  assert.deepEqual(arr, [4, 5], 'Passed!');
});
test('Enumerable.sort in place', function (assert) {
  const arr = [1, 2, 3, 4];
  const result = Enumerable.sort(arr, (i1, i2) =>
    i1 % 2 > i2 % 2 ? 1 : i1 % 2 < i2 % 2 ? -1 : 0
  );
  assert.deepEqual(arr, result, 'Passed!');
  assert.deepEqual(
    arr.map((i) => i % 2),
    [0, 0, 1, 1],
    'Passed!'
  );
});

// repeat tests

test('Enumerable.range repeat', function (assert) {
  const result = Enumerable.range(1, 3);
  assert.deepEqual(Array.from(result), [1, 2, 3], 'Passed!');
  assert.deepEqual(Array.from(result), [1, 2, 3], 'Passed!');
});
test('Enumerable.take repeat', function (assert) {
  const result = Enumerable.from([1, 2, 3, 4, 5, 6, 7, 8, 9]).take(3);
  assert.deepEqual(Array.from(result), [1, 2, 3], 'Passed!');
  assert.deepEqual(Array.from(result), [1, 2, 3], 'Passed!');
});
test('Enumerable.take reverse', function (assert) {
  const result = Enumerable.from([3, 2, 1]).reverse();
  assert.deepEqual(Array.from(result), [1, 2, 3], 'Passed!');
  assert.deepEqual(Array.from(result), [1, 2, 3], 'Passed!');
});
test('Enumerable.take orderBy', function (assert) {
  const result = Enumerable.from([2, 4, 5, 3, 1]).orderBy();
  assert.deepEqual(Array.from(result), [1, 2, 3, 4, 5], 'Passed!');
  assert.deepEqual(Array.from(result), [1, 2, 3, 4, 5], 'Passed!');
});
test('Enumerable.take orderBy take', function (assert) {
  const result = Enumerable.from([2, 4, 5, 3, 1]).orderBy().skip(1).take(3);
  assert.deepEqual(Array.from(result), [2, 3, 4], 'Passed!');
  assert.deepEqual(Array.from(result), [2, 3, 4], 'Passed!');
});

// composable count tests

test('Enumerable.empty count', function (assert) {
  const result = Enumerable.empty();
  assert.deepEqual(result.elementAtOrDefault(1), undefined, 'Passed!');
  assert.deepEqual(result._wasIterated, false, 'Passed!');
});
test('Enumerable.repeat count', function (assert) {
  const result = Enumerable.repeat(100, 1000000000);
  assert.deepEqual(result.elementAtOrDefault(12345), 100, 'Passed!');
  assert.deepEqual(result._wasIterated, false, 'Passed!');
});
test('Enumerable.range count', function (assert) {
  const result = Enumerable.range(100, 1000000000);
  assert.deepEqual(result.elementAtOrDefault(12345), 12445, 'Passed!');
  assert.deepEqual(result._wasIterated, false, 'Passed!');
});
test('Enumerable.concat seekable count ', function (assert) {
  const result = Enumerable.range(100, 10000).concat(
    Enumerable.repeat(10, 20000)
  );
  assert.deepEqual(result.count(), 30000, 'Passed!');
  assert.deepEqual(result._wasIterated, false, 'Passed!');
});
test('Enumerable.concat unseekable count', function (assert) {
  const iterable = Enumerable.from(function* () {
    yield 1;
  });
  const result = Enumerable.range(100, 10000).concat(iterable);
  assert.deepEqual(result.count(), 10001, 'Passed!');
  assert.deepEqual(result._wasIterated, false, 'Passed!');
  assert.deepEqual(iterable._wasIterated, true, 'Passed!');
});
test('orderBy count', function (assert) {
  const result = Enumerable.range(100, 10000).orderBy((i) => i + 1);
  assert.deepEqual(result.count(), 10000, 'Passed!');
  assert.deepEqual(result._wasIterated, false, 'Passed!');
});
test('reverse count', function (assert) {
  const result = Enumerable.range(100, 10000).reverse();
  assert.deepEqual(result.count(), 10000, 'Passed!');
  assert.deepEqual(result._wasIterated, false, 'Passed!');
});
test('skip count', function (assert) {
  const result = Enumerable.range(100, 10000).skip(5);
  assert.deepEqual(result.count(), 9995, 'Passed!');
  assert.deepEqual(result._wasIterated, false, 'Passed!');
});
test('skipLast count', function (assert) {
  const result = Enumerable.range(100, 10000).skipLast(5);
  assert.deepEqual(result.count(), 9995, 'Passed!');
  assert.deepEqual(result._wasIterated, false, 'Passed!');
});
test('take count', function (assert) {
  const result = Enumerable.range(100, 10000).take(5);
  assert.deepEqual(result.count(), 5, 'Passed!');
  assert.deepEqual(result._wasIterated, false, 'Passed!');
});
test('takeLast count', function (assert) {
  const result = Enumerable.range(100, 10000).takeLast(5);
  assert.deepEqual(result.count(), 5, 'Passed!');
  assert.deepEqual(result._wasIterated, false, 'Passed!');
});
test('OrderedEnumerable with multiple restrictions count', function (assert) {
  let result = Enumerable.from([3, 2, 1, 4, 6, 5, 9, 8, 7, 0]).orderBy();
  assert.deepEqual(result._wasIterated, false, 'Passed!');
  assert.deepEqual(result.count(), 10, 'Passed!');
  assert.deepEqual(result._wasIterated, false, 'Passed!');
  result = result.skip(2).take(7).skipLast(3).takeLast(2);
  assert.deepEqual(result._wasIterated, false, 'Passed!');
  assert.deepEqual(result.count(), 2, 'Passed!');
  assert.deepEqual(result._wasIterated, false, 'Passed!');
});

// seek tests

test('Enumerable.empty seek', function (assert) {
  const result = Enumerable.empty();
  assert.deepEqual(result.count(), 0, 'Passed!');
  assert.deepEqual(result.elementAtOrDefault(10000), undefined, 'Passed!');
  assert.deepEqual(result._wasIterated, false, 'Passed!');
});
test('Enumerable.range seek', function (assert) {
  const result = Enumerable.range(0, 100000);
  assert.deepEqual(result.count(), 100000, 'Passed!');
  assert.deepEqual(result.elementAtOrDefault(10000), 10000, 'Passed!');
  assert.deepEqual(result._wasIterated, false, 'Passed!');
});
test('Enumerable.repeat seek', function (assert) {
  const result = Enumerable.repeat(123, 100000);
  assert.deepEqual(result.count(), 100000, 'Passed!');
  assert.deepEqual(result.elementAtOrDefault(10000), 123, 'Passed!');
  assert.deepEqual(result._wasIterated, false, 'Passed!');
});
test('append seek', function (assert) {
  const result = Enumerable.range(0, 100000).append(666666);
  assert.deepEqual(result.count(), 100001, 'Passed!');
  assert.deepEqual(result.elementAtOrDefault(100000), 666666, 'Passed!');
  assert.deepEqual(result.first(), 0, 'Passed!');
  assert.deepEqual(result._wasIterated, false, 'Passed!');
});
test('concat array seek', function (assert) {
  const result = Enumerable.range(0, 100000).concat([0, 1, 2, 3, 4, 5]);
  assert.deepEqual(result.count(), 100006, 'Passed!');
  assert.deepEqual(result.elementAtOrDefault(100004), 4, 'Passed!');
  assert.deepEqual(result._wasIterated, false, 'Passed!');
});
test('concat Enumerable seek', function (assert) {
  const result = Enumerable.range(0, 100000).concat(Enumerable.range(0, 6));
  assert.deepEqual(result.count(), 100006, 'Passed!');
  assert.deepEqual(result.elementAtOrDefault(100004), 4, 'Passed!');
  assert.deepEqual(result._wasIterated, false, 'Passed!');
});
test('prepend seek', function (assert) {
  const result = Enumerable.range(0, 100000).prepend(666666);
  assert.deepEqual(result.count(), 100001, 'Passed!');
  assert.deepEqual(result.elementAtOrDefault(100000), 99999, 'Passed!');
  assert.deepEqual(result.first(), 666666, 'Passed!');
  assert.deepEqual(result._wasIterated, false, 'Passed!');
});
test('reverse seek', function (assert) {
  const result = Enumerable.range(0, 100000).reverse();
  assert.deepEqual(result.count(), 100000, 'Passed!');
  assert.deepEqual(result.elementAtOrDefault(10000), 89999, 'Passed!');
  assert.deepEqual(result._wasIterated, false, 'Passed!');
});
test('select seek', function (assert) {
  const result = Enumerable.range(0, 100000).select((i) => 'a' + i);
  assert.deepEqual(result.count(), 100000, 'Passed!');
  assert.deepEqual(result.elementAtOrDefault(10000), 'a10000', 'Passed!');
  assert.deepEqual(result.elementAtOrDefault(1000000), undefined, 'Passed!');
  assert.deepEqual(result._wasIterated, false, 'Passed!');
});
test('skip seek', function (assert) {
  const result = Enumerable.range(0, 100000).skip(50000);
  assert.deepEqual(result.count(), 50000, 'Passed!');
  assert.deepEqual(result.elementAtOrDefault(10000), 60000, 'Passed!');
  assert.deepEqual(result.elementAtOrDefault(1000000), undefined, 'Passed!');
  assert.deepEqual(result._wasIterated, false, 'Passed!');
});
test('skipLast seek', function (assert) {
  const result = Enumerable.range(0, 100000).skipLast(50000);
  assert.deepEqual(result.count(), 50000, 'Passed!');
  assert.deepEqual(result.elementAtOrDefault(10000), 10000, 'Passed!');
  assert.deepEqual(result.elementAtOrDefault(50000), undefined, 'Passed!');
  assert.deepEqual(result.elementAtOrDefault(1000000), undefined, 'Passed!');
  assert.deepEqual(result._wasIterated, false, 'Passed!');
});
test('take seek', function (assert) {
  const result = Enumerable.range(0, 100000).take(50000);
  assert.deepEqual(result.count(), 50000, 'Passed!');
  assert.deepEqual(result.elementAtOrDefault(10000), 10000, 'Passed!');
  assert.deepEqual(result.elementAtOrDefault(50000), undefined, 'Passed!');
  assert.deepEqual(result.elementAtOrDefault(1000000), undefined, 'Passed!');
  assert.deepEqual(result._wasIterated, false, 'Passed!');
});
test('skip takeLast', function (assert) {
  const result = Enumerable.range(0, 100000).takeLast(50000);
  assert.deepEqual(result.count(), 50000, 'Passed!');
  assert.deepEqual(result.elementAtOrDefault(10000), 60000, 'Passed!');
  assert.deepEqual(result.elementAtOrDefault(1000000), undefined, 'Passed!');
  assert.deepEqual(result._wasIterated, false, 'Passed!');
});

// Extra features

test('Enumerable.shuffle', function (assert) {
  const result = Enumerable.range(1, 10).shuffle();
  assert.deepEqual(result._wasIterated, false, 'Passed!');
  let arr = result.toArray();
  assert.deepEqual(result._wasIterated, true, 'Passed!');
  assert.notDeepEqual(arr, Enumerable.range(1, 10).toArray(), 'Passed!');
  arr = result.toArray().sort((i1, i2) => i1 - i2);
  assert.deepEqual(arr, Enumerable.range(1, 10).toArray(), 'Passed!');
});
test('shuffle count', function (assert) {
  const result = Enumerable.range(100, 10000).shuffle();
  assert.deepEqual(result.count(), 10000, 'Passed!');
  assert.deepEqual(result._wasIterated, false, 'Passed!');
});

test('Enumerable.randomSample canSeek', function (assert) {
  const result = Enumerable.range(1, 100000).randomSample(100);
  const average = result.average();
  const avg = average === undefined ? undefined : Math.round(average);
  assert.deepEqual(
    result.count(),
    100,
    'Sample average is ' + avg + ' and it should be close to 50000'
  );
});
test('Enumerable.randomSample no canSeek', function (assert) {
  const result = Enumerable.from(function* () {
    for (let i = 0; i < 100000; i++) yield i;
  }).randomSample(100);
  const average = result.average();
  const avg = average === undefined ? undefined : Math.round(average);
  assert.deepEqual(
    result.count(),
    100,
    'Sample average is ' + avg + ' and it should be close to 50000'
  );
});
test('Enumerable.randomSample no canSeek limit', function (assert) {
  const result = Enumerable.from(function* () {
    let i = 0;
    while (true) {
      yield i;
      if (i > 100000) {
        throw Error('It should never go above the limit of 100000');
      }
      i++;
    }
  }).randomSample(100, 100000);
  const average = result.average();
  const avg = average === undefined ? undefined : Math.round(average);
  assert.deepEqual(
    result.count(),
    100,
    'Sample average is ' + avg + ' and it should be close to 50000'
  );
});

test('Enumerable.binarySearch', function (assert) {
  const result = Enumerable.range(1, 10)
    .select((i) => i * 10)
    .orderBy();
  assert.deepEqual(result._wasIterated, false, 'Passed!');
  let index = result.binarySearch(80);
  assert.deepEqual(result._wasIterated, false, 'Passed!');
  assert.deepEqual(index, 7, 'Passed!');
  index = result.binarySearch(45);
  assert.deepEqual(index, false, 'Passed!');
});

test('Enumerable.distinctByHash', function (assert) {
  const result = Enumerable.from([1, 2, 2, 3, '3'])
    .distinctByHash((i) => +i)
    .toArray();
  assert.deepEqual(result, [1, 2, 3], 'Passed!');
});
test('Enumerable.exceptByHash', function (assert) {
  const result = Enumerable.from([1, 2, 2, 3, '3'])
    .exceptByHash([2, 3], (i) => +i)
    .toArray();
  assert.deepEqual(result, [1], 'Passed!');
});
test('Enumerable.intersectByHash', function (assert) {
  const result = Enumerable.from([1, 2, 2, 3, '3'])
    .intersectByHash([2, 3], (i) => +i)
    .toArray();
  assert.deepEqual(result, [2, 2, 3, '3'], 'Passed!');
});

test('Enumerable.lag canSeek', function (assert) {
  const result = Enumerable.from([1, 2, 3, 4, 5, 6])
    .lag(1, (i1, i2) => i1 + '' + i2)
    .toArray();
  assert.deepEqual(
    result,
    ['1undefined', '21', '32', '43', '54', '65'],
    'Passed!'
  );
});
test('Enumerable.lead canSeek', function (assert) {
  const result = Enumerable.from([1, 2, 3, 4, 5, 6])
    .lead(1, (i1, i2) => i1 + '' + i2)
    .toArray();
  assert.deepEqual(
    result,
    ['12', '23', '34', '45', '56', '6undefined'],
    'Passed!'
  );
});
test('Enumerable.lag no canSeek', function (assert) {
  const result = Enumerable.from(function* () {
    for (const item of [1, 2, 3, 4, 5, 6]) yield item;
  })
    .lag(1, (i1, i2) => i1 + '' + i2)
    .toArray();
  assert.deepEqual(
    result,
    ['1undefined', '21', '32', '43', '54', '65'],
    'Passed!'
  );
});
test('Enumerable.lead no canSeek', function (assert) {
  const result = Enumerable.from(function* () {
    for (const item of [1, 2, 3, 4, 5, 6]) yield item;
  })
    .lead(1, (i1, i2) => i1 + '' + i2)
    .toArray();
  assert.deepEqual(
    result,
    ['12', '23', '34', '45', '56', '6undefined'],
    'Passed!'
  );
});
test('Enumerable.lag no canSeek 2', function (assert) {
  const result = Enumerable.from(function* () {
    for (const item of [1, 2, 3, 4, 5, 6]) yield item;
  })
    .lag(2, (i1, i2) => i1 + '' + i2)
    .toArray();
  assert.deepEqual(
    result,
    ['1undefined', '2undefined', '31', '42', '53', '64'],
    'Passed!'
  );
});
test('Enumerable.lead no canSeek 2', function (assert) {
  const result = Enumerable.from(function* () {
    for (const item of [1, 2, 3, 4, 5, 6]) yield item;
  })
    .lead(2, (i1, i2) => i1 + '' + i2)
    .toArray();
  assert.deepEqual(
    result,
    ['13', '24', '35', '46', '5undefined', '6undefined'],
    'Passed!'
  );
});
test('Enumerable.lag canSeek count', function (assert) {
  const result = Enumerable.from([1, 2, 3, 4, 5, 6]).lag(
    1,
    (i1, i2) => i1 + '' + i2
  );
  assert.deepEqual(result.count(), 6, 'Passed!');
  assert.deepEqual(result._wasIterated, false, 'Passed!');
});
test('Enumerable.lead canSeek count', function (assert) {
  const result = Enumerable.from([1, 2, 3, 4, 5, 6]).lead(
    1,
    (i1, i2) => i1 + '' + i2
  );
  assert.deepEqual(result.count(), 6, 'Passed!');
  assert.deepEqual(result._wasIterated, false, 'Passed!');
});
test('Enumerable.lag no canSeek count', function (assert) {
  const result = Enumerable.from(function* () {
    for (const item of [1, 2, 3, 4, 5, 6]) yield item;
  }).lag(1, (i1, i2) => i1 + '' + i2);
  assert.deepEqual(result.count(), 6, 'Passed!');
  assert.deepEqual(result._wasIterated, true, 'Passed!');
});
test('Enumerable.lag canSeek elementAt', function (assert) {
  const result = Enumerable.from([1, 2, 3, 4, 5, 6]).lag(
    1,
    (i1, i2) => i1 + '' + i2
  );
  assert.deepEqual(result.elementAt(1), '21', 'Passed!');
  assert.deepEqual(result._wasIterated, false, 'Passed!');
});
test('Enumerable.lag no canSeek elementAt', function (assert) {
  const result = Enumerable.from(function* () {
    for (const item of [1, 2, 3, 4, 5, 6]) yield item;
  }).lag(1, (i1, i2) => i1 + '' + i2);
  assert.deepEqual(result.elementAt(1), '21', 'Passed!');
  assert.deepEqual(result._wasIterated, true, 'Passed!');
});

test('Enumerable.padEnd canSeek value', function (assert) {
  const result = Enumerable.from([1, 2, 3]).padEnd(5, 16).toArray();
  assert.deepEqual(result, [1, 2, 3, 16, 16], 'Passed!');
});
test('Enumerable.padEnd canSeek func', function (assert) {
  const result = Enumerable.from([1, 2, 3])
    .padEnd(5, (i) => i + 11)
    .toArray();
  assert.deepEqual(result, [1, 2, 3, 14, 15], 'Passed!');
});
test('Enumerable.padEnd canSeek func count', function (assert) {
  const result = Enumerable.from([1, 2, 3]).padEnd(5, (i) => i + 11);
  assert.deepEqual(result.count(), 5, 'Passed!');
  assert.deepEqual(result._wasIterated, false, 'Passed!');
});
test('Enumerable.padEnd canSeek func elementAt', function (assert) {
  const result = Enumerable.from([1, 2, 3]).padEnd(5, (i) => i + 11);
  assert.deepEqual(result.elementAt(4), 15, 'Passed!');
  assert.deepEqual(result._wasIterated, false, 'Passed!');
});
test('Enumerable.padEnd no canSeek func elementAt', function (assert) {
  const result = Enumerable.from(function* () {
    for (const item of [1, 2, 3]) yield item;
  }).padEnd(5, (i) => i + 11);
  assert.deepEqual(result.elementAt(4), 15, 'Passed!');
  assert.deepEqual(result._wasIterated, true, 'Passed!');
});

test('Enumerable.padStart canSeek value', function (assert) {
  const result = Enumerable.from([1, 2, 3]).padStart(5, 16).toArray();
  assert.deepEqual(result, [16, 16, 1, 2, 3], 'Passed!');
});
test('Enumerable.padStart canSeek func', function (assert) {
  const result = Enumerable.from([1, 2, 3])
    .padStart(5, (i) => i + 11)
    .toArray();
  assert.deepEqual(result, [11, 12, 1, 2, 3], 'Passed!');
});
test('Enumerable.padStart canSeek func count', function (assert) {
  const result = Enumerable.from([1, 2, 3]).padStart(5, (i) => i + 11);
  assert.deepEqual(result.count(), 5, 'Passed!');
  assert.deepEqual(result._wasIterated, false, 'Passed!');
});
test('Enumerable.padStart canSeek func elementAt', function (assert) {
  const result = Enumerable.from([1, 2, 3]).padStart(5, (i) => i + 11);
  assert.deepEqual(result.elementAt(4), 3, 'Passed!');
  assert.deepEqual(result.elementAt(1), 12, 'Passed!');
  assert.deepEqual(result._wasIterated, false, 'Passed!');
});
test('Enumerable.padStart no canSeek func elementAt', function (assert) {
  const result = Enumerable.from(function* () {
    for (const item of [1, 2, 3]) yield item;
  }).padStart(5, (i) => i + 11);
  assert.deepEqual(result.elementAt(4), 3, 'Passed!');
  assert.deepEqual(result.elementAt(1), 12, 'Passed!');
  assert.deepEqual(result._wasIterated, true, 'Passed!');
});

test('GitHub issue #22', function (assert) {
  const result = Enumerable.from([{ a: [1, 2] }, { a: [2, 3, 4] }])
    .selectMany((x) => x.a)
    .toArray();
  assert.deepEqual(result, [1, 2, 2, 3, 4], 'Passed!');
});

/** @internal */
function _sign(n: number): 1 | 0 | -1 {
  if (n > 0) return 1;
  if (n < 0) return -1;
  return 0;
}
