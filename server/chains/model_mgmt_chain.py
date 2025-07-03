import requests
from fastapi import HTTPException
from utils.logger import get_logger

logger = get_logger(__name__)

OLLAMA_BASE = "http://localhost:11434"

def list_models():
    try:
        response = requests.get(f"{OLLAMA_BASE}/api/models/tags")
        response.raise_for_status()
        return response.json()
    except Exception as e:
        logger.exception("Error listing models")
        raise HTTPException(status_code=500, detail=str(e))

def load_model(model: str):
    try:
        logger.info("Loading model: %s", model)
        response = requests.post(f"{OLLAMA_BASE}/api/models/load", json={"model": model})
        response.raise_for_status()
        return response.json()
    except Exception as e:
        logger.exception("Error loading model")
        raise HTTPException(status_code=500, detail=str(e))

def unload_model(model: str):
    try:
        logger.info("Unloading model: %s", model)
        response = requests.post(f"{OLLAMA_BASE}/api/models/unload", json={"model": model})
        response.raise_for_status()
        return response.json()
    except Exception as e:
        logger.exception("Error unloading model")
        raise HTTPException(status_code=500, detail=str(e))

def get_model_info(model: str, verbose: bool = False):
    try:
        logger.info("Getting model info: %s", model)
        response = requests.post(f"{OLLAMA_BASE}/api/models/info", json={"model": model, "verbose": verbose})
        response.raise_for_status()
        return response.json()
    except Exception as e:
        logger.exception("Error fetching model info")
        raise HTTPException(status_code=500, detail=str(e))
