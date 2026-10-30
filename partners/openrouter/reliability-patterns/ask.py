"""Ask questions about the MongoDB docs from the command line.

Needs MONGODB_URI and OPENROUTER_API_KEY in .env. Run: python ask.py
"""

import asyncio
import logging

from generate import generate
from pymongo.errors import PyMongoError
from rerank import rerank
from retrieval import search


def log_result(sources: list[dict], answer: str | None = None) -> None:
    if answer:
        logging.info("\n%s\n", answer)
    for i, source in enumerate(sources, start=1):
        logging.info("[%d] %s - %s", i, source["title"], source["url"])


async def answer_question(question: str) -> None:
    try:
        chunks, retrieval_method = await search(question)
    except PyMongoError as error:
        logging.error("Search is unavailable right now: %s", error)
        return
    if not chunks:
        logging.info("No matching docs found.")
        return
    logging.info("Retrieved with %s", retrieval_method)

    top_chunks, rerank_status = await rerank(question, chunks)
    sources = [{"title": chunk["title"], "url": chunk["url"]} for chunk in top_chunks]
    logging.info(rerank_status.capitalize())

    try:
        answer, model = await generate(question, top_chunks)
    except Exception as error:
        logging.warning("Answer generation failed: %s", error)
        logging.warning("No answer available. These docs look most relevant:")
        log_result(sources)
        return

    logging.info("Answered by %s", model)
    log_result(sources, answer)


async def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
    # The OpenRouter SDK's HTTP client logs every request at INFO level.
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.info("Ask a question about MongoDB (Ctrl-C to quit).")
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
