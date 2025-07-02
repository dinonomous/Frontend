from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes.generate import completion_router
from routes.model_mgmt import model_management
from routes.persona import persona

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

app.include_router(persona, prefix="/api/personas")
app.include_router(completion_router, prefix="/api/generate")
app.include_router(model_management, prefix="/api/model")
