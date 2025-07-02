from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any, Union
from datetime import datetime

class GenerateCompletionRequest(BaseModel):
    model: str
    persona: Optional[str] = None
    query: str
    stream: Optional[bool] = False
    language: Optional[str] = "en"
    chat: Optional[bool] = True
    image: Optional[Union[str, List[str]]] = None
    file: Optional[Union[str, List[str]]] = None
    think: Optional[bool] = False
    keepalive: Optional[Union[str, int]] = None