from pydantic import BaseModel
from typing import List, Dict, Optional, Any

class LocalModelDetails(BaseModel):
    parent_model: str
    format: str
    family: str
    families: List[str]
    parameter_size: str
    quantization_level: str

class LocalModel(BaseModel):
    name: str
    model: str
    modified_at: str
    size: int
    digest: str
    details: LocalModelDetails

class ListModelsResponse(BaseModel):
    models: List[LocalModel]

class LoadUnloadModelRequest(BaseModel):
    model: str

class LoadUnloadModelResponse(BaseModel):
    model: str
    created_at: str
    response: str
    done: bool

class ModelInfoRequest(BaseModel):
    model: str
    verbose: Optional[bool] = False

class ModelInfoResponse(BaseModel):
    modelfile: str
    parameters: str
    template: str
    details: Dict[str, Any]
    model_info: Optional[Dict[str, Any]] = None
