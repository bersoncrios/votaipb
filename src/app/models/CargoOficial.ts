import { Candidato } from "./Candidato";
import { VotoOficial } from "./VotoOficial";

export type CargoOficial = {
    id: string;
    titulo: 'Presbítero' | 'Diácono';
    vagas: number;
    candidatos: Candidato[];
    votos: VotoOficial[];
    status: 'aguardando' | 'em_votacao' | 'finalizado';
    vencedores: Candidato[];
};
