/**
 * Terminal UI utilities for the Formo CLI.
 *
 * Uses raw ANSI escape codes (no dependencies) for coloring and styling.
 * Colors are automatically disabled when stdout is not a TTY (piped output, CI, etc.)
 * or when the NO_COLOR environment variable is set.
 */

const isTTY = process.stdout.isTTY === true
const noColor = !!process.env.NO_COLOR

/** Whether color output is enabled */
const colorEnabled = isTTY && !noColor

// ── ANSI helpers ──

function ansi(code: string, text: string): string {
  return colorEnabled ? `\x1b[${code}m${text}\x1b[0m` : text
}

export const color = {
  green: (t: string) => ansi('32', t),
  brightGreen: (t: string) => ansi('92', t),
  dim: (t: string) => ansi('2', t),
  bold: (t: string) => ansi('1', t),
  yellow: (t: string) => ansi('33', t),
  red: (t: string) => ansi('31', t),
  cyan: (t: string) => ansi('36', t),
  gray: (t: string) => ansi('90', t),
  white: (t: string) => ansi('97', t),
  boldGreen: (t: string) => ansi('1;32', t),
  boldBrightGreen: (t: string) => ansi('1;92', t),
}

// ── ASCII Art Logo ──

const LOGO_LINES = [
  ' ███████╗ ██████╗  ██████╗  ███╗   ███╗ ██████╗ ',
  ' ██╔════╝██╔═══██╗██╔══██╗ ████╗ ████║██╔═══██╗',
  ' █████╗  ██║   ██║██████╔╝ ██╔████╔██║██║   ██║',
  ' ██╔══╝  ██║   ██║██╔══██╗ ██║╚██╔╝██║██║   ██║',
  ' ██║     ╚██████╔╝██║  ██║ ██║ ╚═╝ ██║╚██████╔╝',
  ' ╚═╝      ╚═════╝ ╚═╝  ╚═╝ ╚═╝     ╚═╝ ╚═════╝ ',
]

/**
 * Returns the Formo ASCII art banner in green.
 * Only shown when stdout is a TTY.
 */
export function banner(): string {
  if (!isTTY) return ''

  const logo = LOGO_LINES.map((line) => color.boldGreen(line)).join('\n')
  const tagline = color.dim('  Web3 Analytics Platform — CLI')
  const separator = color.dim('─'.repeat(50))

  return `\n${logo}\n${tagline}\n${separator}\n`
}

// ── Status messages ──

export function success(message: string): string {
  return `${color.boldGreen('✔')} ${message}`
}

export function error(message: string): string {
  return `${color.red('✖')} ${message}`
}

export function warn(message: string): string {
  return `${color.yellow('⚠')} ${message}`
}

export function info(message: string): string {
  return `${color.cyan('ℹ')} ${message}`
}

// ── Formatting helpers ──

export function keyValue(key: string, value: string): string {
  return `${color.dim(key + ':')} ${value}`
}

export function heading(text: string): string {
  return color.boldGreen(text)
}
