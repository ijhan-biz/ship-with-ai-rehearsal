import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FeedbackError, STORAGE_KEY, MAX_NAME_LENGTH, MAX_MESSAGE_LENGTH, MAX_SUBMISSIONS,
  validateInput, parseSubmissions, loadSubmissions, saveSubmission,
} from '../src/lib/feedback.js';

const record = { name: 'Ada', message: '**Hello**', submittedAt: '2026-09-26T10:00:00.000Z' };

function memoryStorage(initial = null) {
  let raw = initial;
  let writes = 0;
  return {
    getItem(key) {
      assert.equal(key, STORAGE_KEY);
      return raw;
    },
    setItem(key, value) {
      assert.equal(key, STORAGE_KEY);
      raw = value;
      writes += 1;
    },
    get raw() { return raw; },
    get writes() { return writes; },
  };
}

function hasCode(code, cause) {
  return (error) => {
    assert.ok(error instanceof FeedbackError);
    assert.equal(error.code, code);
    if (cause !== undefined) assert.equal(error.cause, cause);
    return true;
  };
}

test('trims valid input, preserves Markdown, and allows an anonymous blank name', () => {
  assert.deepEqual(validateInput(' Ada ', ' \n**Hello**\n '), { name: 'Ada', message: '**Hello**' });
  assert.deepEqual(validateInput(' \t ', ' Hello '), { name: '', message: 'Hello' });
});

test('rejects empty and whitespace-only messages', () => {
  for (const message of ['', ' ', '\n\t']) {
    assert.throws(() => validateInput('Ada', message), hasCode('EMPTY_MESSAGE'));
  }
});

test('rejects non-string names and messages without coercing them', () => {
  for (const value of [undefined, null, 42, true, {}, [], { toString: () => 'text' }]) {
    assert.throws(() => validateInput(value, 'Hello'), hasCode('INVALID_TYPE'));
    assert.throws(() => validateInput('Ada', value), hasCode('INVALID_TYPE'));
  }
});

test('enforces length caps after trimming', () => {
  const name = 'n'.repeat(MAX_NAME_LENGTH);
  const message = 'm'.repeat(MAX_MESSAGE_LENGTH);
  assert.deepEqual(validateInput(` ${name} `, ` ${message} `), { name, message });
  assert.throws(() => validateInput(`${name}n`, message), hasCode('NAME_TOO_LONG'));
  assert.throws(() => validateInput(name, `${message}m`), hasCode('MESSAGE_TOO_LONG'));
});

test('loads missing storage and valid legacy records, then saves and reloads', () => {
  const storage = memoryStorage();
  assert.deepEqual(loadSubmissions(storage), []);
  assert.deepEqual(parseSubmissions('[]'), []);
  assert.deepEqual(parseSubmissions(JSON.stringify([record])), [record]);
  const saved = saveSubmission(' Ada ', ' **Hello** ', storage);
  assert.equal(saved[0].name, 'Ada');
  assert.equal(saved[0].message, '**Hello**');
  assert.equal(new Date(saved[0].submittedAt).toISOString(), saved[0].submittedAt);
  const withAnonymous = saveSubmission(' ', 'Second', storage);
  assert.equal(withAnonymous[1].name, '');
  assert.deepEqual(loadSubmissions(storage), withAnonymous);
  assert.equal(storage.writes, 2);
});

const corruptValues = [
  ['empty storage string', ''],
  ['malformed JSON', '{'],
  ['old string', '"hello"'],
  ['null', 'null'],
  ['object instead of array', '{}'],
  ['number instead of array', '42'],
  ['null record', '[null]'],
  ['string record', '["hello"]'],
  ['array record', '[[]]'],
  ['missing properties', '[{}]'],
  ['missing name', JSON.stringify([{ message: 'Hello', submittedAt: record.submittedAt }])],
  ['extra properties', JSON.stringify([{ ...record, unexpected: true }])],
  ['wrong name type', JSON.stringify([{ ...record, name: null }])],
  ['wrong message type', JSON.stringify([{ ...record, message: {} }])],
  ['empty old message', JSON.stringify([{ ...record, message: ' \n' }])],
  ['overlong old name', JSON.stringify([{ ...record, name: 'n'.repeat(MAX_NAME_LENGTH + 1) }])],
  ['overlong old message', JSON.stringify([{ ...record, message: 'm'.repeat(MAX_MESSAGE_LENGTH + 1) }])],
  ['too many old records', JSON.stringify(Array(MAX_SUBMISSIONS + 1).fill(record))],
  ['mixed valid and invalid records', JSON.stringify([record, null])],
  ['non-string raw value', undefined],
];

