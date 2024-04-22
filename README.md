# Generative AI Use Cases Repository

## Introduction
Welcome to the Generative AI Use Cases Repository! This repository is dedicated to showcasing a wide range of applications in generative AI, including Retrieval-Augmented Generation (RAG), AI Agents, and industry-specific use cases. It also provides practical notebooks and guidance on utilizing frameworks such as LlamaIndex and LangChain, and demonstrates how to integrate models from leading AI research companies like Anthropic and OpenAI.

## Table of Contents
- [Introduction](#introduction)
- [Getting Started](#getting-started)
- [Use Cases](#use-cases)
  - [RAG](#rag)
- [Notebooks](#notebooks)
  - [Evaluations](#evaluations)
  - [RAG](#rag)
  - [Agents](#agents)
- [Tools](#tools)
- [Frameworks and Models](#frameworks-and-models)
- [Contributing](#contributing)
- [License](#license)
- [Contact](#contact)

## Use Cases
(Coming soon)

## Evaluations
- [Evaluating your LLM applications](https://github.com/mongodb-developer/GenAI-Showcase/blob/main/notebooks/evals/ragas-evaluation.ipynb)
- [Angle Embeddings Evaluation](/notebooks/evals/angle-embeddings-eval.ipynb)
- [OpenAI Embeddings Evaluation](/notebooks/evals/openai-embeddings-eval.ipynb)
- [VoyageAI Embeddings Evaluation](/notebooks/evals/voyageai-embeddings-eval.ipynb)


## RAG Notebooks
| Title                                             | Stack            | Colab                                                                                                                                                                                            | Article |
|---------------------------------------------------|------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|---------|
| RAG with Llama3, Hugging Face and MongoDB         | Hugging Face, Llama3, MongoDB              | [![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/mongodb-developer/GenAI-Showcase/blob/main/notebooks/rag/rag_mongodb_llama3_huggingface_open_source.ipynb) |  |
| How to Build a RAG System Using Claude 3 Opus and MongoDB                       | MongoDB, Anthropic, Python              | [![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/mongodb-developer/GenAI-Showcase/blob/main/notebooks/rag/anthropic_mongodb_pam_ai_stack.ipynb)       |   [![View Article](https://img.shields.io/badge/View%20Article-blue)](https://www.mongodb.com/developer/products/atlas/rag_with_claude_opus_mongodb/)      |
| How to Build a RAG System with the POLM AI Stack                                    | POLM (Python, OpenAI, LlamaIndex, MongoDB)              | [![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/mongodb-developer/GenAI-Showcase/blob/main/notebooks/rag/building_RAG_with_LlamaIndex_and_MongoDB_Vector_Database.ipynb) | [![View Article](https://img.shields.io/badge/View%20Article-blue)](#) |
| MongoDB LangChain Cache Memory Python Example     | POLM (Python, OpenAI, LangChain, MongoDB)              | [![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/mongodb-developer/GenAI-Showcase/blob/main/notebooks/rag/mongodb-langchain-cache-memory.ipynb)      | [![View Article](https://img.shields.io/badge/View%20Article-blue)](https://www.mongodb.com/developer/products/atlas/advanced-rag-langchain-mongodb/) |
| MongoDB LangChain Cache Memory JavaScript Example | JavaScript, OpenAI, LangChain, MongoDB              | [![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/mongodb-developer/GenAI-Showcase/blob/main/notebooks/rag/mongodb-langchain-cache-memory-javascript.ipynb) | [![View Article](https://img.shields.io/badge/View%20Article-blue)](https://www.mongodb.com/developer/products/atlas/add-memory-to-javascript-rag-application-mongodb-langchain/) |
| Naive RAG Implementation Example                  | POLM (Python, OpenAI, LlamaIndex, MongoDB)                | [![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/mongodb-developer/GenAI-Showcase/blob/main/notebooks/rag/naive_rag_implementation_llamaindex.ipynb)  | [![View Article](https://img.shields.io/badge/View%20Article-blue)](https://www.mongodb.com/developer/products/atlas/rag-with-polm-stack-llamaindex-openai-mongodb/) |
| OpenAI Text Embedding Example                     | Python, MongoDB, OpenAI              | [![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/mongodb-developer/GenAI-Showcase/blob/main/notebooks/rag/openai_text_3_embedding.ipynb)             | [![View Article](https://img.shields.io/badge/View%20Article-blue)](https://www.mongodb.com/developer/products/atlas/using-openai-latest-embeddings-rag-system-mongodb/) |
| RAG with Hugging Face and MongoDB Example         | Hugging Face, Gemma, MongoDB              | [![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/mongodb-developer/GenAI-Showcase/blob/main/notebooks/rag/rag_with_hugging_face_gemma_mongodb.ipynb) | [![View Article](https://img.shields.io/badge/View%20Article-blue)](https://www.mongodb.com/developer/products/atlas/gemma-mongodb-huggingface-rag) |


## Agents
An agent is an artificial computational entity with an awareness of its environment. It is equipped with faculties that enable perception through input, action through tool use, and cognitive abilities through foundation models backed by long-term and short-term memory. Within AI, agents are artificial entities that can make intelligent decisions followed by actions based on environmental perception, enabled by large language models.

| Title                          | Stack                | Colab Link                                     | Article Link                                     |
|--------------------------------|----------------------|------------------------------------------------|--------------------------------------------------|
| AI Research Assistant   | FireWorks AI, MongoDB, LangChain      |[![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/mongodb-developer/GenAI-Showcase/blob/main/notebooks/agents/agent_fireworks_ai_langchain_mongodb.ipynb) |      |


## Tools
Useful tools and utilities for working with generative AI models:
- [Embeddings Generator](/tools/embeddings_generator): A set of scripts for generating and manipulating embeddings.

## Datasets
Below are various datasets with embeddings for use in LLM application POCs and demos. All datasets can be accessed and downloaded from their respective Hugging Face pages.


| Dataset Name                                      | Description | Link |
| ------------------------------------------------- | ----------- | ---- |
| Cosmopedia             | Chunked version of a subset of the data Cosmopedia dataset | [![View Dataset](https://img.shields.io/badge/View%20Dataset-8A2BE2)](https://huggingface.co/datasets/MongoDB/subset_arxiv_papers_with_embeddings)  |
| Movies                           | Western, Action, and Fantasy movies, including title, release year, cast, and OpenAI embeddings for vector search. | [![View Dataset](https://img.shields.io/badge/View%20Dataset-8A2BE2)](https://huggingface.co/datasets/MongoDB/embedded_movies)  |
| Airbnb                         | AirBnB listings dataset with property descriptions, reviews, metadata and embeddings. | [![View Dataset](https://img.shields.io/badge/View%20Dataset-8A2BE2)](https://huggingface.co/datasets/MongoDB/airbnb_embeddings)  |
| Tech News                      | Tech news articles from 2022 and 2023 on valuable tech companies. | [![View Dataset](https://img.shields.io/badge/View%20Dataset-8A2BE2)](https://huggingface.co/datasets/MongoDB/tech-news-embeddings)  |
| Restaurant                  | Restaurant dataset with location, cuisine, ratings, attributes for industry analysis, recommendations, geographical studies.  | [![View Dataset](https://img.shields.io/badge/View%20Dataset-8A2BE2)](https://huggingface.co/datasets/MongoDB/whatscooking.restaurants)  |



## Frameworks and Models
Explore the utilization of various AI models and frameworks across different notebooks provided.

## Contributing
We welcome contributions! Please read our [Contribution Guidelines](CONTRIBUTING.md) for more information on how to participate.

## License
This project is licensed under the [MIT License](LICENSE).

## Contact
Feel free to reach out for any queries or suggestions:
- Email: richmond.alake@mongodb.com
