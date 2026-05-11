import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock @ai-sdk/openai
vi.mock('@ai-sdk/openai', () => {
  const mockModel = { modelId: 'mock-model', provider: 'mock-provider' };
  const mockProviderFn = vi.fn().mockReturnValue(mockModel);
  return {
    createOpenAI: vi.fn().mockReturnValue(mockProviderFn),
  };
});

describe('getLLMModel', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('defaults to openai provider when LLM_PROVIDER is not set', async () => {
    delete process.env.LLM_PROVIDER;
    const { getLLMModel } = await import('../utils/llm-provider');
    const { createOpenAI } = await import('@ai-sdk/openai');

    const model = getLLMModel();

    expect(model).toBeDefined();
    // Should call createOpenAI with OpenAI config (no custom baseURL)
    expect(createOpenAI).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: undefined,
      })
    );
  });

  it('uses openai provider when LLM_PROVIDER is "openai"', async () => {
    process.env.LLM_PROVIDER = 'openai';
    const { getLLMModel } = await import('../utils/llm-provider');
    const { createOpenAI } = await import('@ai-sdk/openai');

    getLLMModel();

    expect(createOpenAI).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: undefined,
      })
    );
  });

  it('uses minimax provider when LLM_PROVIDER is "minimax"', async () => {
    process.env.LLM_PROVIDER = 'minimax';
    process.env.MINIMAX_API_KEY = 'test-minimax-key';
    const { getLLMModel } = await import('../utils/llm-provider');
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
    const { getLLMModel } = await import('../utils/llm-provider');
    const { createOpenAI } = await import('@ai-sdk/openai');

    getLLMModel();

    expect(createOpenAI).toHaveBeenCalledWith(
      expect.objectContaining({
        baseURL: 'https://api.minimaxi.com/v1',
        apiKey: 'test-key',
      })
    );
  });

  it('uses custom modelId when provided for minimax', async () => {
    process.env.LLM_PROVIDER = 'minimax';
    process.env.MINIMAX_API_KEY = 'test-key';
    const { getLLMModel } = await import('../utils/llm-provider');
    const { createOpenAI } = await import('@ai-sdk/openai');

    getLLMModel({ modelId: 'MiniMax-M2.7-highspeed' });

    const providerFn = (createOpenAI as any).mock.results[0].value;
    expect(providerFn).toHaveBeenCalledWith('MiniMax-M2.7-highspeed');
  });

  it('uses default MiniMax-M2.7 model when no modelId for minimax', async () => {
    process.env.LLM_PROVIDER = 'minimax';
    process.env.MINIMAX_API_KEY = 'test-key';
    const { getLLMModel } = await import('../utils/llm-provider');
    const { createOpenAI } = await import('@ai-sdk/openai');

    getLLMModel();

    const providerFn = (createOpenAI as any).mock.results[0].value;
    expect(providerFn).toHaveBeenCalledWith('MiniMax-M2.7');
  });

  it('uses default o3-mini model for openai provider', async () => {
    delete process.env.LLM_PROVIDER;
    const { getLLMModel } = await import('../utils/llm-provider');
    const { createOpenAI } = await import('@ai-sdk/openai');

    getLLMModel();

    const providerFn = (createOpenAI as any).mock.results[0].value;
    expect(providerFn).toHaveBeenCalledWith('o3-mini', { structuredOutputs: true });
  });

  it('passes structuredOutputs only for openai provider', async () => {
    process.env.LLM_PROVIDER = 'minimax';
    process.env.MINIMAX_API_KEY = 'test-key';
    const { getLLMModel } = await import('../utils/llm-provider');
    const { createOpenAI } = await import('@ai-sdk/openai');

    // Clear mock call history before this specific test
    const providerFn = (createOpenAI as any).mock.results[0].value;
    providerFn.mockClear();

    getLLMModel();

    // MiniMax should be called with just the model name, no structuredOutputs
    expect(providerFn).toHaveBeenCalledWith('MiniMax-M2.7');
    expect(providerFn).toHaveBeenCalledTimes(1);
  });
});
