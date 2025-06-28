from fastapi import HTTPException
from langchain_ollama.chat_models import ChatOllama
from langchain_ollama import OllamaLLM
from functools import lru_cache
import logging
from typing import Union, Optional
from pydantic import BaseModel

logger = logging.getLogger(__name__)

class LLMConfig(BaseModel):
    """Configuration for LLM initialization"""
    model_name: str
    chat: bool = False
    require_stream: bool = False
    temperature: float = 0.7
    max_tokens: Optional[int] = None
    top_p: Optional[float] = None
    top_k: Optional[int] = None
    timeout: Optional[float] = 30.0
    base_url: Optional[str] = None

@lru_cache(maxsize=32)
def get_llm_cached(
    model_name: str,
    chat: bool = False,
    require_stream: bool = False,
    temperature: float = 0.7,
    max_tokens: Optional[int] = None,
    top_p: Optional[float] = None,
    top_k: Optional[int] = None,
    timeout: float = 30.0,
    base_url: Optional[str] = None,
) -> Union[ChatOllama, OllamaLLM]:
    """
    Cached LLM factory function with improved error handling and configuration.
    
    Args:
        model_name: Name of the Ollama model
        chat: Whether to use chat interface (ChatOllama vs OllamaLLM)
        require_stream: Whether streaming is required
        temperature: Sampling temperature (0.0 to 1.0)
        max_tokens: Maximum tokens to generate
        top_p: Nucleus sampling parameter
        top_k: Top-k sampling parameter
        timeout: Request timeout in seconds
        base_url: Custom Ollama server URL
    
    Returns:
        Configured LLM instance
        
    Raises:
        HTTPException: If model loading or configuration fails
    """

    common_params = {
        "model": model_name,
        "temperature": temperature,
    }
    
    if max_tokens is not None:
        common_params["num_predict"] = max_tokens
    if top_p is not None:
        common_params["top_p"] = top_p
    if top_k is not None:
        common_params["top_k"] = top_k
    if timeout is not None:
        common_params["timeout"] = timeout
    if base_url is not None:
        common_params["base_url"] = base_url
    
    llm = None

    if chat:
        try:
            logger.info(f"Initializing ChatOllama with model: {model_name}")
            llm = ChatOllama(**common_params)

            try:
                llm.invoke("test")
            except Exception as test_e:
                logger.warning(f"ChatOllama test failed for {model_name}: {test_e}. Falling back to OllamaLLM")
                chat = False
                llm = None
                
        except Exception as e:
            logger.warning(f"Failed to initialize ChatOllama for {model_name}: {e}. Falling back to OllamaLLM")
            chat = False
    
    if not chat:
        try:
            logger.info(f"Initializing OllamaLLM with model: {model_name}")
            llm = OllamaLLM(**common_params)
        except Exception as e:
            logger.error(f"Failed to initialize OllamaLLM for {model_name}: {e}")
            raise HTTPException(
                status_code=400,
                detail=f"Failed to load model '{model_name}': {str(e)}. "
                       f"Please ensure the model is available in Ollama."
            )
    
    if require_stream:
        try:
            logger.info(f"Enabling streaming for model: {model_name}")
            if hasattr(llm, 'bind'):
                llm = llm.bind(stream=True)
            else:
                llm.stream = True
                
        except Exception as e:
            logger.error(f"Failed to enable streaming for {model_name}: {e}")
            raise HTTPException(
                status_code=400,
                detail=f"Model '{model_name}' does not support streaming. "
                       f"Please choose a different model or disable streaming. Error: {str(e)}"
            )
    
    logger.info(f"Successfully initialized {'Chat' if chat else ''}LLM for model: {model_name}")
    return llm


def get_llm_dyn(
    model_name: str,
    chat: bool = False,
    require_stream: bool = False,
    temp: float = 0.7,
    **kwargs
) -> Union[ChatOllama, OllamaLLM]:
    """
    Dynamic LLM factory function (wrapper around cached version).
    
    This function maintains backward compatibility while providing access
    to the improved cached implementation.
    """
    if temp is not None and not 0.0 <= temp <= 1.0:
        raise HTTPException(
            status_code=400,
            detail=f"Temperature must be between 0.0 and 1.0, got: {temp}"
        )
    
    if not model_name or not model_name.strip():
        raise HTTPException(
            status_code=400,
            detail="Model name cannot be empty"
        )
    
    return get_llm_cached(
        model_name=model_name.strip(),
        chat=chat,
        require_stream=require_stream,
        temperature=temp,
        **kwargs
    )


def get_llm_with_config(config: LLMConfig) -> Union[ChatOllama, OllamaLLM]:
    """
    Create LLM instance from configuration object.
    
    Args:
        config: LLMConfig instance with all parameters
        
    Returns:
        Configured LLM instance
    """
    return get_llm_cached(
        model_name=config.model_name,
        chat=config.chat,
        require_stream=config.require_stream,
        temperature=config.temperature,
        max_tokens=config.max_tokens,
        top_p=config.top_p,
        top_k=config.top_k,
        timeout=config.timeout,
        base_url=config.base_url,
    )


def clear_llm_cache():
    """Clear the LLM cache to free up memory."""
    get_llm_cached.cache_clear()
    logger.info("LLM cache cleared")


def get_cache_info():
    """Get information about the current cache state."""
    return get_llm_cached.cache_info()


# Example usage and testing
async def test_model_availability(model_name: str) -> bool:
    """
    Test if a model is available and working.
    
    Args:
        model_name: Name of the model to test
        
    Returns:
        True if model is available and working, False otherwise
    """
    try:
        llm = get_llm_dyn(model_name=model_name, chat=False)
        result = llm.invoke("Hello")
        return bool(result)
    except Exception as e:
        logger.error(f"Model {model_name} is not available: {e}")        
        return False