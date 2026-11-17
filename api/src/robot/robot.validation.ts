import type { RawData } from 'ws';
import type {
  HomeState,
  HubStatus,
  NavigationMode,
  RobotCommand,
  RobotDirection,
  RobotState,
  RobotToApiMessage,
  SteerDirection,
} from '../protocol/protocol.js';

const ROBOT_STATES: RobotState[] = ['IDLE', 'PATROL', 'ALERT', 'MANUAL'];

const DIRECTIONS: RobotDirection[] = ['forward', 'backward', 'left', 'right'];

const STEER_DIRECTIONS: SteerDirection[] = ['left', 'right', 'center'];

const HOME_STATES: HomeState[] = [
  'none',
  'recording',
  'returning',
  'patrolling',
];

const HUB_STATUSES: HubStatus[] = ['online', 'offline'];

const NAVIGATION_MODES: NavigationMode[] = ['ROUTE', 'FREE'];

const COMMANDS: RobotCommand['cmd'][] = [
  'move',
  'turn',
  'steer',
  'stop',
  'servo',
  'set_state',
  'alert',
  'resume',
  'hide',
  'set_home',
  'return_home',
  'navigation',
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isRobotState = (value: unknown): value is RobotState =>
  ROBOT_STATES.some((state) => state === value);

const isDirection = (value: unknown): value is RobotDirection =>
  DIRECTIONS.some((direction) => direction === value);

const isSteerDirection = (value: unknown): value is SteerDirection =>
  STEER_DIRECTIONS.some((direction) => direction === value);

const isHomeState = (value: unknown): value is HomeState =>
  HOME_STATES.some((state) => state === value);

const isHubStatus = (value: unknown): value is HubStatus =>
  HUB_STATUSES.some((status) => status === value);

export const isNavigationMode = (value: unknown): value is NavigationMode =>
  NAVIGATION_MODES.some((mode) => mode === value);

const isCommandName = (value: unknown): value is RobotCommand['cmd'] =>
  COMMANDS.some((cmd) => cmd === value);

const isNullableNumber = (value: unknown): value is number | null =>
  value === null || typeof value === 'number';

export const decodeMessage = (raw: RawData): string => {
  if (Array.isArray(raw)) {
    return Buffer.concat(raw).toString('utf8');
  }
  if (Buffer.isBuffer(raw)) {
    return raw.toString('utf8');
  }
  return Buffer.from(new Uint8Array(raw)).toString('utf8');
};

export const parseJson = (raw: string): unknown => {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const parseRobotCommand = (value: unknown): RobotCommand | null => {
  if (!isRecord(value) || !isCommandName(value.cmd)) {
    return null;
  }
  const { cmd, dir, speed, state, pan, tilt, mode } = value;

  switch (cmd) {
    case 'move':
    case 'turn':
      if (!isDirection(dir) || typeof speed !== 'number') {
        return null;
      }
      return {
        type: 'command',
        cmd,
        dir,
        speed: Math.max(0, Math.min(100, Math.round(speed))),
      };
    case 'steer':
      return isSteerDirection(dir) ? { type: 'command', cmd, dir } : null;
    case 'set_state':
      return isRobotState(state) ? { type: 'command', cmd, state } : null;
    case 'navigation':
      return isNavigationMode(mode) ? { type: 'command', cmd, mode } : null;
    case 'servo':
      return typeof pan === 'number' && typeof tilt === 'number'
        ? { type: 'command', cmd, pan, tilt }
        : null;
    case 'stop':
    case 'alert':
    case 'resume':
    case 'hide':
    case 'set_home':
    case 'return_home':
      return { type: 'command', cmd };
  }
};

export const parseRobotMessage = (raw: string): RobotToApiMessage | null => {
  const message = parseJson(raw);
  if (!isRecord(message)) {
    return null;
  }
  const {
    type,
    robot_id,
    state,
    distance_cm,
    hub,
    battery,
    home,
    odometer,
    ts,
    cmd,
  } = message;

  switch (type) {
    case 'hello':
      return typeof robot_id === 'string' ? { type, robot_id } : null;
    case 'telemetry':
      return isRobotState(state) &&
        isNullableNumber(distance_cm) &&
        isHubStatus(hub) &&
        isNullableNumber(battery) &&
        isHomeState(home) &&
        (odometer === undefined || isNullableNumber(odometer)) &&
        typeof ts === 'number'
        ? {
            type,
            state,
            distance_cm,
            hub,
            battery,
            home,
            odometer: odometer ?? null,
            ts,
          }
        : null;
    case 'pong':
      return typeof ts === 'number' ? { type, ts } : null;
    case 'ack':
      return isCommandName(cmd) && typeof ts === 'number'
        ? { type, cmd, ts }
        : null;
    default:
      return null;
  }
};
