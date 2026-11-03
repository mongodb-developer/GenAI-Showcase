"""Ask questions about the MongoDB docs from the command line.

Needs MONGODB_URI and OPENROUTER_API_KEY in .env. Run: python ask.py
"""

import asyncio
import logging

from generate import generate
from pymongo.errors import PyMongoError
from rerank import rerank
from retrieval import search

logger = logging.getLogger(__name__)


def log_result(sources: list[dict], answer: str | None = None) -> None:
    if answer:
        logger.info("\n%s\n", answer)
    # Several chunks can come from the same page, so list each page once.
    pages = {source["url"]: source["title"] for source in sources}
    for url, title in pages.items():
        logger.info("- %s - %s", title, url)


async def answer_question(question: str) -> None:
    try:
        chunks, retrieval_method = await search(question)
    except PyMongoError as error:
        logger.error("Search is unavailable right now: %s", error)
        return
    if not chunks:
        logger.info("No matching docs found.")
        return
    logger.info("Retrieved with %s", retrieval_method)

    top_chunks, rerank_status = await rerank(question, chunks)
    sources = [{"title": chunk["title"], "url": chunk["url"]} for chunk in top_chunks]
    logger.info(rerank_status.capitalize())

    try:
        result, model = await generate(question, top_chunks)
    except Exception as error:
        logger.warning("Answer generation failed: %s: %s", type(error).__name__, error)
        logger.warning("No answer available. These docs look most relevant:")
        log_result(sources)
        return

    logger.info("Answered by %s", model)
    cited = [sources[i - 1] for i in result["citations"]]
    log_result(cited, result["answer"])


async def main() -> None:
    # Libraries log at WARNING and above; this script also logs INFO messages.
    logging.basicConfig(format="%(levelname)s: %(message)s")
    logger.setLevel(logging.INFO)
    logger.info("Ask a question about MongoDB (Ctrl-C to quit).")
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
