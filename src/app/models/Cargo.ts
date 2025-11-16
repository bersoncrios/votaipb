import { Candidato } from "./Candidato";
import { Escrutinio } from "./Escritineo";

export type CargoStatus =
  | 'aguardando'
  | 'em_votacao'
  | 'pendente_confirmacao'
  | 'pendente_desempate'
  | 'finalizado';

export type Cargo = {
  id: string;
  titulo: 'Presidente' | 'Vice-Presidente' | 'Secretário-Executivo' | '1º Secretário' | '2º Secretário' | 'Tesoureiro';
  candidatosIniciais: Candidato[];
  escrutinios: Escrutinio[];
  status: CargoStatus;
  vencedor: Candidato | null;
  candidatosEmpatados?: Candidato[];
};
