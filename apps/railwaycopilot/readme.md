# Railway Operations & Safety Procedures Assistant

This is a RAG application which ingests the following sources : 

- TS1 – General signalling regulations, Issue 18 (in force 07 Dec 2024) – PDF. from tectraining.co.uk
- HB10 – Duties of the COSS and person in charge when using a hand trolley (Issue 5, Sept 2023) – PDF from consultations.rssb.co.uk
- “Rules on walking on or near the line” (overview page, new rules from 07 Dec 2024) – pdf article from rssb.co.uk
- RSSB standards Updates from September 2024 from rssb.co.uk

Once up and running, you can ask the chatbot questions like : 
- What should a signaller do when going off-duty
- What should a driver do if a signal is defective?

# Stack

- Mistral’s Embeddings API (mistral-embed) and Chat Completions (mistral-small-latest).
- Langchain
- MongoDB Atlas as Vector Databse

# Build 
Create an .env file at the root of the folder, with the following configuration: 

MISTRAL_API_KEY=""
MISTRAL_CHAT_MODEL=mistral-small-latest     
MISTRAL_EMBED_MODEL=mistral-embed
MONGODB_URI=""

```sh
docker compose up --build -d

#Chunk the source data, embed the chunks, store and index them in MongoDB : 
docker compose exec rag_app python ingest_rulebook.py

#Open the app
open http://localhost:8501

#Rebuilt after a change
docker compose build rag_app
docker compose up -d
```

# Features

- Change the prompt structure :
  - Start with the preset text (base_prompt).
  - For each ticked checkbox, append an extra line of instructions.
  - Append any free-text “Extra instructions”.
  - Note: some presets already mention bullets / structure / refusal. The checkboxes can add additional lines that reinforce or duplicate that behavior. This is fine, the model just sees stronger guidance.
- Visualize the used prompt
- A/B Test different prompts :
  - Prompt A is your defined prompt 
  - Prompt B uses the same base preset but forces : citations, bullet + structured format, and 'Refuse if not in context'.”
- Change Temperature (how deterministic vs creative the model can be)
- Change Max Tokens (how long the model's response can be)
- Define Top-K Chunks (how many document chunks your retriever returns for the LLM to use as context)
- Add extra instructions
- Use Few Shots inference (add your own example Q&A for the model to understand what it needs to do)
- Visualize a classification of the intent behind the question asked : informational, procedural, compliance, safety_critical, other
- Show Debug (see retrieved documents)


# Going further - potential improvements

- Make the app agentic, leveraging function calling (calling 911, triggering OCR if the input is a picture of the problem)
- Tune the chunking and data preparation
- Incident classification and analytics
- hybrid search



