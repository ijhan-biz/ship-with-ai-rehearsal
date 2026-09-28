import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FeedbackError, STORAGE_KEY, MAX_NAME_LENGTH, MAX_MESSAGE_LENGTH, MAX_SUBMISSIONS,
  validateInput, parseSubmissions, loadSubmissions, saveSubmission,
} from '../src/lib/feedback.js';

const record = { name: 'Ada', message: '**Hello**', submittedAt: '2026-09-26T10:00:00.000Z' };

const errorMessages = {
  INVALID_TYPE: '이름과 메시지는 텍스트여야 합니다.',
  EMPTY_MESSAGE: '메시지를 입력한 뒤 제출해 주세요.',
  NAME_TOO_LONG: '이름은 100자 이내로 입력해 주세요.',
  MESSAGE_TOO_LONG: '메시지는 5000자 이내로 입력해 주세요.',
  CORRUPT_STORAGE: '저장된 피드백이 올바르지 않습니다. 아무것도 변경하지 않았습니다. 브라우저 저장소의 "ship-with-ai-feedback" 항목을 백업한 뒤, 해당 항목만 삭제하고 새로고침하여 다시 시작하세요.',
  STORAGE_UNAVAILABLE: '브라우저 저장소를 사용할 수 없습니다. 로컬 저장소가 활성화된 브라우저를 사용하세요. 입력한 내용은 지워지지 않았습니다.',
  STORAGE_READ: '저장된 피드백을 읽을 수 없습니다. 브라우저 저장소 권한을 확인한 뒤 다시 시도하세요. 아무것도 변경하지 않았습니다.',
  STORAGE_QUOTA: '브라우저 저장소가 가득 찼습니다. 공간을 확보한 뒤 다시 시도하세요. 메시지는 저장되지 않았으며, 입력한 내용은 지워지지 않았습니다.',
  STORAGE_WRITE: '피드백을 저장할 수 없습니다. 브라우저 저장소 권한을 확인한 뒤 다시 시도하세요. 입력한 내용은 지워지지 않았습니다.',
};
const blockedStorageMessage = '브라우저 저장소를 사용할 수 없습니다. 로컬 저장소 접근을 허용한 뒤 다시 시도하세요. 입력한 내용은 지워지지 않았습니다.';

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
    assert.equal(error.message, code === 'STORAGE_UNAVAILABLE' && cause !== undefined
      ? blockedStorageMessage : errorMessages[code]);
    if (cause !== undefined) assert.equal(error.cause, cause);
    return true;
  };
}

test('입력값의 앞뒤 공백을 제거하고 Markdown과 빈 익명 이름을 허용합니다', () => {
  assert.deepEqual(validateInput(' Ada ', ' \n**Hello**\n '), { name: 'Ada', message: '**Hello**' });
  assert.deepEqual(validateInput(' \t ', ' Hello '), { name: '', message: 'Hello' });
});

test('빈 메시지와 공백뿐인 메시지를 거부합니다', () => {
  for (const message of ['', ' ', '\n\t']) {
    assert.throws(() => validateInput('Ada', message), hasCode('EMPTY_MESSAGE'));
  }
});

test('문자열이 아닌 이름과 메시지를 강제 변환하지 않고 거부합니다', () => {
  for (const value of [undefined, null, 42, true, {}, [], { toString: () => 'text' }]) {
    assert.throws(() => validateInput(value, 'Hello'), hasCode('INVALID_TYPE'));
    assert.throws(() => validateInput('Ada', value), hasCode('INVALID_TYPE'));
  }
});

test('앞뒤 공백을 제거한 뒤 길이 제한을 적용합니다', () => {
  const name = 'n'.repeat(MAX_NAME_LENGTH);
  const message = 'm'.repeat(MAX_MESSAGE_LENGTH);
  assert.deepEqual(validateInput(` ${name} `, ` ${message} `), { name, message });
  assert.throws(() => validateInput(`${name}n`, message), hasCode('NAME_TOO_LONG'));
  assert.throws(() => validateInput(name, `${message}m`), hasCode('MESSAGE_TOO_LONG'));
});

