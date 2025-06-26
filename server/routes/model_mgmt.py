from fastapi import APIRouter
from models.model_mgmt import (
    LocalModel,
    ListModelsResponse,
    LoadUnloadModelRequest,
    LoadUnloadModelResponse,
    ModelInfoRequest,
    ModelInfoResponse,
)
from chains import model_mgmt_chain

model_management = APIRouter()

@model_management.get("/tags", response_model=ListModelsResponse)
def list_models():
    return model_mgmt_chain.list_models()

@model_management.post("/generate", response_model=LoadUnloadModelResponse)
def generate_model(req: LoadUnloadModelRequest):
    return model_mgmt_chain.load_model(req.model)

@model_management.post("/unload", response_model=LoadUnloadModelResponse)
def unload_model(req: LoadUnloadModelRequest):
    return model_mgmt_chain.unload_model(req.model)

@model_management.post("/show", response_model=ModelInfoResponse)
def show_model(req: ModelInfoRequest):
    return model_mgmt_chain.get_model_info(req.model, req.verbose)