for (const [label, raw] of corruptValues) {
  test(`reports ${label} and never overwrites corrupt history`, () => {
    const storage = memoryStorage(raw);
    // Pass undefined directly to the parser (getItem itself only returns a string or null).
    if (raw === undefined) {
      assert.throws(() => parseSubmissions(raw), hasCode('CORRUPT_STORAGE'));
      return;
    }
    assert.throws(() => loadSubmissions(storage), hasCode('CORRUPT_STORAGE'));
    assert.throws(() => saveSubmission('Ada', 'New message', storage), hasCode('CORRUPT_STORAGE'));
    assert.equal(storage.raw, raw);
    assert.equal(storage.writes, 0);
  });
}

test('rejects invalid, noncanonical, and normalized-overflow timestamps', () => {
  for (const submittedAt of [
    undefined, null, 123, '', 'yesterday', '2026-09-26', '2026-09-26T10:00:00Z',
    '2026-09-26T10:00:00.000+00:00', '2026-02-30T10:00:00.000Z',
    '2026-13-26T10:00:00.000Z', '2026-09-26T24:00:00.000Z',
  ]) {
    const raw = JSON.stringify([{ ...record, submittedAt }]);
    const storage = memoryStorage(raw);
    assert.throws(() => saveSubmission('Ada', 'New', storage), hasCode('CORRUPT_STORAGE'));
    assert.equal(storage.raw, raw);
    assert.equal(storage.writes, 0);
  }
});

test('invalid new input never reads or writes storage and preserves caller input/history', () => {
  const draft = { name: ' Ada ', message: ' \n ' };
  const before = { ...draft };
  const storage = {
    getItem() { assert.fail('must validate before reading'); },
    setItem() { assert.fail('must not write invalid input'); },
  };
  assert.throws(() => saveSubmission(draft.name, draft.message, storage), hasCode('EMPTY_MESSAGE'));
  assert.deepEqual(draft, before);
});

test('storage read failures preserve their cause and never attempt a write', () => {
  const cause = new DOMException('Reading blocked', 'SecurityError');
  const storage = {
    getItem() { throw cause; },
    setItem() { assert.fail('must not write after a failed read'); },
  };
  assert.throws(() => loadSubmissions(storage), hasCode('STORAGE_READ', cause));
  assert.throws(() => saveSubmission('Ada', 'Hello', storage), hasCode('STORAGE_READ', cause));
});

test('unavailable storage and a blocked localStorage getter produce explicit errors', () => {
  for (const storage of [null, {}, { getItem() {} }]) {
    assert.throws(() => loadSubmissions(storage), hasCode('STORAGE_UNAVAILABLE'));
    assert.throws(() => saveSubmission('', 'Hello', storage), hasCode('STORAGE_UNAVAILABLE'));
  }
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const cause = new DOMException('Access blocked', 'SecurityError');
  try {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() { throw cause; },
    });
    assert.throws(() => loadSubmissions(), hasCode('STORAGE_UNAVAILABLE', cause));
    assert.throws(() => saveSubmission('', 'Hello'), hasCode('STORAGE_UNAVAILABLE', cause));
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: undefined });
    assert.throws(() => loadSubmissions(), hasCode('STORAGE_UNAVAILABLE'));
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
    else delete globalThis.localStorage;
  }
});

for (const [name, code] of [
  ['QuotaExceededError', 'STORAGE_QUOTA'],
  ['SecurityError', 'STORAGE_WRITE'],
  ['Error', 'STORAGE_WRITE'],
]) {
  test(`${name} on write preserves stored history and the caller's draft`, () => {
    const raw = JSON.stringify(Array(MAX_SUBMISSIONS).fill(record));
    const storage = memoryStorage(raw);
    const cause = name === 'Error' ? new Error('Write failed') : new DOMException('Write failed', name);
    storage.setItem = () => { throw cause; };
    const draft = { name: ' Ada ', message: ' **Keep this draft** ' };
    const before = { ...draft };
    assert.throws(() => saveSubmission(draft.name, draft.message, storage), hasCode(code, cause));
    assert.equal(storage.raw, raw);
    assert.equal(storage.writes, 0);
    assert.deepEqual(draft, before);
  });
}

test('keeps only the newest bounded history after a successful write', () => {
  const previous = Array.from({ length: MAX_SUBMISSIONS }, (_, index) => ({
    ...record, message: `Message ${index}`,
  }));
  const storage = memoryStorage(JSON.stringify(previous));
  const saved = saveSubmission('', 'Newest', storage);
  assert.equal(saved.length, MAX_SUBMISSIONS);
  assert.equal(saved[0].message, 'Message 1');
  assert.equal(saved.at(-1).message, 'Newest');
  assert.equal(previous[0].message, 'Message 0');
  assert.deepEqual(loadSubmissions(storage), saved);
});

test('storage treats markup as data; rendering must separately sanitize it', () => {
  const storage = memoryStorage();
  const name = '<b>Not HTML</b>';
  const message = '**Markdown** <script>not executable in storage</script>';
  saveSubmission(name, message, storage);
  assert.equal(loadSubmissions(storage)[0].name, name);
  assert.equal(loadSubmissions(storage)[0].message, message);
});
