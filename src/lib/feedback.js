export const STORAGE_KEY = 'ship-with-ai-feedback';
export const MAX_NAME_LENGTH = 100;
export const MAX_MESSAGE_LENGTH = 5000;
export const MAX_SUBMISSIONS = 100;

export class FeedbackError extends Error {
  constructor(code, message, options) {
    super(message, options);
    this.name = 'FeedbackError';
    this.code = code;
  }
}

export function validateInput(name, message) {
  if (typeof name !== 'string' || typeof message !== 'string') {
    throw new FeedbackError('INVALID_TYPE', '이름과 메시지는 텍스트여야 합니다.');
  }
  const input = { name: name.trim(), message: message.trim() };
  if (!input.message) {
    throw new FeedbackError('EMPTY_MESSAGE', '메시지를 입력한 뒤 제출해 주세요.');
  }
  if (input.name.length > MAX_NAME_LENGTH) {
    throw new FeedbackError('NAME_TOO_LONG', `이름은 ${MAX_NAME_LENGTH}자 이내로 입력해 주세요.`);
  }
  if (input.message.length > MAX_MESSAGE_LENGTH) {
    throw new FeedbackError('MESSAGE_TOO_LONG', `메시지는 ${MAX_MESSAGE_LENGTH}자 이내로 입력해 주세요.`);
  }
  return input;
}

function corruptStorage(cause) {
  return new FeedbackError(
    'CORRUPT_STORAGE',
    '저장된 피드백이 올바르지 않습니다. 아무것도 변경하지 않았습니다. 브라우저 저장소의 ' +
      `"${STORAGE_KEY}" 항목을 백업한 뒤, 해당 항목만 삭제하고 새로고침하여 다시 시작하세요.`,
    { cause },
  );
}

export function parseSubmissions(raw) {
  if (raw === null) return [];
  if (typeof raw !== 'string') throw corruptStorage();
  let records;
  try {
    records = JSON.parse(raw);
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    throw corruptStorage(error);
  }
  if (!Array.isArray(records) || records.length > MAX_SUBMISSIONS) throw corruptStorage();
  return records.map((record) => {
    if (
      !record || typeof record !== 'object' || Array.isArray(record) ||
      Object.keys(record).length !== 3 ||
      !Object.hasOwn(record, 'name') || !Object.hasOwn(record, 'message') ||
      typeof record.submittedAt !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(record.submittedAt)
    ) {
      throw corruptStorage();
    }
    const date = new Date(record.submittedAt);
    if (!Number.isFinite(date.getTime()) || date.toISOString() !== record.submittedAt) {
      throw corruptStorage();
    }
    let input;
    try {
      input = validateInput(record.name, record.message);
    } catch (error) {
      if (!(error instanceof FeedbackError)) throw error;
      throw corruptStorage(error);
    }
    return { ...input, submittedAt: record.submittedAt };
  });
}

function getStorage(storage) {
  if (storage === undefined) {
    try {
      storage = globalThis.localStorage;
    } catch (error) {
      throw new FeedbackError(
        'STORAGE_UNAVAILABLE',
        '브라우저 저장소를 사용할 수 없습니다. 로컬 저장소 접근을 허용한 뒤 다시 시도하세요. 입력한 내용은 지워지지 않았습니다.',
        { cause: error },
      );
    }
  }
  if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function') {
    throw new FeedbackError(
      'STORAGE_UNAVAILABLE',
      '브라우저 저장소를 사용할 수 없습니다. 로컬 저장소가 활성화된 브라우저를 사용하세요. 입력한 내용은 지워지지 않았습니다.',
    );
  }
  return storage;
}

export function loadSubmissions(storage) {
  const target = getStorage(storage);
  let raw;
  try {
    raw = target.getItem(STORAGE_KEY);
  } catch (error) {
    throw new FeedbackError(
      'STORAGE_READ',
      '저장된 피드백을 읽을 수 없습니다. 브라우저 저장소 권한을 확인한 뒤 다시 시도하세요. 아무것도 변경하지 않았습니다.',
      { cause: error },
    );
  }
  return parseSubmissions(raw);
}

export function saveSubmission(name, message, storage) {
  const input = validateInput(name, message);
  const target = getStorage(storage);
  const previous = loadSubmissions(target);
  const submissions = [
    ...previous.slice(-(MAX_SUBMISSIONS - 1)),
    { ...input, submittedAt: new Date().toISOString() },
  ];
  const raw = JSON.stringify(submissions);
  try {
    target.setItem(STORAGE_KEY, raw);
  } catch (error) {
    const quotaExceeded = error instanceof Error && error.name === 'QuotaExceededError';
    throw new FeedbackError(
      quotaExceeded ? 'STORAGE_QUOTA' : 'STORAGE_WRITE',
      quotaExceeded
        ? '브라우저 저장소가 가득 찼습니다. 공간을 확보한 뒤 다시 시도하세요. 메시지는 저장되지 않았으며, 입력한 내용은 지워지지 않았습니다.'
        : '피드백을 저장할 수 없습니다. 브라우저 저장소 권한을 확인한 뒤 다시 시도하세요. 입력한 내용은 지워지지 않았습니다.',
      { cause: error },
    );
  }
  return submissions;
}
