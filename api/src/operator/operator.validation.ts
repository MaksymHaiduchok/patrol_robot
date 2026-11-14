import type { OperatorClientMessage } from '../protocol/protocol.js';
import { parseJson, parseRobotCommand } from '../robot/robot.validation.js';

export const parseOperatorMessage = (
  raw: string,
): OperatorClientMessage | null => {
  const message = parseJson(raw);
  if (typeof message !== 'object' || message === null) {
    return null;
  }
  const { type, command } = message as Record<string, unknown>;
  if (type !== 'control') {
    return null;
  }
  const robotCommand = parseRobotCommand(command);
  return robotCommand ? { type, command: robotCommand } : null;
};
