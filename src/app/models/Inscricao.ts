export interface Inscrito {
  id: string;      // O ID que o eleitor digita (CPF, Matrícula, etc.)
  nome: string;    // O Nome que o eleitor digita
  dataRegistro: any; // Timestamp de quando se inscreveu
}

// Define a "Lista" principal que o admin cria
export interface ListaInscricao {
  id: string;          // ID automático do Firebase
  adminUid: string;    // ID do admin que a criou
  titulo: string;      // Ex: "Inscrição Assembleia 2024"
  descricao?: string;  // Opcional
  ativa: boolean;      // Se está aberta ou fechada para inscrições
  criadaEm: any;
  inscritos: Inscrito[]; // O array de pessoas que se inscreveram
}
