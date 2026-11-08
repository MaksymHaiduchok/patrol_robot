import { BadRequestException } from '@nestjs/common';
import type { CreatePersonRequest } from '../protocol/protocol.js';

const MAX_NAME_LENGTH = 100;

export const parseCreatePersonRequest = (
  body: unknown,
): CreatePersonRequest => {
  const name =
    typeof body === 'object' && body !== null
      ? (body as Record<string, unknown>).name
      : undefined;
  if (typeof name !== 'string' || !name.trim()) {
    throw new BadRequestException('name is required');
  }
  if (name.trim().length > MAX_NAME_LENGTH) {
    throw new BadRequestException(
      `name must be at most ${MAX_NAME_LENGTH} characters`,
    );
  }
  return { name: name.trim() };
};
