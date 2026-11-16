"""Ask questions about the MongoDB docs from the command line.

Needs MONGODB_URI and OPENROUTER_API_KEY in .env. Run: python ask.py
"""

import asyncio
import logging

import pymongo
from config import REQUEST_TIMEOUT_S, SEARCH_TIMEOUT_S, TOP_N, mongo_client
from generate import generate
from rerank import rerank
from retrieval import search

logger = logging.getLogger(__name__)


def log_result(sources: list[dict], answer: str | None = None) -> None:
    """Log the answer, if there is one, and each source page once."""
    if answer:
        logger.info("\n%s\n", answer)
    # Several chunks can come from the same page, so list each page once.
    pages = {source["url"]: source["title"] for source in sources}
    for url, title in pages.items():
        logger.info("- %s - %s", title, url)


def to_sources(chunks: list[dict]) -> list[dict]:
    """Keep the title and URL of each chunk."""
    return [{"title": chunk["title"], "url": chunk["url"]} for chunk in chunks]


async def answer_question(question: str) -> None:
    """Answer a question, falling back to the most relevant docs on failure."""
    sources = []
    try:
        # One deadline for the whole question. Docs found before it passes are still shown.
        async with asyncio.timeout(REQUEST_TIMEOUT_S):
            chunks, retrieval_method = await search(question)
            if not chunks:
                logger.info("No matching docs found.")
                return
            logger.info("Retrieved with %s", retrieval_method)
            sources = to_sources(chunks[:TOP_N])

            top_chunks, rerank_status = await rerank(question, chunks)
            sources = to_sources(top_chunks)
            logger.info(rerank_status.capitalize())

            result, model = await generate(question, top_chunks)
    except Exception as error:
        logger.warning("Couldn't answer: %s: %s", type(error).__name__, error)
        if not sources:
            logger.error("Search is unavailable right now.")
            return
        logger.warning("These docs look most relevant:")
        log_result(sources)
        return

    if not result["citations"]:
        logger.info("I couldn't find an answer to that in the docs.")
        return

    logger.info("Answered by %s", model)
    cited = [sources[i - 1] for i in result["citations"]]
    log_result(cited, result["answer"])


async def check_connection() -> bool:
    """Check that Atlas is reachable, so a setup mistake isn't mistaken for an outage."""
    try:
        with pymongo.timeout(SEARCH_TIMEOUT_S):
            await mongo_client.admin.command("ping")
    except Exception as error:
        logger.error(
            "Couldn't connect to MongoDB Atlas (%s). Check MONGODB_URI, and that your "
            "IP address is allowed under Network Access in Atlas.",
            type(error).__name__,
        )
        return False
    return True


async def main() -> None:
    """Answer questions from the command line until the user quits."""
    # Libraries log at WARNING and above; this script also logs INFO messages.
    logging.basicConfig(format="%(levelname)s: %(message)s")
    logger.setLevel(logging.INFO)
    if not await check_connection():
        return
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
