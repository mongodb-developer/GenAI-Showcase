import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock @ai-sdk/xai
const mockXaiModel = { modelId: 'grok-model', provider: 'xai' };
vi.mock('@ai-sdk/xai', () => ({
  xai: vi.fn().mockReturnValue(mockXaiModel),
}));

// Mock @ai-sdk/openai
const mockMinimaxModel = { modelId: 'minimax-model', provider: 'minimax' };
const mockProviderFn = vi.fn().mockReturnValue(mockMinimaxModel);
vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: vi.fn().mockReturnValue(mockProviderFn),
}));

describe('getLLMModel', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('defaults to xai provider when LLM_PROVIDER is not set', async () => {
    delete process.env.LLM_PROVIDER;
    const { getLLMModel } = await import('../lib/llm-provider');
    const { xai } = await import('@ai-sdk/xai');

    const model = getLLMModel();

    expect(model).toBeDefined();
    expect(xai).toHaveBeenCalledWith('grok-2-1212');
  });

  it('uses xai provider when LLM_PROVIDER is "xai"', async () => {
    process.env.LLM_PROVIDER = 'xai';
    const { getLLMModel } = await import('../lib/llm-provider');
    const { xai } = await import('@ai-sdk/xai');

    getLLMModel();

    expect(xai).toHaveBeenCalledWith('grok-2-1212');
  });

  it('uses minimax provider when LLM_PROVIDER is "minimax"', async () => {
    process.env.LLM_PROVIDER = 'minimax';
    process.env.MINIMAX_API_KEY = 'test-minimax-key';
    const { getLLMModel } = await import('../lib/llm-provider');
    const { createOpenAI } = await import('@ai-sdk/openai');

    getLLMModel();

    expect(createOpenAI).toHaveBeenCalledWith(
      expect.objectContaining({
        baseURL: 'https://api.minimax.io/v1',
        apiKey: 'test-minimax-key',
      })
    );
  });

  it('uses custom MINIMAX_BASE_URL when provided', async () => {
    process.env.LLM_PROVIDER = 'minimax';
    process.env.MINIMAX_API_KEY = 'test-key';
    process.env.MINIMAX_BASE_URL = 'https://api.minimaxi.com/v1';
    const { getLLMModel } = await import('../lib/llm-provider');
    const { createOpenAI } = await import('@ai-sdk/openai');

    getLLMModel();

    expect(createOpenAI).toHaveBeenCalledWith(
      expect.objectContaining({
        baseURL: 'https://api.minimaxi.com/v1',
        apiKey: 'test-key',
      })
    );
  });

  it('uses MiniMax-M2.7 as default model for minimax provider', async () => {
    process.env.LLM_PROVIDER = 'minimax';
    process.env.MINIMAX_API_KEY = 'test-key';
    const { getLLMModel } = await import('../lib/llm-provider');
    const { createOpenAI } = await import('@ai-sdk/openai');

    getLLMModel();

    const providerFn = (createOpenAI as any).mock.results[0].value;
    expect(providerFn).toHaveBeenCalledWith('MiniMax-M2.7');
  });

  it('uses custom modelId when provided for minimax', async () => {
    process.env.LLM_PROVIDER = 'minimax';
    process.env.MINIMAX_API_KEY = 'test-key';
    const { getLLMModel } = await import('../lib/llm-provider');
    const { createOpenAI } = await import('@ai-sdk/openai');

    getLLMModel({ modelId: 'MiniMax-M2.7-highspeed' });

    const providerFn = (createOpenAI as any).mock.results[0].value;
    expect(providerFn).toHaveBeenCalledWith('MiniMax-M2.7-highspeed');
  });

  it('uses custom modelId when provided for xai', async () => {
    delete process.env.LLM_PROVIDER;
    const { getLLMModel } = await import('../lib/llm-provider');
    const { xai } = await import('@ai-sdk/xai');

    getLLMModel({ modelId: 'grok-3' });

    expect(xai).toHaveBeenCalledWith('grok-3');
  });
});
