import json

import voyageai

# Using our API key.
vo = voyageai.Client()

with open("guinness_wine_dublin_cleaned.json") as f:
    data = json.load(f)

# Focusing on "reviews" field since that's what we are embedding.
reviews_list = [place.get("reviews", "") for place in data.get("places", [])]

# Getting embeddings for the reviews using "voyage-3-lite".
result = vo.embed(reviews_list, model="voyage-3-lite", input_type="document")

# New field to hold the embeddings.
for place, embedding in zip(data.get("places", []), result.embeddings):
    place["embedding"] = embedding

# Writing embeddings back to a new file.
with open("embedded_guinness_wine_dublin_cleaned2.json", "w") as f:
    json.dump(data, f, indent=2)
