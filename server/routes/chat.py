from fastapi import APIRouter
from models.chat import ChatRequest, ChatResponse
from chains.chat_chain import chat_graph

chat_router = APIRouter()

@chat_router.post("/", response_model=ChatResponse)
def chat(request: ChatRequest):
    result = chat_graph.invoke({
        "messages": [{"role": "user", "content": request.message}]
    })
    return ChatResponse(response=result["messages"][-1].content)
