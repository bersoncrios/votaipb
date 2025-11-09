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
import { MatSelect, MatSelectModule } from '@angular/material/select'; // <-- MUDANÇA: Importa MatSelect
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { OnlyNumbersDirective } from "src/app/directives/OnlyNumbersDirective";
import * as XLSX from 'xlsx';

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

  /**
   *  MÉTODO: Adiciona os candidatos que foram selecionados no mat-select.
   */
  addCandidatosSelecionados(cargoIndex: number, membroIndices: number[] | null, select: MatSelect) {
    if (!membroIndices || membroIndices.length === 0) {
      return;
    }
    this._addCandidatosAoCargo(cargoIndex, membroIndices);

    select.value = null;
  }

  /**
   *  MÉTODO: Adiciona TODOS os membros elegíveis como candidatos a este cargo.
   */
  addAllMembrosAsCandidatos(cargoIndex: number) {
    const todosOsIndices = Array.from(Array(this.membrosElegiveisArr.length).keys());

    this._addCandidatosAoCargo(cargoIndex, todosOsIndices);
  }

  /**
   *  MÉTODO: Helper privado para processar a adição de candidatos, evitando duplicatas.
   */
  private _addCandidatosAoCargo(cargoIndex: number, membroIndices: number[]) {
    let adicionados = 0;
    let duplicados = 0;
    const candidatosArr = this.getCandidatosIniciais(cargoIndex);

    for (const membroIndex of membroIndices) {
      // Validação
      if (membroIndex === undefined || membroIndex === null || membroIndex < 0 || membroIndex >= this.membrosElegiveisArr.length) {
        continue;
      }

      const membroSelecionado = this.membrosElegiveisArr.at(membroIndex).value as Membro;
      const jaExiste = candidatosArr.value.some((c: Candidato) => c.userId === membroSelecionado.id);

      if (jaExiste) {
        duplicados++;
      } else {
        const candidato: Candidato = {
          userId: membroSelecionado.id,
          nome: membroSelecionado.nome
        };
        candidatosArr.push(this.fb.group(candidato));
        adicionados++;
      }
    }

    if (adicionados > 0 && duplicados === 0) {
      this.snackBar.open(`${adicionados} candidato(s) adicionado(s).`, 'OK', { duration: 2000 });
    } else if (adicionados > 0 && duplicados > 0) {
      this.snackBar.open(`${adicionados} adicionado(s). ${duplicados} já existia(m).`, 'OK', { duration: 3000 });
    } else if (adicionados === 0 && duplicados > 0) {
      this.snackBar.open(`${duplicados} candidato(s) selecionado(s) já existia(m).`, 'Fechar', { duration: 3000 });
    } else if (adicionados === 0 && duplicados === 0) {
      this.snackBar.open('Nenhum candidato válido selecionado.', 'Fechar', { duration: 3000 });
    }
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

  async onFileChange(event: any) {
    const target: DataTransfer = <DataTransfer>(event.target);
    if (target.files.length !== 1) {
      this.snackBar.open('Apenas um arquivo pode ser enviado.', 'Fechar', { duration: 3000 });
      return;
    }

    this.isSaving = true;
    const file = target.files[0];
    const fileReader = new FileReader();

    fileReader.onload = (e: any) => {
      try {
        const bstr: string = e.target.result;
        const wb: XLSX.WorkBook = XLSX.read(bstr, { type: 'binary' });

        const wsname: string = wb.SheetNames[0];
        const ws: XLSX.WorkSheet = wb.Sheets[wsname];


        const data: any[] = XLSX.utils.sheet_to_json(ws);

        if (data.length === 0) {
          throw new Error('A planilha está vazia ou em formato incorreto.');
        }

        const keys = Object.keys(data[0]);
        const idKey = keys.find(k => k.trim().toLowerCase() === 'id' || k.trim().toLowerCase() === 'matricula');
        const nomeKey = keys.find(k => k.trim().toLowerCase() === 'nome');

        if (!idKey || !nomeKey) {
          throw new Error("Planilha deve conter colunas 'ID' (ou 'Matricula') e 'Nome'. Verifique os cabeçalhos.");
        }

        let adicionados = 0;
        let duplicados = 0;

        for (const row of data) {
          const id = String(row[idKey]).trim();
          const nome = String(row[nomeKey]).trim();

          if (!id || !nome) {
            console.warn('Linha ignorada (dados faltando):', row);
            continue;
          }

          const jaExiste = this.membrosElegiveisArr.value.some((m: Membro) => m.id === id);
          if (jaExiste) {
            duplicados++;
          } else {
            const novoMembro: Membro = { id, nome };
            this.membrosElegiveisArr.push(this.createMembroGroup(novoMembro));
            adicionados++;
          }
        }

        this.snackBar.open(`Importação concluída: ${adicionados} membros adicionados, ${duplicados} duplicados ignorados.`, 'OK', { duration: 5000 });

      } catch (err: any) {
        console.error(err);
        this.snackBar.open(`Erro ao ler planilha: ${err.message}`, 'Fechar', { duration: 5000 });
      } finally {
        this.isSaving = false;
        event.target.value = '';
      }
    };

    fileReader.readAsBinaryString(file);
  }
}
