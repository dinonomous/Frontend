import asyncio
import time
import json
import re
from typing import Annotated, Dict, Any, Optional, List, AsyncGenerator, Tuple
from typing_extensions import TypedDict
from enum import Enum
from langgraph.graph import StateGraph, START
from langgraph.graph.message import add_messages
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage
from langchain_core.callbacks import AsyncCallbackHandler
from langchain_core.runnables import RunnableConfig
from langchain_core.prompts import PromptTemplate
from config import get_llm_dyn
from utils.logger import get_logger
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass

logger = get_logger(__name__)

# Thread pool for CPU-intensive operations
_thread_pool = ThreadPoolExecutor(max_workers=4, thread_name_prefix="streaming")

class StreamEventType(str, Enum):
    """Unified stream event types"""
    START = "start"
    TOKEN = "token"
    CODE_START = "code_start"
    CODE_TOKEN = "code_token"
    CODE_END = "code_end"
    MARKDOWN_START = "markdown_start"
    MARKDOWN_TOKEN = "markdown_token"
    MARKDOWN_END = "markdown_end"
    TITLE = "title_generated"
    PROGRESS = "progress"
    METADATA = "metadata"
    ERROR = "error"
    DONE = "done"

class StreamEvent(TypedDict):
    event: StreamEventType
    data: Dict[str, Any]
    id: Optional[str]
    retry: Optional[int]

class ContentType(str, Enum):
    CODE = "code"
    MARKDOWN = "markdown"
    TEXT = "text"

@dataclass
class ContentState:
    """Tracks the current state of content parsing"""
    type: ContentType = ContentType.TEXT
    in_code_block: bool = False
    code_language: Optional[str] = None
    code_fence_count: int = 0
    buffer: str = ""
    line_buffer: str = ""
    awaiting_language: bool = False
    markdown_context: bool = False
    

class StreamingCompletionState(TypedDict):
    messages: Annotated[list, add_messages]
    model: str
    system_prompt: Optional[str]
    options: Optional[Dict[str, Any]]
    raw: bool
    context: Optional[List[int]]
    request_id: str
    # Streaming specific
    stream_queue: asyncio.Queue
    start_time: float
    token_count: int
    is_chat: bool
    temperature: Optional[float]
    # Content analysis
    content_state: ContentState

