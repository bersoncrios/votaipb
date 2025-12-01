import { Membro } from "./Membro";
import { CargoOficial } from "./CargoOficial";

export type EleicaoOficial = {
    id: string;
    titulo: string;
    status: 'agendada' | 'em_andamento' | 'finalizada';
    membrosElegiveis: Membro[];
    cargos: CargoOficial[];
    cargoAbertoId: string | null;
    adminUid: string;
};
