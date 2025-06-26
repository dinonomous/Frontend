from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any, Union
from datetime import datetime

class GenerateCompletionRequest(BaseModel):
    model: str
    prompt: Optional[str] = None
    suffix: Optional[str] = None
    images: Optional[List[str]] = None
    think: Optional[bool] = False
    format: Optional[Union[str, Dict[str, Any]]] = None
    options: Optional[Dict[str, Any]] = None
    system: Optional[str] = None
    template: Optional[str] = None
    stream: Optional[bool] = False
    raw: Optional[bool] = False
    keep_alive: Optional[Union[str, int]] = None
    context: Optional[List[int]] = None

class GenerateCompletionResponse(BaseModel):
    model: str
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    response: str
    done: bool = True
    context: Optional[List[int]] = None
    total_duration: Optional[int] = None
    load_duration: Optional[int] = None
    prompt_eval_count: Optional[int] = None
    prompt_eval_duration: Optional[int] = None
    eval_count: Optional[int] = None
    eval_duration: Optional[int] = None

# Keep backward compatibility
class CompletionRequest(BaseModel):
    prompt: str

class CompletionResponse(BaseModel):
    response: str