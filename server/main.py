from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes.chat import chat_router
from routes.completion import completion_router
from routes.model_mgmt import model_management

app = FastAPI()

origins = [
    "http://localhost:3000",
    "https://yourfrontend.com",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat_router, prefix="/api/chat")
app.include_router(completion_router, prefix="/api/complete")
app.include_router(model_management, prefix="/api/model")