class EnhancedContentAnalyzer:
    """Improved content analyzer with state machine approach"""
    
    # Code fence patterns
    CODE_FENCE_PATTERN = re.compile(r'^```(\w+)?', re.MULTILINE)
    CODE_FENCE_END_PATTERN = re.compile(r'^```\s*$', re.MULTILINE)
    
    # Programming languages (expanded set)
    PROGRAMMING_LANGUAGES = {
        'python', 'py', 'javascript', 'js', 'typescript', 'ts', 'java', 'c', 'cpp', 
        'c++', 'csharp', 'c#', 'cs', 'php', 'ruby', 'rb', 'go', 'rust', 'rs', 
        'swift', 'kotlin', 'kt', 'scala', 'html', 'css', 'scss', 'sass', 'sql', 
        'bash', 'shell', 'sh', 'zsh', 'fish', 'json', 'xml', 'yaml', 'yml',
        'dockerfile', 'docker', 'makefile', 'make', 'r', 'matlab', 'perl', 'pl',
        'lua', 'dart', 'elixir', 'ex', 'haskell', 'hs', 'clojure', 'clj', 'erlang', 
        'erl', 'fsharp', 'f#', 'groovy', 'powershell', 'ps1', 'vim', 'vimscript',
        'latex', 'tex', 'markdown', 'md', 'plaintext', 'text', 'txt', 'ini', 'toml',
        'properties', 'conf', 'config', 'log', 'diff', 'patch'
    }
    
    # Markdown patterns
    MARKDOWN_PATTERNS = {
        'header': re.compile(r'^#{1,6}\s+', re.MULTILINE),
        'list_item': re.compile(r'^[\s]*[-*+]\s+', re.MULTILINE),
        'ordered_list': re.compile(r'^[\s]*\d+\.\s+', re.MULTILINE),
        'bold': re.compile(r'\*\*[^*]+\*\*|__[^_]+__'),
        'italic': re.compile(r'\*[^*]+\*|_[^_]+_'),
        'link': re.compile(r'\[[^\]]*\]\([^)]*\)'),
        'image': re.compile(r'!\[[^\]]*\]\([^)]*\)'),
        'inline_code': re.compile(r'`[^`]+`'),
        'blockquote': re.compile(r'^>\s+', re.MULTILINE),
        'horizontal_rule': re.compile(r'^[-*_]{3,}\s*$', re.MULTILINE),
        'table': re.compile(r'\|.*\|', re.MULTILINE)
    }
    
    @classmethod
    def update_state_with_token(cls, state: ContentState, token: str) -> Tuple[ContentState, StreamEventType]:
        """
        Update content state with new token and determine appropriate event type.
        Returns updated state and the event type for this token.
        """
        # Update buffers
        state.buffer = (state.buffer + token)[-200:]  # Keep larger buffer for context
        state.line_buffer += token
        
        # Handle newlines
        if '\n' in token:
            lines = token.split('\n')
            state.line_buffer = lines[-1]  # Keep only text after last newline
        
        # Check for code fence transitions
        fence_transition = cls._check_code_fence_transition(state, token)
        if fence_transition:
            return state, fence_transition
        
        # Determine current content type and event
        if state.in_code_block:
            # We're inside a code block
            if state.awaiting_language:
                cls._try_extract_language(state)
            
            if state.type == ContentType.CODE:
                return state, StreamEventType.CODE_TOKEN
            else:
                # Code block but not programming language (could be markdown, text, etc.)
                return state, StreamEventType.MARKDOWN_TOKEN
        else:
            # Not in code block, check for markdown elements
            if cls._has_markdown_elements(state.buffer) or state.markdown_context:
                state.markdown_context = True
                return state, StreamEventType.MARKDOWN_TOKEN
            else:
                state.markdown_context = False
                return state, StreamEventType.TOKEN
    
    @classmethod
    def _check_code_fence_transition(cls, state: ContentState, token: str) -> Optional[StreamEventType]:
        """Check if we're transitioning into or out of a code block"""
        
        # Look for triple backticks
        if '```' in token or state.buffer.endswith('```'):
            # Count consecutive backticks in buffer
            backtick_matches = list(re.finditer(r'```', state.buffer))
            
            if not state.in_code_block:
                # Check if we're starting a code block
                # Look for ``` at start of line or after newline
                lines = state.buffer.split('\n')
                current_line = lines[-1].strip()
                
                if current_line.startswith('```') or state.buffer.strip().endswith('```'):
                    state.in_code_block = True
                    state.code_fence_count += 1
                    state.awaiting_language = True
                    state.code_language = None
                    state.type = ContentType.TEXT  # Will be determined after language detection
                    return StreamEventType.CODE_START
            
            else:
                # Check if we're ending a code block
                lines = state.buffer.split('\n')
                if len(lines) >= 2:  # Need at least 2 lines to have opening and closing
                    current_line = lines[-1].strip()
                    if current_line == '```' or (current_line == '' and lines[-2].strip() == '```'):
                        state.in_code_block = False
                        state.code_fence_count = 0
                        state.awaiting_language = False
                        state.code_language = None
                        state.type = ContentType.TEXT
                        state.markdown_context = False
                        return StreamEventType.CODE_END
        
        return None
    
    @classmethod
    def _try_extract_language(cls, state: ContentState) -> None:
        """Try to extract language from the line after code fence"""
        if not state.awaiting_language:
            return
        
        # Look for language specifier in current line
        lines = state.buffer.split('\n')
        if len(lines) == 0:
            return
        
        # Find the line with ```
        fence_line = None
        for line in reversed(lines):
            if line.strip().startswith('```'):
                fence_line = line.strip()
                break
        
        if not fence_line:
            return
        
        # Extract language part
        lang_part = fence_line[3:].strip().lower()
        
        if not lang_part:
            # No language specified, wait for next line or newline
            if '\n' in state.line_buffer:
                # We've moved to next line, assume it's code
                state.type = ContentType.CODE
                state.awaiting_language = False
            return
        
        # Check if it's a programming language
        lang_word = lang_part.split()[0]  # Take first word
        
        if lang_word in cls.PROGRAMMING_LANGUAGES:
            state.code_language = lang_word
            state.type = ContentType.CODE
        else:
            # Not a programming language, might be markdown or other text
            state.type = ContentType.MARKDOWN
        
        state.awaiting_language = False
    
    @classmethod
    def _has_markdown_elements(cls, text: str) -> bool:
        """Check if text contains markdown elements"""
        if not text.strip():
            return False
        
        # Check each markdown pattern
        for pattern_name, pattern in cls.MARKDOWN_PATTERNS.items():
            if pattern.search(text):
                return True
        
        return False

