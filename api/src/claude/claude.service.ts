import Anthropic from '@anthropic-ai/sdk';
import { Injectable, Logger } from '@nestjs/common';

const DEFAULT_MODEL = 'claude-haiku-5-5';
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_TOKENS = 300;
const PROMPT =
  'Це кадр з камери охоронного робота. Опиши українською 1–2 реченнями: що робить людина, одяг, що тримає в руках, чи є ознаки підозрілої поведінки. Не намагайся встановити, хто це.';

@Injectable()
export class ClaudeService {
  private readonly logger = new Logger(ClaudeService.name);
  private readonly model = process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL;
  private readonly client: Anthropic | null;

  constructor() {
    const enabled =
      process.env.CLAUDE_ENABLED !== 'false' &&
      Boolean(process.env.ANTHROPIC_API_KEY);
    this.client = enabled
      ? new Anthropic({ timeout: REQUEST_TIMEOUT_MS, maxRetries: 1 })
      : null;
    this.logger.log(
      enabled
        ? `scene descriptions on, model ${this.model}`
        : 'scene descriptions off (CLAUDE_ENABLED=false or no ANTHROPIC_API_KEY)',
    );
  }

  get enabled(): boolean {
    return this.client !== null;
  }

  async describe(jpeg: Buffer): Promise<string | null> {
    if (!this.client) {
      return null;
    }
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: MAX_TOKENS,
      thinking: { type: 'disabled' },
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/jpeg',
                data: jpeg.toString('base64'),
              },
            },
            { type: 'text', text: PROMPT },
          ],
        },
      ],
    });
    if (response.stop_reason === 'refusal') {
      this.logger.warn('Claude declined to describe the snapshot');
      return null;
    }
    const text = response.content
      .flatMap((block) => (block.type === 'text' ? [block.text] : []))
      .join(' ')
      .trim();
    return text || null;
  }
}
