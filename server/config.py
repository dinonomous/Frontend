from langchain_ollama.chat_models import ChatOllama
from langchain_ollama import OllamaLLM, OllamaEmbeddings

chat_model = ChatOllama(model="mistral:instruct", temperature=0.7)
completion_model = OllamaLLM(model="phi:latest", temperature=0.7)
embedding_model = OllamaEmbeddings(model="mistral")
