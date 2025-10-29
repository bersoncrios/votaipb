import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators, FormArray, AbstractControl, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
// Ajuste os caminhos para seus serviços e modelos
import { EleicaoAdminService } from '../../../../services/eleicao-admin.service'; // Ajuste o caminho
import { Membro } from '../../../../models/Membro'; // Ajuste o caminho
import { Candidato } from '../../../../models/Candidato'; // Ajuste o caminho
import { Cargo } from '../../../../models/Cargo'; // Ajuste o caminho
import { nanoid } from 'nanoid';

// Imports do Angular Material
import { MatStepperModule } from '@angular/material/stepper';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { OnlyNumbersDirective } from "src/app/directives/OnlyNumbersDirective";

const CARGOS_PERMITIDOS: Cargo['titulo'][] = [
  'Presidente',
  'Vice-Presidente',
  'Secretário-Executivo',
  '1º Secretário',
  '2º Secretário',
  'Tesoureiro'
];

@Component({
  selector: 'app-register-election',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatStepperModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatListModule,
    MatIconModule,
    MatCardModule,
    MatSelectModule,
    MatSnackBarModule,
    OnlyNumbersDirective
],
  templateUrl: './register-election.component.html',
  styleUrls: ['./register-election.component.scss']
})
export class RegisterElectionComponent implements OnInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private eleicaoAdminService = inject(EleicaoAdminService);
  private snackBar = inject(MatSnackBar);

  eleicaoForm: FormGroup;
  cargosDisponiveis = [...CARGOS_PERMITIDOS];
  isSaving = false;

  constructor() {
    this.eleicaoForm = this.fb.group({
      passoTitulo: this.fb.group({
        titulo: ['', Validators.required]
      }),
      passoMembros: this.fb.group({
        membrosElegiveis: this.fb.array([], [Validators.required, Validators.minLength(1)])
      }),
      passoCargos: this.fb.group({
        cargos: this.fb.array([], [Validators.required, Validators.minLength(1)])
      })
    });
  }

  ngOnInit(): void {}

  get formPassoTitulo(): FormGroup {
    return this.eleicaoForm.get('passoTitulo') as FormGroup;
  }

  get formPassoMembros(): FormGroup {
    return this.eleicaoForm.get('passoMembros') as FormGroup;
  }

  get formPassoCargos(): FormGroup {
    return this.eleicaoForm.get('passoCargos') as FormGroup;
  }

  get tituloCtrl() {
    return this.formPassoTitulo.get('titulo');
  }

  get membrosElegiveisArr(): FormArray {
    return this.formPassoMembros.get('membrosElegiveis') as FormArray;
  }

  get cargosArr(): FormArray {
    return this.formPassoCargos.get('cargos') as FormArray;
  }

  private createMembroGroup(membro: Membro): FormGroup {
    return this.fb.group({
      id: [membro.id, Validators.required],
      nome: [membro.nome, Validators.required]
    });
  }

  addMembro(idInput: HTMLInputElement, nomeInput: HTMLInputElement) {
    const id = idInput.value.trim();
    const nome = nomeInput.value.trim();

    if (id && nome) {
      const jaExiste = this.membrosElegiveisArr.value.some((m: Membro) => m.id === id);
      if (jaExiste) {
        this.snackBar.open(`Membro com ID ${id} já foi adicionado.`, 'Fechar', { duration: 3000 });
        return;
      }
      const novoMembro: Membro = { id, nome };
      this.membrosElegiveisArr.push(this.createMembroGroup(novoMembro));
      idInput.value = '';
      nomeInput.value = '';
      idInput.focus();
      this.snackBar.open(`Membro ${nome} adicionado.`, 'OK', { duration: 2000 });
    } else {
      this.snackBar.open('Preencha o ID e o Nome do membro.', 'Fechar', { duration: 3000 });
    }
  }

  removeMembro(index: number) {
    const nomeRemovido = this.membrosElegiveisArr.at(index).value.nome;
    this.membrosElegiveisArr.removeAt(index);
    this.snackBar.open(`Membro ${nomeRemovido} removido.`, 'OK', { duration: 2000 });
  }

  private createCargoGroup(): FormGroup {
    return this.fb.group({
      id: [nanoid(8)],
      titulo: ['', Validators.required],
      candidatosIniciais: this.fb.array([], [Validators.required, Validators.minLength(1)])
    });
  }

  addCargo() {
    const cargoFG = this.createCargoGroup();
    this.cargosArr.push(cargoFG);
  }

  removeCargo(index: number) {
    const tituloRemovido = this.cargosArr.at(index).value.titulo || 'sem título';
    this.cargosArr.removeAt(index);
    this.snackBar.open(`Cargo ${tituloRemovido} removido.`, 'OK', { duration: 2000 });
  }

  getCandidatosIniciais(cargoIndex: number): FormArray {
    return (this.cargosArr.at(cargoIndex) as FormGroup).get('candidatosIniciais') as FormArray;
  }

  addCandidatoAoCargo(cargoIndex: number, membroIndexValue: any) {
    console.log(`Tentando adicionar candidato ao cargo ${cargoIndex}, valor do select:`, membroIndexValue);

    const membroIndex = typeof membroIndexValue === 'string' ? parseInt(membroIndexValue, 10) : membroIndexValue;

    if (membroIndex === undefined || membroIndex === null || isNaN(membroIndex) || membroIndex < 0) {
      console.log('Índice de membro inválido.');
      return;
    }

    if (membroIndex >= this.membrosElegiveisArr.length) {
      console.error(`Índice ${membroIndex} fora dos limites do array de membros.`);
      this.snackBar.open(`Erro: Membro selecionado não encontrado.`, 'Fechar', { duration: 3000 });
      return;
    }

    const membroSelecionado = this.membrosElegiveisArr.at(membroIndex).value as Membro;
    const candidatosArr = this.getCandidatosIniciais(cargoIndex);

    const jaExiste = candidatosArr.value.some((c: Candidato) => c.userId === membroSelecionado.id);
    if (jaExiste) {
      this.snackBar.open(`${membroSelecionado.nome} já é candidato para este cargo.`, 'Fechar', { duration: 3000 });
      return;
    }

    const candidato: Candidato = {
      userId: membroSelecionado.id,
      nome: membroSelecionado.nome
    };

    candidatosArr.push(this.fb.group(candidato));
    console.log('Array de candidatos APÓS push:', candidatosArr.value);
    this.snackBar.open(`${candidato.nome} adicionado como candidato.`, 'OK', { duration: 2000 });
  }

  removeCandidatoDoCargo(cargoIndex: number, candidatoIndex: number) {
    const nomeRemovido = this.getCandidatosIniciais(cargoIndex).at(candidatoIndex).value.nome;
    this.getCandidatosIniciais(cargoIndex).removeAt(candidatoIndex);
    this.snackBar.open(`Candidato ${nomeRemovido} removido.`, 'OK', { duration: 2000 });
  }

  logSelecaoTitulo(cargoIndex: number, valorSelecionado: any) {
    const cargoCtrl = this.cargosArr.at(cargoIndex);
    console.log(`Cargo ${cargoIndex} - Título selecionado:`, valorSelecionado);
    console.log(`Status do controle 'titulo':`, cargoCtrl.get('titulo')?.status);
    console.log(`Erros do controle 'titulo':`, cargoCtrl.get('titulo')?.errors);
    console.log(`Status do FormGroup do Cargo:`, cargoCtrl.status);
  }

  async onSubmit() {
    this.cargosArr.controls.forEach((cargoCtrl, index) => {
      const cargoGroup = cargoCtrl as FormGroup;
      const candidatosArray = cargoGroup.get('candidatosIniciais') as FormArray;
      console.log(
        `Cargo ${index} (${cargoGroup.get('titulo')?.value || 'N/A'}): Titulo(${cargoGroup.get('titulo')?.status}), Candidatos(${candidatosArray.status})`
      );
      if (candidatosArray.invalid) console.log(`  Erros Candidatos Array:`, candidatosArray.errors);
      if (cargoGroup.get('titulo')?.invalid) console.log(`  Erros Titulo:`, cargoGroup.get('titulo')?.errors);
    });

    this.eleicaoForm.markAllAsTouched();

    if (this.eleicaoForm.invalid) {
      this.snackBar.open('Formulário inválido. Verifique os passos e campos marcados.', 'Fechar', { duration: 4000 });
      return;
    }

    this.isSaving = true;

    try {
      const formData = {
        titulo: this.formPassoTitulo.value.titulo,
        membrosElegiveis: this.formPassoMembros.value.membrosElegiveis,
        cargos: this.formPassoCargos.value.cargos
      };

      console.log('Enviando para o service:', formData);
      const novoId = await this.eleicaoAdminService.createEleicao(formData);

      this.snackBar.open(`Eleição "${formData.titulo}" criada com sucesso! Redirecionando...`, 'OK', { duration: 4000 });
      this.router.navigate(['/eleicoes/lista']);
    } catch (e: any) {
      console.error('Erro ao salvar eleição:', e);
      this.snackBar.open(`Ocorreu um erro ao salvar: ${e.message || 'Erro desconhecido'}`, 'Fechar', { duration: 5000 });
    } finally {
      this.isSaving = false;
    }
  }
}