class TitleExtractor:
    """Enhanced title extraction"""
    TITLE_PATTERN = re.compile(r'<TITLE>(.*?)</TITLE>', re.IGNORECASE | re.DOTALL)
    
    @classmethod
    def extract_title(cls, text: str) -> Optional[str]:
        """Extract title from text using <TITLE> markers"""
        match = cls.TITLE_PATTERN.search(text)
        if match:
            title = match.group(1).strip()
            # Clean up title (remove extra whitespace, newlines)
            title = ' '.join(title.split())
            return title if title else None
        return None
    
    @classmethod
    def clean_content(cls, text: str) -> str:
        """Remove title markers from content"""
        return cls.TITLE_PATTERN.sub('', text)

class EnhancedStreamingCallbackHandler(AsyncCallbackHandler):
    """Enhanced callback handler with improved content detection"""
    
    def __init__(self, queue: asyncio.Queue, request_id: str):
        self.q = queue
        self.request_id = request_id
        self.count = 0
        self.start = time.time()
        self.full_content = ""
        self.title_extracted = False
        self.content_state = ContentState()
        self.last_event_type = StreamEventType.TOKEN

    async def on_llm_start(self, *args, **kwargs):
        await self.q.put(StreamEvent(
            event=StreamEventType.START, 
            data={
                "request_id": self.request_id,
                "timestamp": time.time()
            }, 
            id=self.request_id, 
            retry=None
        ))

    async def on_llm_new_token(self, token: str, **kwargs):
        self.count += 1
        self.full_content += token
        
        # Clean token from title markers for output
        clean_token = TitleExtractor.clean_content(token)
        
        # Extract title periodically
        if not self.title_extracted and self.count % 20 == 0:
            title = TitleExtractor.extract_title(self.full_content)
            if title:
                await self.q.put(StreamEvent(
                    event=StreamEventType.TITLE, 
                    data={
                        "title": title,
                        "request_id": self.request_id
                    }, 
                    id=f"{self.request_id}-title", 
                    retry=None
                ))
                self.title_extracted = True
        
        # Update content state and get event type
        self.content_state, event_type = EnhancedContentAnalyzer.update_state_with_token(
            self.content_state, token
        )
        
        # Handle content type transitions
        if event_type != self.last_event_type:
            if event_type == StreamEventType.CODE_START:
                await self.q.put(StreamEvent(
                    event=StreamEventType.CODE_START,
                    data={
                        "request_id": self.request_id, 
                        "timestamp": time.time()
                    },
                    id=f"{self.request_id}-code-start-{self.count}",
                    retry=None
                ))
            elif event_type == StreamEventType.CODE_END:
                await self.q.put(StreamEvent(
                    event=StreamEventType.CODE_END,
                    data={
                        "request_id": self.request_id, 
                        "timestamp": time.time()
                    },
                    id=f"{self.request_id}-code-end-{self.count}",
                    retry=None
                ))
            elif event_type == StreamEventType.MARKDOWN_TOKEN and self.last_event_type == StreamEventType.TOKEN:
                await self.q.put(StreamEvent(
                    event=StreamEventType.MARKDOWN_START,
                    data={
                        "request_id": self.request_id, 
                        "timestamp": time.time()
                    },
                    id=f"{self.request_id}-markdown-start-{self.count}",
                    retry=None
                ))
            elif event_type == StreamEventType.TOKEN and self.last_event_type == StreamEventType.MARKDOWN_TOKEN:
                await self.q.put(StreamEvent(
                    event=StreamEventType.MARKDOWN_END,
                    data={
                        "request_id": self.request_id, 
                        "timestamp": time.time()
                    },
                    id=f"{self.request_id}-markdown-end-{self.count}",
                    retry=None
                ))
        
        # Prepare event data
        data = {
            "token": clean_token,
            "count": self.count,
            "request_id": self.request_id
        }
        
        # Add language info for code tokens
        if event_type == StreamEventType.CODE_TOKEN and self.content_state.code_language:
            data["language"] = self.content_state.code_language
        
        # Add content type context
        data["content_type"] = self.content_state.type.value
        data["in_code_block"] = self.content_state.in_code_block
        
        # Send the token event
        await self.q.put(StreamEvent(
            event=event_type,
            data=data,
            id=f"{self.request_id}-{self.count}",
            retry=None
        ))
        
        self.last_event_type = event_type
        
        # Progress updates
        if self.count % 25 == 0:
            await self.q.put(StreamEvent(
                event=StreamEventType.PROGRESS, 
                data={
                    "count": self.count,
                    "elapsed": time.time() - self.start,
                    "request_id": self.request_id,
                    "content_stats": {
                        "current_type": self.content_state.type.value,
                        "in_code_block": self.content_state.in_code_block,
                        "language": self.content_state.code_language
                    }
                }, 
                id=f"{self.request_id}-prog-{self.count}", 
                retry=None
            ))

    async def on_llm_end(self, *args, **kwargs):
        # Handle final content state transitions
        if self.content_state.in_code_block:
            await self.q.put(StreamEvent(
                event=StreamEventType.CODE_END,
                data={
                    "request_id": self.request_id, 
                    "timestamp": time.time(),
                    "note": "End of stream while in code block"
                },
                id=f"{self.request_id}-code-end-final",
                retry=None
            ))
        elif self.last_event_type == StreamEventType.MARKDOWN_TOKEN:
            await self.q.put(StreamEvent(
                event=StreamEventType.MARKDOWN_END,
                data={
                    "request_id": self.request_id, 
                    "timestamp": time.time(),
                    "note": "End of stream while in markdown"
                },
                id=f"{self.request_id}-markdown-end-final",
                retry=None
            ))
        
        # Final title extraction
        if not self.title_extracted:
            title = TitleExtractor.extract_title(self.full_content)
            if title:
                await self.q.put(StreamEvent(
                    event=StreamEventType.TITLE, 
                    data={
                        "title": title,
                        "request_id": self.request_id
                    }, 
                    id=f"{self.request_id}-title-final", 
                    retry=None
                ))
        
        # Metadata
        await self.q.put(StreamEvent(
            event=StreamEventType.METADATA, 
            data={
                "tokens": self.count,
                "duration": int((time.time() - self.start) * 1000),
                "request_id": self.request_id,
                "final_content_stats": {
                    "type": self.content_state.type.value,
                    "language": self.content_state.code_language,
                    "had_code_blocks": self.content_state.code_fence_count > 0,
                    "had_markdown": self.content_state.markdown_context
                }
            }, 
            id=f"{self.request_id}-meta", 
            retry=None
        ))
        
        # Done
        await self.q.put(StreamEvent(
            event=StreamEventType.DONE, 
            data={
                "request_id": self.request_id
            }, 
            id=f"{self.request_id}-done", 
            retry=None
        ))

    async def on_llm_error(self, error, **kwargs):
        await self.q.put(StreamEvent(
            event=StreamEventType.ERROR, 
            data={
                "error": str(error),
                "request_id": self.request_id
            }, 
            id=f"{self.request_id}-err", 
            retry=None
        ))

