from typing import AsyncIterator
from starlette.websockets import WebSocket


async def websocket_stream(websocket: WebSocket) -> AsyncIterator[str]:
    while True:
        data = await websocket.receive_text()
        yield data
