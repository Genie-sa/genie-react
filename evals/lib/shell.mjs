const SEPARATORS = ['&&', '||', ';', '|', '\n', '&']
const WRAPPERS = new Set(['time', 'nohup', 'command', 'exec'])
const RUNNERS = [
  ['pnpm', 'exec'],
  ['pnpm', 'dlx'],
  ['npm', 'exec'],
  ['npx'],
  ['pnpm'],
  ['bunx'],
  ['yarn'],
]
const ENV_ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/

/**
 * Splits a shell command into simple-command word lists, honouring quotes so JSON arguments survive.
 * @param {string} command
 * @returns {string[][]}
 */
export function splitShellCommands(command) {
  /** @type {string[][]} */
  const commands = []
  /** @type {string[]} */
  let words = []
  let word = ''
  let inWord = false
  /** @type {string | null} */
  let quote = null

  const endWord = () => {
    if (inWord) words.push(word)
    word = ''
    inWord = false
  }
  const endCommand = () => {
    endWord()
    if (words.length > 0) commands.push(words)
    words = []
  }

  for (let index = 0; index < command.length; index += 1) {
    const char = command[index]
    if (quote) {
      if (char === quote) quote = null
      else if (char === '\\' && quote === '"' && index + 1 < command.length) {
        index += 1
        word += command[index]
      } else word += char
      continue
    }
    if (char === "'" || char === '"') {
      quote = char
      inWord = true
      continue
    }
    if (char === '\\' && index + 1 < command.length) {
      index += 1
      if (command[index] !== '\n') {
        word += command[index]
        inWord = true
      }
      continue
    }
    const separator = SEPARATORS.find((candidate) => command.startsWith(candidate, index))
    const isRedirection =
      separator === '&' && (command[index - 1] === '>' || command[index + 1] === '>')
    if (separator && !isRedirection) {
      endCommand()
      index += separator.length - 1
      continue
    }
    if (char === '(' || char === ')' || char === '`') {
      endCommand()
      continue
    }
    if (char === ' ' || char === '\t') {
      endWord()
      continue
    }
    word += char
    inWord = true
  }
  endCommand()
  return commands
}

/**
 * Removes env assignments, `timeout N`, and package-runner prefixes so the program name comes first.
 * @param {string[]} words
 * @returns {string[]}
 */
export function programWords(words) {
  let rest = words
  for (;;) {
    const [first, second] = rest
    if (first === undefined) return rest
    if (ENV_ASSIGNMENT.test(first)) rest = rest.slice(1)
    else if (first === 'env') rest = rest.slice(1)
    else if (WRAPPERS.has(first)) rest = rest.slice(1)
    else if (first === 'timeout' && second !== undefined) rest = rest.slice(2)
    else break
  }
  for (const runner of RUNNERS) {
    if (runner.every((part, index) => rest[index] === part) && rest.length > runner.length) {
      return rest.slice(runner.length)
    }
  }
  return rest
}

/**
 * @param {string} word
 * @returns {string}
 */
export function basename(word) {
  return word.slice(word.lastIndexOf('/') + 1)
}

/**
 * Codex wraps every command as `bash -lc '<script>'`; unwrap it so counting sees the real script.
 * @param {string} command
 * @returns {string}
 */
export function unwrapShellInvocation(command) {
  const [words] = splitShellCommands(command)
  if (words?.length !== 3) return command
  const [shell, flag, script] = words
  if (shell === undefined || flag === undefined || script === undefined) return command
  return /^(ba|z|da)?sh$/.test(basename(shell)) && /^-l?c$/.test(flag) ? script : command
}