# Semaphore for controlling concurrent streaming operations
_streaming_semaphore = asyncio.Semaphore(5)

async def prepare_streaming_messages_node(state: StreamingCompletionState) -> Dict[str, Any]:
    """Prepare messages for streaming completion"""
    messages = []
    
    # Add system message with title instruction
    system_content = state.get("system_prompt", "")
    title_instruction = "\n\nIf generating substantial content, you may optionally include a brief title using <TITLE>Your Title Here</TITLE> tags at the beginning of your response."
    
    if system_content:
        system_content += title_instruction
    else:
        system_content = "You are a helpful assistant." + title_instruction
    
    messages.append(SystemMessage(content=system_content))
    
    # Process messages
    processed_messages = []
    for msg in state["messages"]:
        if isinstance(msg, dict):
            if msg["role"] == "user":
                processed_messages.append(HumanMessage(content=msg["content"]))
            elif msg["role"] == "assistant":
                processed_messages.append(AIMessage(content=msg["content"]))
        else:
            processed_messages.append(msg)
    
    messages.extend(processed_messages)
    
    # Initialize streaming queue if not present
    if "stream_queue" not in state:
        state["stream_queue"] = asyncio.Queue()
    
    # Initialize content state
    if "content_state" not in state:
        state["content_state"] = ContentState()
    
    return {
        "messages": messages,
        "start_time": time.time(),
        "token_count": 0,
        "content_state": ContentState()
    }

