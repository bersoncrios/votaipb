import { Candidato } from "./Candidato";
import { VotoOficial } from "./VotoOficial";

export type CargoPastoral = {
    id: string;
    titulo: string;
    vagas: number;
    candidatos: Candidato[];
    votos: VotoOficial[];
    status: 'aguardando' | 'em_votacao' | 'finalizado';
    vencedores: Candidato[];
};
