import asyncio
import time
import json
import uuid
from typing import Dict, Any
from fastapi import APIRouter, HTTPException, BackgroundTasks
from sse_starlette.sse import EventSourceResponse

from models.generate import GenerateCompletionRequest
from chains.completion_chain import async_completion_graph
from chains.generate_stream import async_streaming_completion_graph, create_streaming_generator
from utils.logger import get_logger

completion_router = APIRouter()
logger = get_logger(__name__)

# Simple circuit breaker
class CircuitBreaker:
    def __init__(self, failure_threshold: int = 5, recovery_timeout: int = 60):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.failure_count = 0
        self.last_failure_time = None
        self.state = "CLOSED"  # CLOSED, OPEN, HALF_OPEN
    
    async def __aenter__(self):
        if self.state == "OPEN":
            if time.time() - self.last_failure_time > self.recovery_timeout:
                self.state = "HALF_OPEN"
            else:
                raise HTTPException(status_code=503, detail="Service temporarily unavailable")
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if exc_type is None:
            self.failure_count = 0
            self.state = "CLOSED"
        else:
            self.failure_count += 1
            self.last_failure_time = time.time()
            if self.failure_count >= self.failure_threshold:
                self.state = "OPEN"

circuit_breaker = CircuitBreaker()

async def prepare_state_from_request(request: GenerateCompletionRequest) -> Dict[str, Any]:
    """Convert request to state for the graph"""
    state = {
        "messages": [{"role": "user", "content": request.query}],
        "model": request.model,
        "persona": request.persona,
        "language": request.language or "en",
        "chat": request.chat if request.chat is not None else True,
        "think": request.think or False,
        "image": request.image,
        "file": request.file,
        "keepalive": request.keepalive,
        "request_id": str(uuid.uuid4()),
        "start_time": time.time()
    }
    
    return state

async def prepare_streaming_state(request: GenerateCompletionRequest) -> Dict[str, Any]:
    """Convert request to streaming state for the graph"""
    state = await prepare_state_from_request(request)
    state.update({
        "stream_queue": asyncio.Queue(),
        "token_count": 0,
        "is_streaming": True
    })
    
    return state

@completion_router.post("/")
async def generate_completion(
    request: GenerateCompletionRequest,
    background_tasks: BackgroundTasks
):
    """Non-streaming completion endpoint"""
    async with circuit_breaker:
        try:
            start_time = time.time()
            
            if request.stream:
                raise HTTPException(
                    status_code=400, 
                    detail="Use /generate/stream for streaming responses"
                )
            
            # Prepare state
            state = await prepare_state_from_request(request)
            
            # Execute completion
            try:
                timeout = 300  # 5 minutes default timeout
                result = await asyncio.wait_for(
                    async_completion_graph.ainvoke(state),
                    timeout=timeout
                )
            except asyncio.TimeoutError:
                logger.warning(f"Request {state['request_id']} timed out after {timeout}s")
                raise HTTPException(status_code=408, detail="Request timeout")
            
            # Extract response
            response_content = ""
            if result.get("response"):
                response_content = result["response"]
            elif result.get("messages"):
                last_message = result["messages"][-1]
                if hasattr(last_message, 'content'):
                    response_content = last_message.content
                elif isinstance(last_message, dict) and "content" in last_message:
                    response_content = last_message["content"]
            
            # Calculate timing
            total_duration = int((time.time() - start_time) * 1000)
            
            response = {
                "model": request.model,
                "response": response_content,
                "done": True,
                "total_duration": total_duration,
                "created_at": int(time.time())
            }
            
            # Add cleanup task
            background_tasks.add_task(_cleanup_request_resources, state["request_id"])
            
            logger.info(f"Completion successful for model: {request.model}, duration: {total_duration}ms")
            return response
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Completion failed: {str(e)}", exc_info=True)
            raise HTTPException(status_code=500, detail=str(e))

@completion_router.post("/stream")
async def generate_completion_stream(
    request: GenerateCompletionRequest,
    background_tasks: BackgroundTasks
):
    """
    Stream completions using Server-Sent Events (SSE).
    
    Returns events with types:
    - start: Streaming started
    - token: New token generated
    - progress: Progress updates
    - metadata: Completion metadata
    - error: Error occurred
    - done: Streaming completed
    """
    async with circuit_breaker:
        try:
            logger.info(f"Starting streaming completion for model: {request.model}")
            
            # Prepare streaming state
            state = await prepare_streaming_state(request)
            request_id = state["request_id"]
            
            async def streaming_generator():
                try:
                    async for event in create_streaming_generator(state):
                        yield event
                except Exception as e:
                    error_event = {
                        "event": "error",
                        "data": json.dumps({
                            "error": str(e),
                            "error_type": type(e).__name__,
                            "request_id": request_id,
                            "timestamp": time.time()
                        })
                    }
                    yield f"event: {error_event['event']}\ndata: {error_event['data']}\n\n"
            
            # Add cleanup task
            background_tasks.add_task(_cleanup_request_resources, request_id)
            
            # Return SSE response
            return EventSourceResponse(
                streaming_generator(),
                headers={
                    "Cache-Control": "no-cache",
                    "Connection": "keep-alive",
                    "X-Accel-Buffering": "no",
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Headers": "Cache-Control"
                }
            )
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Streaming completion failed: {str(e)}", exc_info=True)
            raise HTTPException(status_code=500, detail=str(e))

async def _cleanup_request_resources(request_id: str):
    """Background task for cleaning up request resources"""
    try:
        logger.debug(f"Cleaned up resources for request {request_id}")
    except Exception as e:
        logger.warning(f"Cleanup failed for request {request_id}: {e}")

@completion_router.get("/health")
async def health_check():
    """Health check endpoint for monitoring"""
    return {
        "status": "healthy",
        "circuit_breaker_state": circuit_breaker.state,
        "timestamp": time.time()
    }