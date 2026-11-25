import { serialize, toPlain } from "../utils/serialize.js";
import { LogData } from "../types/index.js";
import { TimeUtil } from "../utils/TimeUtil.js";
import { ColorUtil } from "../utils/ColorUtil.js";

export interface FormatterOptions {
  colorize?: boolean;
  json?: boolean;
  timestampFormat?: string;
  timestamp?: boolean;
  customColors?: { [level: string]: string };
}

const RESERVED_JSON_KEYS = ["level", "message", "timestamp", "prefix"] as const;

// JSON output puts metadata keys next to the built-in fields. A colliding key makes a duplicate
// JSON key, and most parsers keep the last one, so user input could change the level or message.
// Move colliding keys under "metadata" so that the built-in fields stay correct.
function moveReservedKeys(metadata: Record<string, any>): Record<string, any> {
  let clash = false;
  for (const key of RESERVED_JSON_KEYS) clash ||= Object.hasOwn(metadata, key);
  if (!clash) return metadata;
  const rest: Record<string, any> = { ...metadata };
  const moved: Record<string, any> = {};
  for (const key of [...RESERVED_JSON_KEYS, "metadata"]) {
    if (Object.hasOwn(rest, key)) moved[key] = rest[key];
    delete rest[key];
  }
  return { ...rest, metadata: moved };
}

function jsonFields(metadata: any): string {
  if (typeof metadata.toJSON === "function") metadata = toPlain(metadata);
  if (metadata === null || typeof metadata !== "object" || Array.isArray(metadata)) metadata = { metadata };
  return serialize(moveReservedKeys(metadata));
}

/** An error as a person reads it: stack, own fields, then the cause. */
function errorText(error: Error, depth = 0): string {
  let text = String(error.stack ?? error);
  const fields = serialize({ ...error });
  if (fields !== "{}") text += "\n" + fields;
  const { cause } = error;
  if (cause !== undefined) {
    text += "\ncaused by: " + (!(cause instanceof Error) ? serialize(cause) : depth < 8 ? errorText(cause, depth + 1) : "[Truncated]");
  }
  return text;
}

function textFields(metadata: Record<string, any>): string {
  let errors = "";
  let rest = metadata;
  for (const key in metadata) {
    const value = metadata[key];
    if (!(value instanceof Error)) continue;
    if (rest === metadata) rest = { ...metadata };
    delete rest[key];
    errors += "\n" + (key === "err" ? "" : key + ": ") + errorText(value);
  }
  const fields = serialize(rest);
  return (errors && fields === "{}" ? "" : " " + fields) + errors;
}

// Color codes, and all control characters except tab.
// eslint-disable-next-line no-control-regex
const CONTROL = /\x1b\[[0-9;]*m|[\x00-\x08\n-\x1f\x7f-\x9f]/g;
// eslint-disable-next-line no-control-regex
const HAS_CONTROL = /[\x00-\x08\n-\x1f\x7f-\x9f]/;

// Text from a user must not move the cursor, or start a line that looks like another record.
// A newline stays readable, but the next line is indented.
function escapeControls(text: string, keepColor: boolean): string {
  if (!HAS_CONTROL.test(text)) return text;
  return text.replace(CONTROL, (match) => {
    if (match === "\n") return "\n    ";
    if (match.length > 1 && keepColor) return match;
    return "\\x" + match.charCodeAt(0).toString(16).padStart(2, "0") + match.slice(1);
  });
}

export class Formatter {
  private readonly _options: FormatterOptions;
  // Colored or upper-case label of each level, built on first use.
  private readonly _labels: { [level: string]: string } = Object.create(null);
  // Start of the JSON record of each level.
  private readonly _heads: { [level: string]: string } = Object.create(null);
  private _lastTimestampKey: number = Number.NaN;
  private _lastTimestamp: string = "";
  private _lastMessage: string | undefined;
  private _lastQuotedMessage: string = "";

  constructor(options: FormatterOptions = {}) {
    this._options = {
      colorize: true,
      json: false,
      timestampFormat: "YYYY-MM-DD HH:mm:ss",
      timestamp: false,
      ...options,
    };
  }

  format(data: LogData): string {
    return this._options.json ? this._formatAsJson(data) : this._formatAsText(data);
  }

  private _quoteMessage(message: string): string {
    if (message !== this._lastMessage) {
      this._lastMessage = message;
      this._lastQuotedMessage = JSON.stringify(message);
    }
    return this._lastQuotedMessage;
  }

  private _formatTimestamp(timestamp: Date): string {
    const timestampKey = timestamp.getTime() * 2 + (this._options.json ? 1 : 0);
    if (timestampKey !== this._lastTimestampKey) {
      this._lastTimestampKey = timestampKey;
      this._lastTimestamp = this._options.json
        ? timestamp.toISOString()
        : TimeUtil.format(timestamp, this._options.timestampFormat!);
    }
    return this._lastTimestamp;
  }

  private _formatAsJson(data: LogData): string {
    const { level, prefix, metadata } = data;
    // String concatenation is faster than an array of fragments on this hot path.
    let output = (this._heads[level] ??= `{"level":${JSON.stringify(level)},"message":`) + this._quoteMessage(data.message);
    if (this._options.timestamp) output += `,"timestamp":"${this._formatTimestamp(data.timestamp)}"`;
    if (prefix) output += `,"prefix":${JSON.stringify(prefix)}`;
    if (metadata != null) {
      let fields: string;
      try {
        fields = jsonFields(metadata);
      } catch {
        // For example a proxy that throws.
        fields = jsonFields({ metadata: toPlain(metadata) });
      }
      if (fields.length > 2) output += "," + fields.slice(1, -1);
    }
    return output + "}";
  }

  private _label(level: string): string {
    const upper = level.toUpperCase();
    return this._labels[level] = this._options.colorize
      ? ColorUtil.colorize(upper, this._options.customColors?.[level] || level)
      : upper;
  }

  private _formatAsText(data: LogData): string {
    let text = data.message;
    if (data.metadata != null) {
      try {
        text += textFields(data.metadata);
      } catch {
        text += " " + serialize(data.metadata);
      }
    }
    const keepColor = this._options.colorize!;
    const label = this._labels[data.level] ?? this._label(data.level);
    let output = `[${label}] ${escapeControls(text, keepColor)}`;
    if (data.prefix) output = `${escapeControls(data.prefix, keepColor)} ${output}`;
    if (this._options.timestamp) output = `[${this._formatTimestamp(data.timestamp)}] ${output}`;
    return output;
  }

  setJson(json: boolean): void {
    this._options.json = json;
  }

  isColorized(): boolean {
    return this._options.colorize!;
  }

  isJson(): boolean {
    return this._options.json!;
  }

  getTimestampFormat(): string {
    return this._options.timestampFormat!;
  }

  hasTimestamp(): boolean {
    return this._options.timestamp!;
  }

  getCustomColors(): { [level: string]: string } {
    return { ...this._options.customColors };
  }
}
