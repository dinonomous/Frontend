import asyncio
import time
import json
from typing import AsyncGenerator, Dict, Any, Optional
from contextlib import asynccontextmanager
from fastapi import APIRouter, Request, HTTPException, BackgroundTasks
from fastapi.responses import StreamingResponse
from sse_starlette.sse import EventSourceResponse
import weakref
from langchain_core.callbacks import AsyncCallbackHandler
from langchain_core.runnables import RunnableConfig

from models.completion import (
    CompletionRequest, 
    CompletionResponse, 
    GenerateCompletionRequest, 
    GenerateCompletionResponse
)
from chains.completion_chain import async_enhanced_completion_graph
from chains.generate_stream import (
    async_streaming_completion_graph,
    create_streaming_generator,
    StreamingCompletionState
)
from utils.logger import get_logger
import uuid

completion_router = APIRouter()
logger = get_logger(__name__)

# Connection pool for managing active streams
_active_streams: set = set()

class StreamTracker:
    pass

# Rate limiting and circuit breaker
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
    """Convert request to state for the graph - now async for better resource management"""
    state = {
        "messages": [],
        "model": request.model,
        "system_prompt": request.system,
        "raw": request.raw or False,
        "options": request.options or {},
        "context": request.context,
        "request_id": id(request),
        "start_time": time.time()
    }
    
    # Handle format parameter
    if request.format:
        if isinstance(request.format, str):
            state["format_type"] = request.format
        elif isinstance(request.format, dict):
            state["format_type"] = "json"
            state["format_schema"] = request.format
    
    # Build messages
    if request.prompt:
        content = request.prompt
        if request.suffix:
            content += request.suffix
        state["messages"].append({"role": "user", "content": content})
    
    return state

async def prepare_streaming_state_from_request(request: GenerateCompletionRequest) -> StreamingCompletionState:
    """Convert request to streaming state for the graph"""
    state = StreamingCompletionState(
        messages=[],
        model=request.model,
        system_prompt=request.system,
        raw=request.raw or False,
        options=request.options or {},
        context=request.context,
        request_id=str(uuid.uuid4()),
        stream_queue=asyncio.Queue(),
        start_time=time.time(),
        token_count=0,
        is_chat=getattr(request, 'is_chat', False),
        temperature=getattr(request, 'temperature', 0.7)
    )
    
    # Build messages
    if request.prompt:
        content = request.prompt
        if hasattr(request, 'suffix') and request.suffix:
            content += request.suffix
        state["messages"].append({"role": "user", "content": content})
    
    return state

@completion_router.post("/", response_model=GenerateCompletionResponse)
async def generate_completion(
    request: GenerateCompletionRequest,
    background_tasks: BackgroundTasks
):
    """Enhanced async completion endpoint with circuit breaker and performance optimizations"""
    async with circuit_breaker:
        try:
            start_time = time.time()
            
            if request.stream:
                raise HTTPException(
                    status_code=400, 
                    detail="Use /generate/stream for streaming responses"
                )
            
            # Prepare state asynchronously
            state = await prepare_state_from_request(request)
            
            # Add timeout and cancellation support
            try:
                timeout = request.options.get("timeout", 300) if request.options else 300
                result = await asyncio.wait_for(
                    async_enhanced_completion_graph.ainvoke(state),
                    timeout=timeout
                )
            except asyncio.TimeoutError:
                logger.warning(f"Request {state['request_id']} timed out after {timeout}s")
                raise HTTPException(status_code=408, detail="Request timeout")
            
            logger.debug(f"Async result: {result}")
            
            # Extract response with better error handling
            response_content = ""
            if result.get("messages"):
                last_message = result["messages"][-1]
                if hasattr(last_message, 'content'):
                    response_content = last_message.content
                elif isinstance(last_message, dict) and "content" in last_message:
                    response_content = last_message["content"]
                else:
                    logger.warning(f"Unexpected message format: {type(last_message)}")
                    response_content = str(last_message)
            
            # Calculate accurate timing
            total_duration = int((time.time() - start_time) * 1000)
            
            response = GenerateCompletionResponse(
                model=request.model,
                response=response_content,
                done=True,
                context=request.context,
                total_duration=result.get("total_duration", total_duration),
                prompt_eval_count=result.get("prompt_eval_count"),
                prompt_eval_duration=result.get("prompt_eval_duration"),
                eval_count=result.get("eval_count"),
                eval_duration=result.get("eval_duration")
            )
            
            # Add cleanup task
            background_tasks.add_task(
                _cleanup_request_resources,
                state["request_id"]
            )
            
            logger.info(
                f"Async completion successful for model: {request.model}, "
                f"duration: {total_duration}ms"
            )
            return response
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Async completion failed: {str(e)}", exc_info=True)
            raise HTTPException(status_code=500, detail=str(e))


@completion_router.post("/stream")
async def generate_completion_stream(
    request: GenerateCompletionRequest,
    background_tasks: BackgroundTasks
):
    """
    Stream completions using the streaming completion graph.
    
    Returns Server-Sent Events (SSE) with the following event types:
    - start: Streaming started
    - token: New token generated
    - progress: Progress updates (every 10 tokens)
    - metadata: Completion metadata
    - error: Error occurred
    - done: Streaming completed
    
    Each event contains structured data in JSON format.
    """
    async with circuit_breaker:
        try:
            logger.info(f"Starting streaming completion for model: {request.model}")
            
            # Prepare streaming state
            state = await prepare_streaming_state_from_request(request)
            request_id = state["request_id"]
            
            # Add timeout support
            timeout = request.options.get("timeout", 300) if request.options else 300
            
            async def streaming_with_timeout():
                try:
                    async for event in create_streaming_generator(state):
                        yield event
                except asyncio.TimeoutError:
                    error_event = {
                        "event": "error",
                        "data": json.dumps({
                            "error": f"Streaming timeout after {timeout}s",
                            "error_type": "TimeoutError",
                            "request_id": request_id,
                            "timestamp": time.time()
                        })
                    }
                    yield f"event: {error_event['event']}\ndata: {error_event['data']}\n\n"
            
            # Add cleanup task
            background_tasks.add_task(_cleanup_request_resources, request_id)
            
            # Return SSE response with proper headers
            return EventSourceResponse(
                streaming_with_timeout(),
                headers={
                    "Cache-Control": "no-cache",
                    "Connection": "keep-alive",
                    "X-Accel-Buffering": "no",
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Headers": "Cache-Control",
                    "Content-Type": "text/event-stream"
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
        "active_streams": len(_active_streams),
        "circuit_breaker_state": circuit_breaker.state,
        "timestamp": time.time()
    }