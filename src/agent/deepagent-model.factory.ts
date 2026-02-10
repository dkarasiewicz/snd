import { Injectable } from '@nestjs/common';
import { ConfigService } from '../config/config.service.js';
import { CredentialStoreService } from '../core/credential-store.service.js';

@Injectable()
export class DeepAgentModelFactory {
  constructor(
    private readonly configService: ConfigService,
    private readonly credentialStoreService: CredentialStoreService,
  ) {}

  buildModelConfig(): Record<string, unknown> {
    const config = this.configService.load();
    const apiKey = this.credentialStoreService.getSecret(config.llm.apiKeySecretKey);

    if (!apiKey) {
      throw new Error(
        `Missing LLM API token in secret key ${config.llm.apiKeySecretKey}. Run: snd auth --llm-token`,
      );
    }

    return {
      model: config.llm.model,
      apiKey,
      baseUrl: config.llm.baseUrl,
    };
  }
}
