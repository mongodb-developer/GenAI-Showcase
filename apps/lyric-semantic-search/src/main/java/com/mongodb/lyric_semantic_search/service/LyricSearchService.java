package com.mongodb.lyric_semantic_search.service;

import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

import org.springframework.ai.document.Document;
import org.springframework.ai.vectorstore.SearchRequest;
import org.springframework.ai.vectorstore.filter.Filter.Expression;
import org.springframework.ai.vectorstore.filter.FilterExpressionBuilder;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.mongodb.lyric_semantic_search.model.DocumentRequest;
import com.mongodb.lyric_semantic_search.repository.LyricSearchRepository;

/**
 * Service class for handling lyric search operations.
 */
@Service
public class LyricSearchService {

    private static final int MAX_TOKENS = (int) (8192 * 0.80); // OpenAI model's maximum content length + BUFFER for when one word > 1 token

    @Autowired
    private LyricSearchRepository lyricSearchRepository;

    /**
     * Adds validated documents to the repository after filtering out null or excessively long documents.
     *
     * @param documents List of document requests to be added
     * @return List of documents that were successfully added
     */
    public List<Document> addDocuments(List<DocumentRequest> documents) {
        if (documents == null || documents.isEmpty()) {
            return Collections.emptyList();
        }

        List<Document> docs = documents.stream()
            .filter(doc -> doc != null && doc.getContent() != null && !doc.getContent()
                .trim()
                .isEmpty())
            .map(doc -> new Document(doc.getContent(), doc.getMetadata()))
            .filter(doc -> {
                int wordCount = doc.getContent()
                    .split("\\s+").length;
                return wordCount <= MAX_TOKENS;
            })
            .collect(Collectors.toList());

        if (!docs.isEmpty()) {
            lyricSearchRepository.addDocuments(docs);
        }

        return docs;
    }

    /**
     * Deletes documents from the repository based on the provided document IDs.
     *
     * @param ids List of document IDs to be deleted
     * @return List of successfully deleted document IDs, or an empty list if deletion was unsuccessful
     */
    public List<String> deleteDocuments(List<String> ids) {
        if (ids == null || ids.isEmpty()) {
            return Collections.emptyList(); // Nothing to delete
        }

        Optional<Boolean> result = lyricSearchRepository.deleteDocuments(ids);
        if (result.isPresent() && result.get()) {
            return ids; // Return the list of successfully deleted IDs
        } else {
            return Collections.emptyList(); // Return empty list if deletion was unsuccessful
        }
    }

    /**
     * Performs a semantic search on documents based on the given query, with specified top results and similarity threshold.
     *
     * @param query The search query
     * @param topK The number of top results to return
     * @param similarityThreshold The minimum similarity score for results to be included
     * @return List of search results containing document content and metadata
     */
    public List<Map<String, Object>> searchDocuments(String query, int topK, double similarityThreshold) {
        SearchRequest searchRequest = SearchRequest.query(query)
            .withTopK(topK)
            .withSimilarityThreshold(similarityThreshold);

        List<Document> results = lyricSearchRepository.semanticSearchByLyrics(searchRequest);

        return results.stream()
            .map(doc -> Map.of("content", doc.getContent(), "metadata", doc.getMetadata()))
            .collect(Collectors.toList());
    }

    /**
     * Searches documents using a metadata filter, such as filtering by artist, alongside the given query.
     *
     * @param query The search query
     * @param topK The number of top results to return
     * @param similarityThreshold The minimum similarity score for results to be included
     * @param artist The artist to filter results by
     * @return List of filtered search results containing document content and metadata
     */
    public List<Map<String, Object>> searchDocumentsWithFilter(String query, int topK, double similarityThreshold, String artist) {
        FilterExpressionBuilder filterBuilder = new FilterExpressionBuilder();
        Expression filterExpression = filterBuilder.eq("artist", artist)
            .build();

        SearchRequest searchRequest = SearchRequest.query(query)
            .withTopK(topK)
            .withSimilarityThreshold(similarityThreshold)
            .withFilterExpression(filterExpression);

        List<Document> results = lyricSearchRepository.semanticSearchByLyrics(searchRequest);

        return results.stream()
            .map(doc -> Map.of("content", doc.getContent(), "metadata", doc.getMetadata()))
            .collect(Collectors.toList());
    }

    /**
     * Gets the status of the application.
     *
     * @return The application status
     */
    public String getStatus() {
        return "Application is running!";
    }
}
