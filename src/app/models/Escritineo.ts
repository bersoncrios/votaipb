import { Candidato } from "./Candidato";
import { Voto } from "./Voto";

export type Escrutinio = {
  numero: number;
  candidatos: Candidato[];
  votos: Voto[];
  status: 'nao_iniciado' | 'aberto' | 'fechado';
  votosEmBranco?: number;
  votosNulos?: number;
};
