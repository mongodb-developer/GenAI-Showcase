"""Unit tests for advanced-rag/utils.py.

Run from the advanced-rag/ directory:  python -m pytest test_utils.py -v
These use in-memory fakes only -- no live Atlas, no network, no keys required.
"""

import pytest
import utils


# --------------------------------------------------------------------------
# get_secret: environment-first, getpass fallback (so Colab works)
# --------------------------------------------------------------------------
def test_get_secret_reads_from_env(monkeypatch):
    monkeypatch.setenv("MY_KEY", "from-env")
    assert utils.get_secret("MY_KEY") == "from-env"


def test_get_secret_prompts_when_missing(monkeypatch):
    monkeypatch.delenv("MY_KEY", raising=False)
    monkeypatch.setattr(utils.getpass, "getpass", lambda prompt="": "typed-in")
    assert utils.get_secret("MY_KEY") == "typed-in"


def test_get_secret_treats_blank_env_as_missing(monkeypatch):
    monkeypatch.setenv("MY_KEY", "   ")
    monkeypatch.setattr(utils.getpass, "getpass", lambda prompt="": "typed-in")
    assert utils.get_secret("MY_KEY") == "typed-in"


# --------------------------------------------------------------------------
# build_llm_kwargs: gateway vs direct Anthropic auth
# --------------------------------------------------------------------------
def test_build_llm_kwargs_direct_anthropic():
    kw = utils.build_llm_kwargs(
        api_key="sk-ant-xxx", model="claude-haiku-4-5", base_url=None, max_tokens=256
    )
    assert kw["model"] == "claude-haiku-4-5"
    assert kw["api_key"] == "sk-ant-xxx"
    assert kw["max_tokens"] == 256
    assert "base_url" not in kw
    assert "default_headers" not in kw


def test_build_llm_kwargs_gateway_strips_messages_path_and_sets_header():
    kw = utils.build_llm_kwargs(
        api_key="gw-key",
        model="claude-haiku-4-5",
        base_url="https://gw.example.net/foundry/anthropic/v1/messages",
        max_tokens=128,
    )
    # SDK appends /v1/messages itself, so the trailing path must be stripped.
    assert kw["base_url"] == "https://gw.example.net/foundry/anthropic"
    # Gateway authenticates via the "api-key" header, not x-api-key.
    assert kw["default_headers"]["api-key"] == "gw-key"
    assert kw["default_headers"]["anthropic-version"]


def test_build_llm_kwargs_gateway_never_sends_a_placeholder_x_api_key():
    # The SDK always turns api_key into an x-api-key header. A gateway that reads
    # x-api-key before api-key 401s on a placeholder there, so it must carry the
    # real key too.
    kw = utils.build_llm_kwargs(
        api_key="gw-key",
        model="m",
        base_url="https://gw.example.net/anthropic",
        max_tokens=1,
    )
    assert kw["api_key"] == "gw-key"


def test_build_llm_kwargs_gateway_root_url_untouched():
    kw = utils.build_llm_kwargs(
        api_key="gw-key",
        model="m",
        base_url="https://gw.example.net/anthropic",
        max_tokens=1,
    )
    assert kw["base_url"] == "https://gw.example.net/anthropic"


# --------------------------------------------------------------------------
# AtlasEmbeddings: LangChain Embeddings over ai.mongodb.com, with dim guard
# --------------------------------------------------------------------------
class FakePoster:
    """Stand-in for the HTTP POST seam. Records calls, returns canned vectors."""

    def __init__(self, dims=1024, status=200):
        self.dims = dims
        self.status = status
        self.calls = []

    def __call__(self, url, headers, json, timeout):
        self.calls.append({"url": url, "headers": headers, "json": json})
        n = len(json["input"])
        vecs = [[0.1] * self.dims for _ in range(n)]
        return _FakeResp(self.status, {"data": [{"embedding": v} for v in vecs]})


class _FakeResp:
    def __init__(self, status_code, payload):
        self.status_code = status_code
        self._payload = payload
        self.ok = 200 <= status_code < 300
        self.text = str(payload)

    def json(self):
        return self._payload


def test_embed_uses_single_model_for_both_by_default():
    # sample_mflix ships one model (voyage-3-large); queries must match it.
    poster = FakePoster(dims=2048)
    emb = utils.AtlasEmbeddings(
        api_key="k", model="voyage-3-large", dimensions=2048, poster=poster
    )
    emb.embed_documents(["a"])
    emb.embed_query("q")
    assert poster.calls[0]["json"]["model"] == "voyage-3-large"
    assert poster.calls[1]["json"]["model"] == "voyage-3-large"


def test_embed_documents_returns_vectors_and_uses_document_input_type():
    poster = FakePoster(dims=2048)
    emb = utils.AtlasEmbeddings(
        api_key="k", model="voyage-3-large", dimensions=2048, poster=poster
    )
    out = emb.embed_documents(["a", "b"])
    assert len(out) == 2 and len(out[0]) == 2048
    assert poster.calls[0]["json"]["input_type"] == "document"
    assert poster.calls[0]["json"]["output_dimension"] == 2048
    assert poster.calls[0]["headers"]["Authorization"] == "Bearer k"


