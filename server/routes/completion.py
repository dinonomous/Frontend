import time
import json
from typing import AsyncGenerator, Dict, Any
from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import StreamingResponse
from sse_starlette.sse import EventSourceResponse

from models.completion import (
    CompletionRequest, 
    CompletionResponse, 
    GenerateCompletionRequest, 
    GenerateCompletionResponse
)
from chains.completion_chain import completion_graph, enhanced_completion_graph
from utils.logger import get_logger

completion_router = APIRouter()
logger = get_logger(__name__)

def prepare_state_from_request(request: GenerateCompletionRequest) -> Dict[str, Any]:
    """Convert request to state for the graph"""
    state = {
        "messages": [],
        "model": request.model,
        "system_prompt": request.system,
        "raw": request.raw or False,
        "options": request.options,
        "context": request.context
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

@completion_router.post("/generate", response_model=GenerateCompletionResponse)
async def generate_completion(request: GenerateCompletionRequest):
    """Full Ollama-compatible generate endpoint"""
    try:
        start_time = time.time()
        
        if request.stream:
            # For streaming, we need to handle it differently
            raise HTTPException(status_code=400, detail="Use /generate/stream for streaming responses")
        
        # Prepare state
        state = prepare_state_from_request(request)
        
        # Execute the graph
        result = enhanced_completion_graph.invoke(state)
        
        # Extract response
        response_content = ""
        if result.get("messages"):
            last_message = result["messages"][-1]
            if hasattr(last_message, 'content'):
                response_content = last_message.content
            elif isinstance(last_message, dict) and "content" in last_message:
                response_content = last_message["content"]
        
        # Build response
        response = GenerateCompletionResponse(
            model=request.model,
            response=response_content,
            done=True,
            context=request.context,
            total_duration=result.get("total_duration"),
            prompt_eval_count=result.get("prompt_eval_count"),
            prompt_eval_duration=result.get("prompt_eval_duration"),
            eval_count=result.get("eval_count"),
            eval_duration=result.get("eval_duration")
        )
        
        logger.info(f"Generate completion successful for model: {request.model}")
        return response
        
    except Exception as e:
        logger.error(f"Generate completion failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@completion_router.post("/generate/stream")
async def generate_completion_stream(request: GenerateCompletionRequest):
    """Streaming version of generate completion"""
    async def token_stream() -> AsyncGenerator[str, None]:
        try:
            logger.info(f"Streaming completion for model: {request.model}")
            
            # Prepare state
            state = prepare_state_from_request(request)
            
            # For streaming, we'll simulate token-by-token response
            # Note: LangChain's streaming might work differently depending on the model
            accumulated_response = ""
            
            try:
                # Use the enhanced graph with streaming
                for chunk in enhanced_completion_graph.stream(state, stream_mode="messages"):
                    if "messages" in chunk and chunk["messages"]:
                        last_message = chunk["messages"][-1]
                        if hasattr(last_message, 'content'):
                            content = last_message.content
                        elif isinstance(last_message, dict) and "content" in last_message:
                            content = last_message["content"]
                        else:
                            content = str(last_message)
                        
                        # Send incremental content
                        if content != accumulated_response:
                            new_content = content[len(accumulated_response):]
                            accumulated_response = content
                            
                            stream_response = {
                                "model": request.model,
                                "created_at": time.time(),
                                "response": new_content,
                                "done": False
                            }
                            yield f"data: {json.dumps(stream_response)}\n\n"
                
                # Send final completion message
                final_response = {
                    "model": request.model,
                    "created_at": time.time(),
                    "response": "",
                    "done": True
                }
                yield f"data: {json.dumps(final_response)}\n\n"
                
            except Exception as e:
                # If streaming fails, fall back to single response
                logger.warning(f"Streaming failed, falling back to single response: {str(e)}")
                result = enhanced_completion_graph.invoke(state)
                
                response_content = ""
                if result.get("messages"):
                    last_message = result["messages"][-1]
                    if hasattr(last_message, 'content'):
                        response_content = last_message.content
                    elif isinstance(last_message, dict) and "content" in last_message:
                        response_content = last_message["content"]
                
                # Send as single chunk
                stream_response = {
                    "model": request.model,
                    "created_at": time.time(),
                    "response": response_content,
                    "done": True
                }
                yield f"data: {json.dumps(stream_response)}\n\n"
                
        except Exception as e:
            logger.error(f"Stream generation failed: {str(e)}")
            error_response = {
                "error": str(e),
                "done": True
            }
            yield f"data: {json.dumps(error_response)}\n\n"
    
    return EventSourceResponse(token_stream())

# Backward compatibility endpoints
@completion_router.post("/", response_model=CompletionResponse)
def complete(request: CompletionRequest):
    """Backward compatible simple completion endpoint"""
    result = completion_graph.invoke({
        "messages": [{"role": "user", "content": request.prompt}]
    })
    return CompletionResponse(response=result["messages"][-1].content)

@completion_router.post("/stream")
async def complete_stream(request: Request):
    """Backward compatible streaming endpoint"""
    body = await request.json()
    prompt = body.get("prompt")

    async def token_stream() -> AsyncGenerator[str, None]:
        logger.info("Streaming completion for prompt: %s", prompt)
        try:
            for token, meta in completion_graph.stream(
                {"messages": [{"role": "user", "content": prompt}]},
                stream_mode="messages"
            ):
                content = token["messages"][-1]["content"]
                yield f"data: {json.dumps({'token': content})}\n\n"
        except Exception as e:
            logger.error("Streaming failed: %s", str(e))
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return EventSourceResponse(token_stream())