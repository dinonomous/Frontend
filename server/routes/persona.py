from fastapi import APIRouter,  HTTPException
from typing import List
from models.personas import RolePromptManager, PromptPersona

persona = APIRouter()

manager = RolePromptManager()

@persona.get("/", response_model=List[PromptPersona])
async def get_personas():
    return manager.list_personas()

@persona.get("/{persona_id}", response_model=PromptPersona)
async def get_prompt_by_id(persona_id: int):
    try:
        return manager.get_prompt_by_id(persona_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))