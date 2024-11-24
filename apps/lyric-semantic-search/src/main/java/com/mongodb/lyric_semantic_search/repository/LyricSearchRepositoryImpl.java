package com.mongodb.lyric_semantic_search.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.ai.document.Document;
import org.springframework.ai.vectorstore.SearchRequest;
import org.springframework.ai.vectorstore.VectorStore;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Repository;

@Repository
public class LyricSearchRepositoryImpl implements LyricSearchRepository {

    private final VectorStore vectorStore;

    @Autowired
    public LyricSearchRepositoryImpl(VectorStore vectorStore) {
        this.vectorStore = vectorStore;
    }

    @Override
    public void addDocuments(List<Document> docs) {
        vectorStore.add(docs);
    }

    @Override
    public Optional<Boolean> deleteDocuments(List<String> ids) {
        return vectorStore.delete(ids);
    }

    @Override
    public List<Document> semanticSearchByLyrics(SearchRequest searchRequest) {
        return vectorStore.similaritySearch(searchRequest);
    }
}