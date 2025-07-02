import api from '../utils/axios';

export interface Persona {
  id: number;
  value: string;
  label: string;
  icon: string; 
}

export const fetchPersonas = async (): Promise<Persona[]> => {
  const response = await api.get<Persona[]>("/personas");
  return response.data;
};