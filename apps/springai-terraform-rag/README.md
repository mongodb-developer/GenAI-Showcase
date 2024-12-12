# MongoDB Atlas + Terraform Spring Boot RAG Application

This repository demonstrates how to build a **Retrieval-Augmented Generation (RAG)** application using **Spring Boot**, **OpenAI embeddings**, and **MongoDB Atlas Vector Search**. The infrastructure is automated using **Terraform** to provision and manage MongoDB Atlas resources.

## Overview

In this project, we:
- Set up a **MongoDB Atlas** cluster and configure **vector search** using **Terraform**.
- Build a **Spring Boot** app that generates embeddings with **OpenAI**, performs vector search on MongoDB Atlas, and handles **Retrieval-Augmented Generation (RAG)**.
- Automate infrastructure provisioning using **HashiCorp Terraform**.

## Features
- **Automated Infrastructure**: Terraform is used to provision MongoDB Atlas resources including clusters, vector search indices, and access controls.
- **RAG Implementation**: A Spring Boot application that uses OpenAI to generate embeddings, with MongoDB Atlas vector search to perform semantic searches.
- **Document Loading**: Upload documents and store their embeddings for use in vector search.
- **Querying with Vector Search**: Search documents by semantic similarity using a custom `/question` endpoint.

## Prerequisites
To run this project, you'll need:
- Java 21 or higher
- Maven (or Gradle)
- MongoDB Atlas account (with billing configured)
- OpenAI API key
- Terraform installed on your system

## Quickstart

### 1. Clone the repositories

1. Clone this repository for the Terraform setup:
    ```bash
    git clone https://github.com/your-username/mongodb-atlas-rag.git
    cd mongodb-atlas-rag
    ```

2. Clone the **Spring Boot** application repository:
    ```bash
    git clone https://github.com/mongodb-developer/Spring-AI-Rag.git
    cd Spring-AI-Rag
    ```

### 2. Set up MongoDB Atlas with Terraform

1. Create a `main.tf` and `variables.tf` as shown in the tutorial.
2. Add environment variables for your MongoDB Atlas credentials:
    ```bash
    export TF_VAR_atlas_org_id="your_atlas_org_id"
    export TF_VAR_public_key="your_public_key"
    export TF_VAR_private_key="your_private_key"
    export TF_VAR_db_username="your_db_username"
    export TF_VAR_db_password="your_db_password"
    export TF_VAR_ip_address="your_ip_address"
    ```
3. Initialize and apply Terraform:
    ```bash
    terraform init
    terraform apply
    ```

### 3. Configure the Spring Boot Application

1. Add your **MongoDB Atlas URI** and **OpenAI API Key** in the `application.properties` file:
    ```properties
    spring.data.mongodb.uri=your_mongodb_uri
    spring.ai.openai.api-key=your_openai_api_key
    ```

2. Build and run the Spring Boot app:
    ```bash
    mvn clean install
    ./mvnw spring-boot:run
    ```

### 4. Load Documents and Test Queries

- Load documents into the MongoDB vector store:
    ```bash
    curl http://localhost:8080/api/docs/load
    ```

- Query the documents using the `/question` endpoint:
    ```bash
    curl "http://localhost:8080/question?message=How%20to%20analyze%20time-series%20data%20with%20Python%20and%20MongoDB?"
    ```

## Technologies Used
- **Spring Boot**: Java-based framework for building REST APIs.
- **MongoDB Atlas**: An integrated suite of data services (including Atlas Vector Search) centered around a cloud database designed to accelerate and simplify how you build with data. Build faster and build smarter with a developer data platform that helps solve your data challenges. Click [here](https://www.mongodb.com/products/platform/atlas-database) to learn more. 
- **OpenAI**: Generates embeddings for semantic searches.
- **Terraform**: Automates infrastructure management for MongoDB Atlas.
