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
- [Tools](#tools)
- [Frameworks and Models](#frameworks-and-models)
- [Contributing](#contributing)
- [License](#license)
- [Contact](#contact)

## Use Cases
### RAG
Details on Retrieval-Augmented Generation (RAG) and its applications.

### Evaluations
- [Angle Embeddings Evaluation](/notebooks/evals/angle-embeddings-eval.ipynb)
- [OpenAI Embeddings Evaluation](/notebooks/evals/openai-embeddings-eval.ipynb)
- [VoyageAI Embeddings Evaluation](/notebooks/evals/voyageai-embeddings-eval.ipynb)


### RAG Notebooks
| Title                                             | Stack            | Colab                                                                                                                                                                                            | Article |
|---------------------------------------------------|------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|---------|
| How to Build a RAG System Using Claude 3 Opus and MongoDB                       | MongoDB, Anthropic, Python              | [![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/mongodb-developer/GenAI-Showcase/blob/main/notebooks/rag/anthropic_mongodb_pam_ai_stack.ipynb)       |   [![View Article](https://img.shields.io/badge/View%20Article-blue)](https://www.mongodb.com/developer/products/atlas/rag_with_claude_opus_mongodb/)      |
| How to Build a RAG System with the POLM AI Stack                                    | POLM (Python, OpenAI, LlamaIndex, MongoDB)              | [![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/mongodb-developer/GenAI-Showcase/blob/main/notebooks/rag/building_RAG_with_LlamaIndex_and_MongoDB_Vector_Database.ipynb) | [![View Article](https://img.shields.io/badge/View%20Article-blue)](#) |
| MongoDB LangChain Cache Memory Python Example     | POLM (Python, OpenAI, LangChain, MongoDB)              | [![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/mongodb-developer/GenAI-Showcase/blob/main/notebooks/rag/mongodb-langchain-cache-memory.ipynb)      | [![View Article](https://img.shields.io/badge/View%20Article-blue)](https://www.mongodb.com/developer/products/atlas/advanced-rag-langchain-mongodb/) |
| MongoDB LangChain Cache Memory JavaScript Example | JavaScript, OpenAI, LangChain, MongoDB              | [![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/mongodb-developer/GenAI-Showcase/blob/main/notebooks/rag/mongodb-langchain-cache-memory-javascript.ipynb) | [![View Article](https://img.shields.io/badge/View%20Article-blue)](https://www.mongodb.com/developer/products/atlas/add-memory-to-javascript-rag-application-mongodb-langchain/) |
| Naive RAG Implementation Example                  | POLM (Python, OpenAI, LlamaIndex, MongoDB)                | [![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/mongodb-developer/GenAI-Showcase/blob/main/notebooks/rag/naive_rag_implementation_llamaindex.ipynb)  | [![View Article](https://img.shields.io/badge/View%20Article-blue)](https://www.mongodb.com/developer/products/atlas/rag-with-polm-stack-llamaindex-openai-mongodb/) |
| OpenAI Text Embedding Example                     | Python, MongoDB, OpenAI              | [![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/mongodb-developer/GenAI-Showcase/blob/main/notebooks/rag/openai_text_3_embedding.ipynb)             | [![View Article](https://img.shields.io/badge/View%20Article-blue)](https://www.mongodb.com/developer/products/atlas/using-openai-latest-embeddings-rag-system-mongodb/) |
| RAG with Hugging Face and MongoDB Example         | Hugging Face, Gemma, MongoDB              | [![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/mongodb-developer/GenAI-Showcase/blob/main/notebooks/rag/rag_with_hugging_face_gemma_mongodb.ipynb) | [![View Article](https://img.shields.io/badge/View%20Article-blue)](https://www.mongodb.com/developer/products/atlas/gemma-mongodb-huggingface-rag) |



## Tools
Useful tools and utilities for working with generative AI models:
- [Embeddings Generator](/tools/embeddings_generator): A set of scripts for generating and manipulating embeddings.

## Datasets
Below are various datasets with embeddings for use in LLM application POCs and demos. All datasets can be accessed and downloaded from their respective Hugging Face pages.


| Dataset Name                                      | Description | Link |
| ------------------------------------------------- | ----------- | ---- |
| MongoDB/cosmopedia-wikihow-chunked                | Chunked version of a subset of the data Cosmopedia dataset | [![View Dataset](https://img.shields.io/badge/View%20Dataset%20on%20🤗-8A2BE2)](https://huggingface.co/datasets/MongoDB/subset_arxiv_papers_with_embeddings)  |
| MongoDB/embedded_movies                           | The dataset lists Western, Action, and Fantasy movies, including title, release year, cast, and OpenAI embeddings for vector search. | [![View Dataset](https://img.shields.io/badge/View%20Dataset%20on%20🤗-8A2BE2)](https://huggingface.co/datasets/MongoDB/subset_arxiv_papers_with_embeddings)  |
| MongoDB/airbnb_embeddings                         | AirBnB listings dataset with property descriptions, reviews, metadata, text embeddings (1536D using OpenAI's text-embedding-3-small), and image embeddings (512D using OpenAI's clip-vit-base-patch32). | [![View Dataset](https://img.shields.io/badge/View%20Dataset%20on%20🤗-8A2BE2)](https://huggingface.co/datasets/MongoDB/subset_arxiv_papers_with_embeddings)  |
| MongoDB/tech-news-embeddings                      | HackerNoon's dataset includes over 7 million tech news articles from 2022 and 2023 on valuable tech companies, enriched with OpenAI's small text embeddings for 1,576,528 data points. | [![View Dataset](https://img.shields.io/badge/View%20Dataset%20on%20🤗-8A2BE2)](https://huggingface.co/datasets/MongoDB/subset_arxiv_papers_with_embeddings)  |
| MongoDB/whatscooking.restaurants                  | Restaurant dataset with location, cuisine, ratings, attributes for industry analysis, recommendations, geographical studies.  | [![View Dataset](https://img.shields.io/badge/View%20Dataset%20on%20🤗-8A2BE2)](https://huggingface.co/datasets/MongoDB/subset_arxiv_papers_with_embeddings)  |



## Frameworks and Models
Explore the utilization of various AI models and frameworks across different notebooks provided.

## Contributing
We welcome contributions! Please read our [Contribution Guidelines](CONTRIBUTING.md) for more information on how to participate.

## License
This project is licensed under the [MIT License](LICENSE).

## Contact
Feel free to reach out for any queries or suggestions:
- Email: richmond.alake@mongodb.com
