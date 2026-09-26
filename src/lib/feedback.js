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
    throw new FeedbackError('INVALID_TYPE', 'Name and message must be text.');
  }
  const input = { name: name.trim(), message: message.trim() };
  if (!input.message) {
    throw new FeedbackError('EMPTY_MESSAGE', 'Enter a message before submitting.');
  }
  if (input.name.length > MAX_NAME_LENGTH) {
    throw new FeedbackError('NAME_TOO_LONG', `Name must be ${MAX_NAME_LENGTH} characters or fewer.`);
  }
  if (input.message.length > MAX_MESSAGE_LENGTH) {
    throw new FeedbackError('MESSAGE_TOO_LONG', `Message must be ${MAX_MESSAGE_LENGTH} characters or fewer.`);
  }
  return input;
}

function corruptStorage(cause) {
  return new FeedbackError(
    'CORRUPT_STORAGE',
    'Saved feedback is invalid. Nothing was changed. Back up the browser storage entry ' +
      `"${STORAGE_KEY}", then remove only that entry and reload to start again.`,
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
        'Browser storage is unavailable. Allow local storage and try again. Your form has not been cleared.',
        { cause: error },
      );
    }
  }
  if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function') {
    throw new FeedbackError(
      'STORAGE_UNAVAILABLE',
      'Browser storage is unavailable. Use a browser with local storage enabled. Your form has not been cleared.',
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
      'Could not read saved feedback. Check browser storage permissions and try again. Nothing was changed.',
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
        ? 'Browser storage is full. Free some space and try again. Your message was not saved; your form has not been cleared.'
        : 'Could not save feedback. Check browser storage permissions and try again. Your form has not been cleared.',
      { cause: error },
    );
  }
  return submissions;
}
