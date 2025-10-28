import { Component, OnInit, inject } from '@angular/core';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
  FormArray,
  AbstractControl
} from '@angular/forms';
import { CommonModule } from '@angular/common'; // Se for standalone
import { Router } from '@angular/router';
import { EleicaoAdminService } from '../../../../services/eleicao-admin.service';
import { Candidato } from '../../../../models/Candidato'; // Importe seus tipos
import { Membro } from '../../../../models/Membro'; // Importe seus tipos
import { Cargo } from 'src/app/models/Cargo';
import { nanoid } from 'nanoid';
import { cloneDeep } from 'lodash-es'

// Tipos de cargos permitidos
const CARGOS_PERMITIDOS: Cargo['titulo'][] = [
  'Presidente', 'Vice-Presidente', '1º Secretário', '2º Secretário', 'Tesoureiro'
];

@Component({
    selector: 'app-register-election.component',
  imports: [
    ReactiveFormsModule,
    CommonModule,
  ],
  templateUrl: './register-election.component.html',
  styleUrl: './register-election.component.scss'
})
export class RegisterElectionComponent implements OnInit {

  private fb = inject(FormBuilder);
  private router = inject(Router);
  private eleicaoAdminService = inject(EleicaoAdminService);

  step = 1; // Controla o passo-a-passo (wizard)
  eleicaoForm: FormGroup;

  // Nossos tipos de cargos
  cargosDisponiveis = [...CARGOS_PERMITIDOS];

  constructor() {
    // Inicializa o formulário principal
    this.eleicaoForm = this.fb.group({
      titulo: ['', Validators.required],
      membrosElegiveis: this.fb.array([], [Validators.required, Validators.minLength(1)]),
      cargos: this.fb.array([], [Validators.required, Validators.minLength(1)])
    });
  }

  ngOnInit(): void {
    // Para teste, podemos adicionar o primeiro cargo automaticamente
    this.addCargo();
  }

  // --- Getters para facilitar o acesso aos FormArrays no Template ---
  get membrosElegiveisArr(): FormArray {
    return this.eleicaoForm.get('membrosElegiveis') as FormArray;
  }

  get cargosArr(): FormArray {
    return this.eleicaoForm.get('cargos') as FormArray;
  }

  // --- Lógica de MEMBROS (Step 2) ---

  /**
   * Cria o FormGroup para um Membro
   */
  private createMembroGroup(membro: Membro): FormGroup {
    return this.fb.group({
      id: [membro.id, Validators.required],
      nome: [membro.nome, Validators.required]
    });
  }

  /**
   * Adiciona um membro à lista.
   * (Em um app real, isso viria de um modal de busca,
   * aqui vamos simular com um input simples)
   */
  addMembro(idInput: HTMLInputElement, nomeInput: HTMLInputElement) {
    const id = idInput.value.trim();
    const nome = nomeInput.value.trim();

    if (id && nome) {
      const novoMembro: Membro = { id, nome };
      this.membrosElegiveisArr.push(this.createMembroGroup(novoMembro));
      idInput.value = '';
      nomeInput.value = '';
      idInput.focus();
    }
  }

  removeMembro(index: number) {
    this.membrosElegiveisArr.removeAt(index);
  }

  // --- Lógica de CARGOS (Step 3) ---

  /**
   * Cria o FormGroup para um novo Cargo
   */
  private createCargoGroup(): FormGroup {
    return this.fb.group({
      id: [nanoid(8)], // ID temporário para o form
      titulo: ['', Validators.required],
      candidatosIniciais: this.fb.array([], [Validators.required, Validators.minLength(1)])
    });
  }

  addCargo() {
    const cargoFG = this.createCargoGroup();
    this.cargosArr.push(cargoFG);
  }

  removeCargo(index: number) {
    this.cargosArr.removeAt(index);
    // Opcional: devolve o cargo para a lista de 'cargosDisponiveis'
  }

  // Helper para pegar o FormArray de candidatos de um cargo específico
  getCandidatosIniciais(cargoIndex: number): FormArray {
    return (this.cargosArr.at(cargoIndex) as FormGroup).get('candidatosIniciais') as FormArray;
  }

  /**
   * Adiciona um candidato (que é um Membro) a um cargo
   */
  addCandidatoAoCargo(cargoIndex: number, membro: Membro) {
    const candidatosArr = this.getCandidatosIniciais(cargoIndex);

    // Verifica se já não é candidato
    const jaExiste = candidatosArr.value.some((c: Candidato) => c.userId === membro.id);
    if (jaExiste) {
      alert(`${membro.nome} já é candidato para este cargo.`);
      return;
    }

    const candidato: Candidato = {
      userId: membro.id,
      nome: membro.nome
    };

    candidatosArr.push(this.fb.group(candidato));
  }

  removeCandidatoDoCargo(cargoIndex: number, candidatoIndex: number) {
    this.getCandidatosIniciais(cargoIndex).removeAt(candidatoIndex);
  }

  // --- Lógica do Wizard (Passos) ---

  nextStep() {
    this.step++;
  }

  prevStep() {
    this.step--;
  }

  // --- Submissão ---

  async onSubmit() {
    if (this.eleicaoForm.invalid) {
      alert('Por favor, preencha todos os campos obrigatórios.');
      this.eleicaoForm.markAllAsTouched();
      return;
    }

    try {
      const formData = this.eleicaoForm.value;

      // O service espera 'Omit<Eleicao, 'id' | ...>'
      const dadosParaSalvar = {
        titulo: formData.titulo,
        membrosElegiveis: formData.membrosElegiveis,
        cargos: formData.cargos // O service vai processar e adicionar escrutínios
      };

      console.log('Enviando para o service:', dadosParaSalvar);
      const novoId = await this.eleicaoAdminService.createEleicao(dadosParaSalvar);

      alert(`Eleição "${formData.titulo}" criada com sucesso!`);
      this.router.navigate(['/admin/eleicao', novoId]); // Navega para o painel de gerenciamento

    } catch (e) {
      console.error('Erro ao salvar eleição:', e);
      alert('Ocorreu um erro ao salvar. Verifique o console.');
    }
  }
}
