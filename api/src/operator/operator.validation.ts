import type {
  OperatorClientMessage,
  SystemMode,
} from '../protocol/protocol.js';
import { parseJson, parseRobotCommand } from '../robot/robot.validation.js';

const SYSTEM_MODES: SystemMode[] = ['PATROL', 'STATIONARY'];

const isSystemMode = (value: unknown): value is SystemMode =>
  SYSTEM_MODES.some((mode) => mode === value);

export const parseOperatorMessage = (
  raw: string,
): OperatorClientMessage | null => {
  const message = parseJson(raw);
  if (typeof message !== 'object' || message === null) {
    return null;
  }
  const { type, command, mode } = message as Record<string, unknown>;
  if (type === 'set_mode') {
    return isSystemMode(mode) ? { type, mode } : null;
  }
  if (type !== 'control') {
    return null;
  }
  const robotCommand = parseRobotCommand(command);
  return robotCommand ? { type, command: robotCommand } : null;
};