def test_embed_query_uses_query_input_type():
    poster = FakePoster(dims=2048)
    emb = utils.AtlasEmbeddings(
        api_key="k", model="voyage-3-large", dimensions=2048, poster=poster
    )
    v = emb.embed_query("hello")
    assert len(v) == 2048
    assert poster.calls[0]["json"]["input_type"] == "query"


def test_embed_optional_asymmetric_query_model():
    poster = FakePoster(dims=1024)
    emb = utils.AtlasEmbeddings(
        api_key="k",
        model="voyage-4",
        query_model="voyage-4-lite",
        dimensions=1024,
        poster=poster,
    )
    emb.embed_documents(["a"])
    emb.embed_query("q")
    assert poster.calls[0]["json"]["model"] == "voyage-4"
    assert poster.calls[1]["json"]["model"] == "voyage-4-lite"


def test_embed_dimension_guard_raises_on_mismatch():
    poster = FakePoster(dims=512)  # server returns wrong size
    emb = utils.AtlasEmbeddings(
        api_key="k", model="voyage-3-large", dimensions=2048, poster=poster
    )
    with pytest.raises(utils.EmbeddingDimensionMismatch):
        emb.embed_query("hello")


def test_embed_raises_on_http_error():
    poster = FakePoster(status=401)
    emb = utils.AtlasEmbeddings(
        api_key="bad", model="voyage-3-large", dimensions=2048, poster=poster
    )
    with pytest.raises(RuntimeError):
        emb.embed_query("hello")


def test_embeddings_is_langchain_embeddings():
    from langchain_core.embeddings import Embeddings

    emb = utils.AtlasEmbeddings(
        api_key="k", model="voyage-3-large", poster=FakePoster()
    )
    assert isinstance(emb, Embeddings)


# --------------------------------------------------------------------------
# atlas_rerank: reorders documents by relevance
# --------------------------------------------------------------------------
class FakeRerankPoster:
    def __init__(self, order):
        self.order = order  # list of indices in ranked order
        self.calls = []

    def __call__(self, url, headers, json, timeout):
        self.calls.append({"url": url, "json": json})
        results = [
            {"index": i, "relevance_score": 1.0 - n * 0.1}
            for n, i in enumerate(self.order)
        ]
        return _FakeResp(200, {"data": results})


def test_atlas_rerank_reorders_by_relevance():
    docs = ["doc0", "doc1", "doc2"]
    poster = FakeRerankPoster(order=[2, 0, 1])
    ranked = utils.atlas_rerank("query", docs, api_key="k", top_n=2, poster=poster)
    assert ranked == ["doc2", "doc0"]
    assert poster.calls[0]["json"]["query"] == "query"


def test_atlas_rerank_default_top_n_returns_all():
    docs = ["doc0", "doc1", "doc2"]
    poster = FakeRerankPoster(order=[2, 0, 1])
    ranked = utils.atlas_rerank("query", docs, api_key="k", poster=poster)
    assert ranked == ["doc2", "doc0", "doc1"]
    # top_k defaults to the full document count when top_n is unset.
    assert poster.calls[0]["json"]["top_k"] == 3


def test_atlas_rerank_top_n_zero_is_not_treated_as_all():
    # A falsy-but-explicit top_n=0 must mean "zero", not "all documents".
    docs = ["doc0", "doc1", "doc2"]
    poster = FakeRerankPoster(order=[2, 0, 1])
    ranked = utils.atlas_rerank("query", docs, api_key="k", top_n=0, poster=poster)
    assert ranked == []
    assert poster.calls[0]["json"]["top_k"] == 0


# --------------------------------------------------------------------------
# The two guards that keep a notebook from damaging a reader's cluster.
# --------------------------------------------------------------------------
class FakeDb:
    """Minimal stand-in for a pymongo Database.

    `layout` maps collection name -> list of search index names.
    """

    def __init__(self, layout):
        self._layout = dict(layout)

    def list_collection_names(self):
        return list(self._layout)

    def __getitem__(self, name):
        indexes = self._layout.get(name, [])
        return FakeCollection(indexes)


class FakeCollection:
    def __init__(self, index_names):
        self._index_names = list(index_names)

    def list_search_indexes(self):
        return [{"name": n, "queryable": True} for n in self._index_names]


def test_list_all_search_indexes_reports_collection_and_index():
    db = FakeDb({"embedded_movies": ["movies_vector_index", "movies_fulltext_index"]})
    assert utils.list_all_search_indexes(db) == [
        ("embedded_movies", "movies_vector_index"),
        ("embedded_movies", "movies_fulltext_index"),
    ]


