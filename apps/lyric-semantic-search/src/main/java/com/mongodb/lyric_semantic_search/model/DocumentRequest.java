package com.mongodb.lyric_semantic_search.model;

import java.util.Map;

public class DocumentRequest {

    private String content;
    private Map<String, Object> metadata;

    public DocumentRequest() {
    }

    public DocumentRequest(String content, Map<String, Object> metadata) {
        this.content = content;
        this.metadata = metadata;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public Map<String, Object> getMetadata() {
        return metadata;
    }

    public void setMetadata(Map<String, Object> metadata) {
        this.metadata = metadata;
    }
}
