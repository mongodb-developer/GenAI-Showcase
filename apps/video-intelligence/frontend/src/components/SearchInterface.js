import React, { useState } from 'react';
import { Search, Filter } from 'lucide-react';

const SearchInterface = ({ onSearch, isSearching, canSearch }) => {
  const [query, setQuery] = useState('');
  const [searchType, setSearchType] = useState('hybrid');
  const [showFilters, setShowFilters] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (query.trim() && canSearch) {
      onSearch(query.trim(), searchType);
    }
  };

  return (
    <div className="search-section">
      <div className="search-header">
        <form onSubmit={handleSubmit} className="search-container">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for scenes... (e.g., 'find frames with a person', 'outdoor scenes', 'blue objects')"
            className="search-input"
            disabled={!canSearch}
          />
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className="filter-button"
            disabled={!canSearch}
            title="Search options"
          >
            <Filter size={16} />
          </button>
          <button
            type="submit"
            disabled={!query.trim() || isSearching || !canSearch}
            className="search-button"
          >
            {isSearching ? (
              <>
                <div className="spinner" />
                Searching...
              </>
            ) : (
              <>
                <Search size={18} />
                Search
              </>
            )}
          </button>
        </form>
      </div>

      <div className={`search-filters ${showFilters ? 'expanded' : 'collapsed'}`}>
        <div className="search-filters-content">
          <div className="filter-group">
            <label className="filter-label">Search Type:</label>
            <div className="search-type-options">
              <button
                type="button"
                className={`search-type-button ${searchType === 'hybrid' ? 'active' : ''}`}
                onClick={() => setSearchType('hybrid')}
                disabled={!canSearch}
              >
                🔀 Hybrid
                <span className="search-type-description">Text + AI similarity</span>
              </button>
              <button
                type="button"
                className={`search-type-button ${searchType === 'semantic' ? 'active' : ''}`}
                onClick={() => setSearchType('semantic')}
                disabled={!canSearch}
              >
                🧠 Semantic
                <span className="search-type-description">AI similarity only</span>
              </button>
              <button
                type="button"
                className={`search-type-button ${searchType === 'text' ? 'active' : ''}`}
                onClick={() => setSearchType('text')}
                disabled={!canSearch}
              >
                📝 Text
                <span className="search-type-description">Keyword matching</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {!canSearch && (
        <div style={{
          textAlign: 'center',
          color: '#888',
          fontSize: '0.9rem',
          marginTop: '10px'
        }}>
          Upload and process a video first to start searching or load a previously uploaded video
        </div>
      )}
    </div>
  );
};

export default SearchInterface;
