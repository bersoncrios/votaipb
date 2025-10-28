import { Cargo } from "./Cargo";
import { Membro } from "./Membro";

export type Eleicao = {
  id: string;
  titulo: string;
  status: 'agendada' | 'em_andamento' | 'finalizada';
  membrosElegiveis: Membro[];
  cargos: Cargo[];
  cargoAbertoParaVotacao: {
    cargoId: string;
    escrutinioNum: 1 | 2 | 3;
  } | null;
  adminUid: string;
};
