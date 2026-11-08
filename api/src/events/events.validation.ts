import { BadRequestException } from '@nestjs/common';
import type {
  EventType,
  ReviewEventRequest,
  ReviewStatus,
  VisionEvent,
} from '../protocol/protocol.js';

const EVENT_TYPES: EventType[] = [
  'person_detected',
  'known_person',
  'stranger_detected',
  'person_left',
];

const REVIEW_STATUSES: ReviewStatus[] = ['known', 'known_pending', 'stranger'];

const isReviewStatus = (value: unknown): value is ReviewStatus =>
  REVIEW_STATUSES.some((status) => status === value);

const isEventType = (value: unknown): value is EventType =>
  EVENT_TYPES.some((type) => type === value);

const isNullableNumber = (value: unknown): value is number | null | undefined =>
  value === null || value === undefined || typeof value === 'number';

const isNullableString = (value: unknown): value is string | null | undefined =>
  value === null || value === undefined || typeof value === 'string';

export const parseVisionEvent = (body: unknown): VisionEvent => {
  if (typeof body !== 'object' || body === null) {
    throw new BadRequestException('Body must be a JSON object');
  }
  const { type, confidence, person_id, ts } = body as Record<string, unknown>;

  if (!isEventType(type)) {
    throw new BadRequestException(
      `type must be one of: ${EVENT_TYPES.join(', ')}`,
    );
  }
  if (!isNullableNumber(confidence)) {
    throw new BadRequestException('confidence must be a number');
  }
  if (!isNullableString(person_id)) {
    throw new BadRequestException('person_id must be a string');
  }
  if (typeof ts !== 'number') {
    throw new BadRequestException(
      'ts must be a unix timestamp in milliseconds',
    );
  }

  return {
    type,
    confidence: confidence ?? null,
    person_id: person_id ?? null,
    ts,
  };
};

export const parsePagination = (
  limit: string | undefined,
  offset: string | undefined,
): { limit: number; offset: number } => {
  const parsedLimit = Number(limit ?? 50);
  const parsedOffset = Number(offset ?? 0);
  if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 200) {
    throw new BadRequestException('limit must be an integer between 1 and 200');
  }
  if (!Number.isInteger(parsedOffset) || parsedOffset < 0) {
    throw new BadRequestException('offset must be a non-negative integer');
  }
  return { limit: parsedLimit, offset: parsedOffset };
};

export const parseReviewRequest = (body: unknown): ReviewEventRequest => {
  if (typeof body !== 'object' || body === null) {
    throw new BadRequestException('Body must be a JSON object');
  }
  const { status, person_id } = body as Record<string, unknown>;

  if (!isReviewStatus(status)) {
    throw new BadRequestException(
      `status must be one of: ${REVIEW_STATUSES.join(', ')}`,
    );
  }
  if (!isNullableString(person_id)) {
    throw new BadRequestException('person_id must be a string');
  }
  if (status === 'known' && !person_id) {
    throw new BadRequestException('person_id is required for status known');
  }
  if (status !== 'known' && person_id) {
    throw new BadRequestException('person_id is allowed only for status known');
  }

  return { status, person_id: person_id ?? null };
};
