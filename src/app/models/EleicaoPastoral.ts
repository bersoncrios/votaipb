import { Membro } from "./Membro";
import { CargoPastoral } from "./CargoPastoral";

export type EleicaoPastoral = {
    id: string;
    titulo: string;
    status: 'agendada' | 'em_andamento' | 'finalizada';
    membrosElegiveis: Membro[];
    cargos: CargoPastoral[];
    cargoAbertoId: string | null;
    adminUid: string;
};
