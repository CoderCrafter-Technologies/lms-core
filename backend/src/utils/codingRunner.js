const detectFunctionName = (language, code) => {
  if (!code || typeof code !== 'string') return null;

  if (language === 'javascript') {
    const functionDecl = code.match(/function\s+([A-Za-z_]\w*)\s*\(/);
    if (functionDecl) return functionDecl[1];

    const variableFn = code.match(
      /(?:const|let|var)\s+([A-Za-z_]\w*)\s*=\s*(?:async\s*)?(?:function\b|\([^)]*\)\s*=>|[A-Za-z_]\w*\s*=>)/
    );
    if (variableFn) return variableFn[1];
  }

  if (language === 'python') {
    const match = code.match(/def\s+([A-Za-z_]\w*)\s*\(/);
    return match ? match[1] : null;
  }

  return null;
};

const parseToken = (token) => {
  if (token === 'true') return true;
  if (token === 'false') return false;
  if (/^-?\d+$/.test(token)) return Number(token);
  if (/^-?\d+\.\d+$/.test(token)) return Number(token);
  return token;
};

const parseInputToArgs = (rawInput = '') => {
  const raw = String(rawInput || '').trim();
  const lines = raw ? raw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean) : [];

  if (lines.length === 0) return [];

  if (lines.length === 1) {
    const tokens = lines[0].split(/\s+/).filter(Boolean);
    if (tokens.length > 2) {
      const values = tokens.map(parseToken);
      return [values.slice(0, -1), values[values.length - 1]];
    }
    if (tokens.length === 1) return [parseToken(tokens[0])];
    return [tokens.map(parseToken)];
  }

  return lines.map((line, idx) => {
    const tokens = line.split(/\s+/).filter(Boolean);
    if (tokens.length === 1) return parseToken(tokens[0]);
    if (idx === 0) return tokens.map(parseToken);
    return tokens.map(parseToken);
  });
};

const usesStdinPattern = (language, code) => {
  if (!code || typeof code !== 'string') return false;
  if (language === 'javascript') {
    return /fs\.readFileSync\s*\(\s*0|process\.stdin|readline/i.test(code);
  }
  if (language === 'python') {
    return /sys\.stdin|input\s*\(/i.test(code);
  }
  return false;
};

const buildJsHarness = (sourceCode, fnName, rawInput) => {
  const args = parseInputToArgs(rawInput);
  return `
${sourceCode}
const __args = ${JSON.stringify(args)};
const __candidate = typeof ${fnName} === 'function' ? ${fnName} : (globalThis && globalThis[${JSON.stringify(fnName)}]);
if (typeof __candidate !== 'function') {
  console.error('Function "${fnName}" not found.');
  process.exit(1);
}
Promise.resolve(__candidate(...__args))
  .then((__result) => {
    if (Array.isArray(__result)) {
      console.log(__result.join(' '));
      return;
    }
    if (__result !== undefined && __result !== null) {
      if (typeof __result === 'object') {
        console.log(JSON.stringify(__result));
        return;
      }
      console.log(__result);
    }
  })
  .catch((error) => {
    console.error(error?.stack || String(error));
    process.exit(1);
  });
`;
};

const buildPythonHarness = (sourceCode, fnName, rawInput) => {
  const args = parseInputToArgs(rawInput);
  const argsJson = JSON.stringify(args);
  return `
${sourceCode}
import json, inspect, asyncio
__args = json.loads(${JSON.stringify(argsJson)})
__fn = globals().get(${JSON.stringify(fnName)})
if not callable(__fn):
    raise Exception('Function "${fnName}" not found.')
__result = __fn(*__args)
if inspect.iscoroutine(__result):
    __result = asyncio.run(__result)
if isinstance(__result, (list, tuple)):
    print(' '.join(map(str, __result)))
elif __result is not None:
    if isinstance(__result, dict):
        print(json.dumps(__result))
    else:
        print(__result)
`;
};

const buildExecutableCode = ({ question, language, userCode, rawInput = '' }) => {
  const template = question?.coding?.starterCode?.[language];

  if (template && template.includes('{{USER_CODE}}')) {
    const code = typeof userCode !== 'string' ? template.replace('{{USER_CODE}}', '') : template.replace('{{USER_CODE}}', userCode);
    return { code, stdin: rawInput };
  }

  const sourceCode =
    typeof userCode === 'string' && userCode.trim().length > 0
      ? userCode
      : (typeof template === 'string' ? template : '');

  if (!sourceCode) return { code: '', stdin: '' };
  if (usesStdinPattern(language, sourceCode)) {
    return { code: sourceCode, stdin: rawInput };
  }

  const fnName = detectFunctionName(language, sourceCode);
  if (!fnName) return { code: sourceCode, stdin: rawInput };

  if (language === 'javascript') {
    return { code: buildJsHarness(sourceCode, fnName, rawInput), stdin: '' };
  }
  if (language === 'python') {
    return { code: buildPythonHarness(sourceCode, fnName, rawInput), stdin: '' };
  }
  return { code: sourceCode, stdin: rawInput };
};

module.exports = {
  buildExecutableCode,
  parseInputToArgs
};
