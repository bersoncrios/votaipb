import { Candidato } from "./Candidato";
import { Escrutinio } from "./Escritineo";

export type Cargo = {
  id: string;
  titulo: 'Presidente' | 'Vice-Presidente' | '1º Secretário' | '2º Secretário' | 'Tesoureiro';
  candidatosIniciais: Candidato[];
  escrutinios: Escrutinio[];
  vencedor?: Candidato;
};
