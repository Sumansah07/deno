import { BaseProvider } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';
import type { LanguageModelV1 } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

export default class NovitaProvider extends BaseProvider {
  name = 'Novita';
  getApiKeyLink = 'https://novita.ai/settings';

  config = {
    apiTokenKey: 'NOVITA_API_KEY',
    baseUrlKey: 'NOVITA_API_BASE_URL',
  };

  staticModels: ModelInfo[] = [
    {
      name: 'qwen/qwen3-coder-480b-a35b-instruct',
      label: 'Qwen3 Coder 480B (Novita)',
      provider: 'Novita',
      maxTokenAllowed: 320000,
      maxCompletionTokens: 100000,
    },
  ];

  getModelInstance(options: {
    model: string;
    serverEnv: Env;
    apiKeys?: Record<string, string>;
    providerSettings?: Record<string, IProviderSetting>;
  }): LanguageModelV1 {
    const { model, serverEnv, apiKeys, providerSettings } = options;

    const { baseUrl, apiKey } = this.getProviderBaseUrlAndKey({
      apiKeys,
      providerSettings: providerSettings?.[this.name],
      serverEnv: serverEnv as any,
      defaultBaseUrlKey: 'NOVITA_API_BASE_URL',
      defaultApiTokenKey: 'NOVITA_API_KEY',
    });

    if (!apiKey) {
      throw new Error(`Missing API key for ${this.name} provider`);
    }

    const novita = createOpenAI({
      apiKey,
      baseURL: baseUrl || 'https://api.novita.ai/v3/openai',
    });

    return novita(model);
  }
}