test('빈 저장소와 유효한 기존 기록을 읽고 저장한 뒤 다시 불러옵니다', () => {
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
  ['빈 저장 문자열', ''],
  ['잘못된 JSON', '{'],
  ['기존 문자열', '"hello"'],
  ['null', 'null'],
  ['배열 대신 객체', '{}'],
  ['배열 대신 숫자', '42'],
  ['null 기록', '[null]'],
  ['문자열 기록', '["hello"]'],
  ['배열 기록', '[[]]'],
  ['필수 속성 누락', '[{}]'],
  ['이름 누락', JSON.stringify([{ message: 'Hello', submittedAt: record.submittedAt }])],
  ['추가 속성', JSON.stringify([{ ...record, unexpected: true }])],
  ['잘못된 이름 자료형', JSON.stringify([{ ...record, name: null }])],
  ['잘못된 메시지 자료형', JSON.stringify([{ ...record, message: {} }])],
  ['기존의 빈 메시지', JSON.stringify([{ ...record, message: ' \n' }])],
  ['길이를 초과한 기존 이름', JSON.stringify([{ ...record, name: 'n'.repeat(MAX_NAME_LENGTH + 1) }])],
  ['길이를 초과한 기존 메시지', JSON.stringify([{ ...record, message: 'm'.repeat(MAX_MESSAGE_LENGTH + 1) }])],
  ['개수를 초과한 기존 기록', JSON.stringify(Array(MAX_SUBMISSIONS + 1).fill(record))],
  ['유효한 기록과 잘못된 기록의 혼합', JSON.stringify([record, null])],
  ['문자열이 아닌 원시 값', undefined],
];

for (const [label, raw] of corruptValues) {
  test(`${label} 오류를 알리고 손상된 기록을 덮어쓰지 않습니다`, () => {
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

test('잘못된 날짜, 비표준 시간 형식, 범위를 벗어나 자동 보정된 시간을 거부합니다', () => {
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

test('잘못된 새 입력값은 저장소에 접근하지 않으며 입력값과 기록을 보존합니다', () => {
  const draft = { name: ' Ada ', message: ' \n ' };
  const before = { ...draft };
  const storage = {
    getItem() { assert.fail('읽기 전에 입력값을 검증해야 합니다'); },
    setItem() { assert.fail('잘못된 입력값을 저장하면 안 됩니다'); },
  };
  assert.throws(() => saveSubmission(draft.name, draft.message, storage), hasCode('EMPTY_MESSAGE'));
  assert.deepEqual(draft, before);
});

test('저장소 읽기 실패의 원인을 보존하고 쓰기를 시도하지 않습니다', () => {
  const cause = new DOMException('읽기가 차단되었습니다', 'SecurityError');
  const storage = {
    getItem() { throw cause; },
    setItem() { assert.fail('읽기 실패 후 쓰기를 시도하면 안 됩니다'); },
  };
  assert.throws(() => loadSubmissions(storage), hasCode('STORAGE_READ', cause));
  assert.throws(() => saveSubmission('Ada', 'Hello', storage), hasCode('STORAGE_READ', cause));
});

test('사용 불가능한 저장소와 차단된 localStorage 접근은 명확한 오류를 반환합니다', () => {
  for (const storage of [null, {}, { getItem() {} }]) {
    assert.throws(() => loadSubmissions(storage), hasCode('STORAGE_UNAVAILABLE'));
    assert.throws(() => saveSubmission('', 'Hello', storage), hasCode('STORAGE_UNAVAILABLE'));
  }
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const cause = new DOMException('접근이 차단되었습니다', 'SecurityError');
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
  test(`쓰기 중 ${name} 발생 시 저장된 기록과 입력 중인 내용을 보존합니다`, () => {
    const raw = JSON.stringify(Array(MAX_SUBMISSIONS).fill(record));
    const storage = memoryStorage(raw);
    const cause = name === 'Error' ? new Error('쓰기 실패') : new DOMException('쓰기 실패', name);
    storage.setItem = () => { throw cause; };
    const draft = { name: ' Ada ', message: ' **Keep this draft** ' };
    const before = { ...draft };
    assert.throws(() => saveSubmission(draft.name, draft.message, storage), hasCode(code, cause));
    assert.equal(storage.raw, raw);
    assert.equal(storage.writes, 0);
    assert.deepEqual(draft, before);
  });
}

test('저장에 성공하면 한도 내에서 최근 기록만 보관합니다', () => {
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

test('저장소는 마크업을 데이터로 취급하며 렌더링 시 별도로 정화해야 합니다', () => {
  const storage = memoryStorage();
  const name = '<b>Not HTML</b>';
  const message = '**Markdown** <script>not executable in storage</script>';
  saveSubmission(name, message, storage);
  assert.equal(loadSubmissions(storage)[0].name, name);
  assert.equal(loadSubmissions(storage)[0].message, message);
});

const localizedErrorCases = [
  ['INVALID_TYPE', () => validateInput(null, '안녕하세요')],
  ['EMPTY_MESSAGE', () => validateInput('홍길동', ' \n ')],
  ['NAME_TOO_LONG', () => validateInput('가'.repeat(101), '안녕하세요')],
  ['MESSAGE_TOO_LONG', () => validateInput('홍길동', '가'.repeat(5001))],
  ['CORRUPT_STORAGE', () => loadSubmissions(memoryStorage('{'))],
  ['STORAGE_UNAVAILABLE', () => loadSubmissions(null)],
  ['STORAGE_READ', () => loadSubmissions({
    getItem() { throw new Error('읽기 실패'); },
    setItem() { assert.fail('읽기 실패 후 쓰기를 시도하면 안 됩니다'); },
  })],
  ...['STORAGE_QUOTA', 'STORAGE_WRITE'].map((code) => [code, () => {
    const storage = memoryStorage();
    const cause = new Error('쓰기 실패');
    if (code === 'STORAGE_QUOTA') cause.name = 'QuotaExceededError';
    storage.setItem = () => { throw cause; };
    saveSubmission('홍길동', '**안녕하세요**', storage);
  }]),
];

for (const [code, run] of localizedErrorCases) {
  test(`${code} 경로에서 정확한 한국어 안내와 기존 오류 코드를 반환합니다`, () => {
    assert.throws(run, hasCode(code));
  });
}

test('차단된 localStorage 접근은 입력 보존과 권한 허용을 한국어로 안내합니다', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const cause = new Error('접근이 차단되었습니다');
  try {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() { throw cause; },
    });
    assert.throws(() => saveSubmission('홍길동', '입력한 내용'), hasCode('STORAGE_UNAVAILABLE', cause));
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
    else delete globalThis.localStorage;
  }
});
