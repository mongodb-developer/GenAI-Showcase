"""Ask questions about the MongoDB docs from the command line.

Needs MONGODB_URI and OPENROUTER_API_KEY in .env. Run: python ask.py
"""

import asyncio
import logging

from generate import generate
from pymongo.errors import PyMongoError
from rerank import rerank
from retrieval import search


def print_result(sources: list[dict], answer: str | None = None) -> None:
    if answer:
        print(f"\n{answer}\n")
    for i, source in enumerate(sources, start=1):
        print(f"[{i}] {source['title']} - {source['url']}")


async def answer_question(question: str) -> None:
    try:
        chunks, retrieval_method = await search(question)
    except PyMongoError as error:
        print(f"Search is unavailable right now: {error}")
        return
    if not chunks:
        print("No matching docs found.")
        return
    print(f"Retrieved with {retrieval_method}")

    top_chunks, rerank_status = await rerank(question, chunks)
    sources = [{"title": chunk["title"], "url": chunk["url"]} for chunk in top_chunks]
    print(rerank_status.capitalize())

    try:
        answer, model = await generate(question, top_chunks)
    except Exception as error:
        logging.warning("Answer generation failed: %s", error)
        print("No answer available. These docs look most relevant:")
        print_result(sources)
        return

    print(f"Answered by {model}")
    print_result(sources, answer)


async def main() -> None:
    logging.basicConfig(format="  ! %(message)s")
    print("Ask a question about MongoDB (Ctrl-C to quit).")
    while True:
        try:
            question = (await asyncio.to_thread(input, "\n> ")).strip()
        except EOFError:
            break
        if question:
            await answer_question(question)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
