from typing import List, Optional

from pydantic import PrivateAttr
from pymongo.collection import Collection
from langchain_mistralai import MistralAIEmbeddings
from langchain_core.retrievers import BaseRetriever
from langchain_core.callbacks import CallbackManagerForRetrieverRun
from langchain.docstore.document import Document
from langchain_community.vectorstores import MongoDBAtlasVectorSearch

from rail_rag.config import (
    TEXT_KEY,
    VEC_KEY,
    SRC_KEY,
    PAGE_KEY,
    VECTOR_INDEX_NAME,
)


class MongoAtlasRetriever(BaseRetriever):

    # Public, validated field
    k: int = 4

    # Private attrs 
    _collection: Collection = PrivateAttr()
    _embedder: MistralAIEmbeddings = PrivateAttr()
    _vectorstore: MongoDBAtlasVectorSearch = PrivateAttr()

    class Config:
        arbitrary_types_allowed = True
        underscore_attrs_are_private = True

    def __init__(
        self,
        collection: Collection,
        embedder: MistralAIEmbeddings,
        k: int = 4,
        index_name: str = VECTOR_INDEX_NAME,
        **data,
    ):
        super().__init__(k=k, **data)
        object.__setattr__(self, "_collection", collection)
        object.__setattr__(self, "_embedder", embedder)

        # LangChain vector store that wraps Atlas Vector Search
        vs = MongoDBAtlasVectorSearch(
            collection=collection,
            embedding=embedder,
            index_name=index_name,
            text_key=TEXT_KEY,
            embedding_key=VEC_KEY,
        )
        object.__setattr__(self, "_vectorstore", vs)

    def __repr__(self) -> str:
        return f"<MongoAtlasRetriever k={self.k}>"

    def __getstate__(self):
        return {"k": self.k}

    def _get_relevant_documents(
        self,
        query: str,
        *,
        run_manager: Optional[CallbackManagerForRetrieverRun] = None,
    ) -> List[Document]:
        """
        Use MongoDB Atlas Vector Search via LangChain's MongoDBAtlasVectorSearch.
        """
        docs = self._vectorstore.similarity_search(query, k=self.k)

        # Ensure important metadata keys exist 
        for d in docs:
            md = d.metadata or {}
            md.setdefault("source", md.get(SRC_KEY))
            md.setdefault("page", md.get(PAGE_KEY))
            d.metadata = md

        return docs