def test_list_all_search_indexes_skips_collections_it_cannot_introspect():
    # A view raises on list_search_indexes. That must not abort the whole count.
    class Exploding(FakeDb):
        def __getitem__(self, name):
            if name == "a_view":
                raise RuntimeError("cannot list indexes on a view")
            return super().__getitem__(name)

    db = Exploding({"a_view": [], "embedded_movies": ["movies_vector_index"]})
    assert utils.list_all_search_indexes(db) == [
        ("embedded_movies", "movies_vector_index")
    ]


def test_assert_room_for_index_allows_creation_below_the_limit():
    db = FakeDb({"embedded_movies": ["movies_vector_index", "movies_fulltext_index"]})
    utils.assert_room_for_index(db, "auto_vec")  # 2 of 3 -> fine


def test_assert_room_for_index_refuses_at_the_limit():
    db = FakeDb({"embedded_movies": ["a", "b"], "other": ["c"]})
    with pytest.raises(utils.SearchIndexBudgetExceeded) as excinfo:
        utils.assert_room_for_index(db, "auto_vec")
    message = str(excinfo.value)
    # The whole point: name what is using the slots and ask for a fresh cluster,
    # rather than silently freeing one.
    assert "auto_vec" in message
    assert "embedded_movies: a" in message
    assert "fresh Atlas cluster" in message
    assert "will not delete indexes it did not create" in message


def test_assert_room_for_index_honors_a_non_m0_limit():
    db = FakeDb({"embedded_movies": ["a", "b", "c"]})
    utils.assert_room_for_index(db, "auto_vec", limit=10)  # paid tier
    with pytest.raises(utils.SearchIndexBudgetExceeded) as excinfo:
        utils.assert_room_for_index(db, "auto_vec", limit=3)
    # The M0 wording only appears when the limit really is the M0 one.
    assert "free M0 tier" in str(excinfo.value)


def test_claim_scratch_collection_returns_the_name_when_absent():
    db = FakeDb({"embedded_movies": []})
    assert utils.claim_scratch_collection(db, "auto_embed_demo") == "auto_embed_demo"


def test_claim_scratch_collection_refuses_an_existing_collection():
    # The bug this prevents: an unconditional drop() of a collection name a reader
    # could plausibly already own, which would destroy their data.
    db = FakeDb({"auto_embed_demo": []})
    with pytest.raises(utils.ScratchCollectionExists) as excinfo:
        utils.claim_scratch_collection(db, "auto_embed_demo")
    message = str(excinfo.value)
    assert "will not reuse or overwrite one it did not create" in message
    assert "LANGCHAIN_AUTO_EMBED_COLLECTION" in message


def test_claim_scratch_collection_names_a_custom_env_var():
    db = FakeDb({"scratch": []})
    with pytest.raises(utils.ScratchCollectionExists) as excinfo:
        utils.claim_scratch_collection(db, "scratch", env_var="MY_OVERRIDE")
    assert "MY_OVERRIDE" in str(excinfo.value)


# --------------------------------------------------------------------------
# setting(): a tunable the .env omits must NOT come from the ambient shell.
# --------------------------------------------------------------------------
def test_setting_reads_a_declared_value_from_the_env_file(tmp_path, monkeypatch):
    env = tmp_path / ".env"
    env.write_text("ANTHROPIC_MODEL=claude-sonnet-5\n")
    monkeypatch.chdir(tmp_path)
    assert utils.setting("ANTHROPIC_MODEL", "claude-haiku-4-5") == "claude-sonnet-5"


def test_setting_ignores_the_shell_for_a_variable_the_env_omits(tmp_path, monkeypatch):
    # The bug this prevents, seen for real: a model id left in a shell from unrelated
    # work reached the gateway as DeploymentNotFound. load_dotenv only overlays the
    # variables the file declares, so os.getenv would have returned the shell's value.
    env = tmp_path / ".env"
    env.write_text("MONGODB_URI=mongodb+srv://h/\n")
    monkeypatch.chdir(tmp_path)
    monkeypatch.setenv("ANTHROPIC_MODEL", "global.anthropic.claude-opus-5")
    assert utils.setting("ANTHROPIC_MODEL", "claude-haiku-4-5") == "claude-haiku-4-5"


def test_setting_treats_a_declared_but_blank_value_as_absent(tmp_path, monkeypatch):
    env = tmp_path / ".env"
    env.write_text("ANTHROPIC_MODEL=\n")
    monkeypatch.chdir(tmp_path)
    assert utils.setting("ANTHROPIC_MODEL", "claude-haiku-4-5") == "claude-haiku-4-5"


def test_setting_falls_back_to_the_default_with_no_env_file(tmp_path, monkeypatch):
    # Colab has no .env at all. The default must still win over the shell.
    monkeypatch.chdir(tmp_path)
    monkeypatch.setenv("ANTHROPIC_MODEL", "from-the-shell")
    assert utils.setting("ANTHROPIC_MODEL", "claude-haiku-4-5") == "claude-haiku-4-5"
