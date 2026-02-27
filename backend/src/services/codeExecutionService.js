const { postJson } = require('../utils/httpJson');

const PISTON_EXECUTE_URL = process.env.PISTON_EXECUTE_URL || 'https://emkc.org/api/v2/piston/execute';

const executeCode = async ({ language, code, stdin = '', version = '*' }) => {
  const response = await postJson(PISTON_EXECUTE_URL, {
    language,
    version,
    files: [{ content: code }],
    stdin
  });

  if (!response.ok) {
    const errorText =
      typeof response.data === 'string'
        ? response.data
        : JSON.stringify(response.data || {});
    throw new Error(`Piston request failed (${response.status}): ${errorText}`);
  }

  const run = response.data?.run || {};
  return {
    stdout: String(run.stdout || run.output || ''),
    stderr: String(run.stderr || ''),
    output: String(run.output || ''),
    code: run.code,
    signal: run.signal
  };
};

module.exports = {
  executeCode
};
