export interface Inscrito {
  id: string;
  nome: string;
  dataRegistro: any;
}

export interface ListaInscricao {
  id: string;
  adminUid: string;
  titulo: string;
  descricao?: string;
  ativa: boolean;
  criadaEm: any;
  inscritos: Inscrito[];
}
