import type { Pool } from 'pg';
import { getApiKeyService, getProviderSettingsService } from '../../services/api-key-service.js';

type ResponseBuilder = (message: string) => string;

type ProviderCredentialsResult = { apiKey: string } | { errorResponse: string };

export async function resolveSummaryProviderCredentials(
  provider: string | null | undefined,
  db: Pool,
  createResponse: ResponseBuilder
): Promise<ProviderCredentialsResult> {
  if (!provider) {
    return {
      errorResponse: createResponse(
        'Summarization unavailable: no provider configured. Please configure a summary model provider in Settings > Model Config.'
      ),
    };
  }

  if (provider !== 'anthropic') {
    return {
      errorResponse: createResponse(
        `Summarization unavailable: provider "${provider}" is not supported. Please configure Anthropic in Settings > Model Config.`
      ),
    };
  }

  const apiKeyService = getApiKeyService(db);
  const settingsService = getProviderSettingsService(db);
  const authMode = await settingsService.getAnthropicAuthMode();

  let apiKey: string | null = null;
  if (authMode === 'oauth') {
    apiKey = await apiKeyService.getOAuthToken('anthropic');
  }
  if (!apiKey) {
    apiKey = await apiKeyService.getKey('anthropic');
  }
  if (!apiKey) {
    return {
      errorResponse: createResponse(
        'Summarization unavailable: Anthropic API key or OAuth token not configured. Please configure in Settings > API Keys.'
      ),
    };
  }

  return { apiKey };
}
