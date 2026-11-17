import {
  BadGatewayException,
  Injectable,
  Logger,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { FaceFailureReason } from '../protocol/protocol.js';

type EmbedResponse = {
  embedding: number[];
};

type CaptureResponse = {
  embedding: number[];
  image: string;
};

type ErrorResponse = {
  detail: string;
};

const FACE_FAILURE_REASONS: FaceFailureReason[] = [
  'no_face',
  'multiple_faces',
  'invalid_image',
];

const REQUEST_TIMEOUT_MS = 10_000;

export class FaceRejectedError extends UnprocessableEntityException {
  constructor(readonly reason: FaceFailureReason) {
    super(reason);
  }
}

@Injectable()
export class VisionService {
  private readonly logger = new Logger(VisionService.name);
  private readonly baseUrl = process.env.VISION_URL ?? 'http://localhost:8001';

  async embed(image: Buffer): Promise<number[]> {
    const data = await this.post<EmbedResponse>('/faces/embed', {
      body: new Uint8Array(image),
      headers: { 'Content-Type': 'application/octet-stream' },
    });
    return data.embedding;
  }

  capture(): Promise<CaptureResponse> {
    return this.post<CaptureResponse>('/faces/capture');
  }

  async snapshot(ts?: number): Promise<Buffer | null> {
    const query = ts === undefined ? '' : `?ts=${ts}`;
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/snapshot${query}`, {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      this.logger.warn(`vision /snapshot unavailable: ${String(error)}`);
      return null;
    }
    if (!response.ok) {
      this.logger.warn(`vision /snapshot returned ${response.status}`);
      return null;
    }
    return Buffer.from(await response.arrayBuffer());
  }

  async reload(): Promise<void> {
    try {
      await this.post('/faces/reload');
    } catch (error) {
      this.logger.warn(`vision did not reload faces: ${String(error)}`);
    }
  }

  private async post<T>(path: string, init?: RequestInit): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        method: 'POST',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      this.logger.error(`vision ${path} unavailable: ${String(error)}`);
      throw new BadGatewayException('Vision service is unavailable');
    }

    if (response.ok) {
      return (await response.json()) as T;
    }

    const detail = await response
      .json()
      .then((body: ErrorResponse) => body.detail)
      .catch(() => response.statusText);
    const reason = FACE_FAILURE_REASONS.find((item) => item === detail);
    if (reason) {
      throw new FaceRejectedError(reason);
    }
    this.logger.error(`vision ${path} failed: ${response.status} ${detail}`);
    throw new BadGatewayException(`Vision error: ${detail}`);
  }
}
