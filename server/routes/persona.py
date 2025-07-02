from fastapi import APIRouter
from pydantic import BaseModel
from typing import List

persona = APIRouter()

class Persona(BaseModel):
    id: int
    value: str
    label: str
    icon: str 

PERSONAS: List[Persona] = [
    Persona(id=1, value="general", label="General Assistant", icon="User"),
    Persona(id=2, value="developer", label="Software Developer", icon="Code"),
    Persona(id=3, value="business", label="Business Analyst", icon="Briefcase"),
    Persona(id=4, value="teacher", label="Educator", icon="GraduationCap"),
    Persona(id=5, value="doctor", label="Medical Professional", icon="Stethoscope"),
    Persona(id=6, value="designer", label="Creative Designer", icon="Palette"),
    Persona(id=7, value="analyst", label="Data Analyst", icon="Calculator"),
]

@persona.get("/", response_model=List[Persona])
async def get_personas():
    return PERSONAS