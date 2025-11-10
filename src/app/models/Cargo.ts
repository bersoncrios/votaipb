import { Candidato } from "./Candidato";
import { Escrutinio } from "./Escritineo"; // <-- Corrigi o nome do arquivo aqui (era Escritineo)

/**
 * Define os possíveis status de um cargo durante o processo eleitoral.
 * - aguardando: Pronto para iniciar o 1º escrutínio, ou aguardando o próximo.
 * - em_votacao: Um escrutínio está aberto e recebendo votos.
 * - pendente_confirmacao: Um vencedor foi apurado e aguarda aceite ou declínio.
 * - finalizado: O vencedor aceitou, ou a votação terminou sem vencedor.
 */
export type CargoStatus =
  | 'aguardando'
  | 'em_votacao'
  | 'pendente_confirmacao'
  | 'finalizado';

export type Cargo = {
  id: string;
  titulo: 'Presidente' | 'Vice-Presidente' | 'Secretário-Executivo' | '1º Secretário' | '2º Secretário' | 'Tesoureiro';
  candidatosIniciais: Candidato[];
  escrutinios: Escrutinio[];

  /**
   * O status atual do processo de votação para este cargo.
   */
  status: CargoStatus;

  /**
   * Armazena o vencedor (provisório ou final).
   * É 'null' até que um vencedor seja apurado.
   */
  vencedor: Candidato | null;
};
