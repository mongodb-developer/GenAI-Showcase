package com.mongodb.lyric_semantic_search.config;

import org.springframework.ai.embedding.EmbeddingModel;
import org.springframework.ai.openai.OpenAiEmbeddingModel;
import org.springframework.ai.openai.api.OpenAiApi;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
@SpringBootConfiguration
@EnableAutoConfiguration
public class Config {

    @Value("${spring.ai.openai.api-key}")
    private String openAiKey;

    @Bean
    public EmbeddingModel embeddingModel() {
        return new OpenAiEmbeddingModel(new OpenAiApi(openAiKey));
    }
}