async def streaming_completion_node(state: StreamingCompletionState) -> Dict[str, Any]:
    """Enhanced streaming completion node"""
    request_id = state["request_id"]
    
    async with _streaming_semaphore:
        try:
            logger.debug(f"Starting enhanced streaming completion for request {request_id}")
            
            # Get the streaming model
            model = get_llm_dyn(
                model_name=state["model"],
                chat=state.get("is_chat", False),
                require_stream=True,
                temp=state.get("temperature", 0.7)
            )
            
            # Apply options
            if state.get("options"):
                options = state["options"]
                model_kwargs = {"stream": True}
                
                if "temperature" in options:
                    model_kwargs["temperature"] = options["temperature"]
                if "top_p" in options:
                    model_kwargs["top_p"] = options["top_p"]
                if "top_k" in options:
                    model_kwargs["top_k"] = options["top_k"]
                if "num_predict" in options:
                    model_kwargs["max_tokens"] = options["num_predict"]
                
                model = model.bind(**model_kwargs)
            else:
                model = model.bind(stream=True)
            
            # Create enhanced streaming callback handler
            callback_handler = EnhancedStreamingCallbackHandler(
                queue=state["stream_queue"],
                request_id=request_id
            )
            
            # Configure with callback
            config = RunnableConfig(callbacks=[callback_handler])
            
            # Start the streaming task
            if state.get("raw"):
                prompt = state["messages"][-1].content if state["messages"] else ""
                streaming_task = asyncio.create_task(
                    model.ainvoke(prompt, config=config)
                )
            else:
                messages = state["messages"]
                streaming_task = asyncio.create_task(
                    model.ainvoke(messages, config=config)
                )
            
            # Wait for completion
            await streaming_task
            
            logger.info(f"Enhanced streaming completion for {request_id} completed successfully")
            
            return {
                "streaming_task": streaming_task,
                "completed": True
            }
            
        except asyncio.CancelledError:
            logger.info(f"Streaming completion cancelled for request {request_id}")
            cancel_event = StreamEvent(
                event=StreamEventType.ERROR,
                data={
                    "error": "Request cancelled",
                    "error_type": "CancelledError",
                    "request_id": request_id,
                    "timestamp": time.time()
                },
                id=f"{request_id}-cancelled"
            )
            await state["stream_queue"].put(cancel_event)
            raise
        except Exception as e:
            logger.error(f"Enhanced streaming completion failed for {request_id}: {str(e)}", exc_info=True)
            error_event = StreamEvent(
                event=StreamEventType.ERROR,
                data={
                    "error": str(e),
                    "error_type": type(e).__name__,
                    "request_id": request_id,
                    "timestamp": time.time()
                },
                id=f"{request_id}-error"
            )
            await state["stream_queue"].put(error_event)
            raise

# Build the enhanced streaming graph
streaming_graph_builder = StateGraph(StreamingCompletionState)

streaming_graph_builder.add_node("prepare_streaming", prepare_streaming_messages_node)
streaming_graph_builder.add_node("stream_complete", streaming_completion_node)

streaming_graph_builder.add_edge(START, "prepare_streaming")
streaming_graph_builder.add_edge("prepare_streaming", "stream_complete")

# Compile the streaming graph
async_streaming_completion_graph = streaming_graph_builder.compile()

def format_sse_payload(event: StreamEvent) -> str:
    """Format event for Server-Sent Events"""
    return json.dumps({
        "id": event.get("id"),
        "event": event["event"],
        **event["data"],
    }, separators=(',', ':'))

async def create_streaming_generator(
    state: StreamingCompletionState
) -> AsyncGenerator[str, None]:
    """Create async generator for enhanced streaming events"""
    try:
        # Start the streaming graph
        streaming_task = asyncio.create_task(
            async_streaming_completion_graph.ainvoke(state)
        )
        
        # Process events from the queue
        while True:
            try:
                # Wait for next event with timeout
                event = await asyncio.wait_for(
                    state["stream_queue"].get(),
                    timeout=30.0
                )
                
                # Format and yield the event
                sse_event = format_sse_payload(event)
                yield sse_event
                
                # Break on done event
                if event["event"] == StreamEventType.DONE:
                    break
                    
                # Break on error event
                if event["event"] == StreamEventType.ERROR:
                    break
                    
            except asyncio.TimeoutError:
                timeout_event = StreamEvent(
                    event=StreamEventType.ERROR,
                    data={
                        "error": "Streaming timeout",
                        "error_type": "TimeoutError",
                        "request_id": state["request_id"],
                        "timestamp": time.time()
                    },
                    id=f"{state['request_id']}-timeout"
                )
                yield format_sse_payload(timeout_event)
                break
                
    except Exception as e:
        logger.error(f"Error in enhanced streaming generator: {str(e)}", exc_info=True)
        error_event = StreamEvent(
            event=StreamEventType.ERROR,
            data={
                "error": str(e),
                "error_type": type(e).__name__,
                "request_id": state["request_id"],
                "timestamp": time.time()
            },
            id=f"{state['request_id']}-generator-error"
        )
        yield format_sse_payload(error_event)
    finally:
        # Ensure streaming task is properly cleaned up
        if 'streaming_task' in locals() and not streaming_task.done():
            streaming_task.cancel()
            try:
                await streaming_task
            except asyncio.CancelledError:
                pass

# Cleanup function
async def cleanup_streaming_resources():
    """Clean up streaming resources on shutdown"""
    _thread_pool.shutdown(wait=True)
    logger.info("Enhanced streaming completion resources cleaned up")