import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators, FormArray, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { EleicaoOficialService } from '../../../../services/eleicao-oficial.service';
import { Membro } from '../../../../models/Membro';
import { Candidato } from '../../../../models/Candidato';
import { nanoid } from 'nanoid';

// Angular Material
import { MatStepperModule } from '@angular/material/stepper';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatTabsModule } from '@angular/material/tabs';
import { MatSelectModule, MatSelect } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { SharedModule } from 'src/app/shared/shared.module';
import * as XLSX from 'xlsx';

@Component({
    selector: 'app-register-officer-election',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        SharedModule,
        MatStepperModule,
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule,
        MatListModule,
        MatIconModule,
        MatCardModule,
        MatSelectModule,
        MatTabsModule,
        MatSnackBarModule
    ],
    templateUrl: './register-officer-election.component.html',
    styleUrls: ['./register-officer-election.component.scss']
})
export class RegisterOfficerElectionComponent implements OnInit {
    private fb = inject(FormBuilder);
    private router = inject(Router);
    private eleicaoOficialService = inject(EleicaoOficialService);
    private snackBar = inject(MatSnackBar);

    eleicaoForm: FormGroup;
    isSaving = false;

    constructor() {
        this.eleicaoForm = this.fb.group({
            titulo: ['', Validators.required],
            membrosElegiveis: this.fb.array([], [Validators.required, Validators.minLength(1)]),
            presbítero: this.fb.group({
                ativo: [true],
                vagas: [1, [Validators.required, Validators.min(1)]],
                candidatos: this.fb.array([])
            }),
            diácono: this.fb.group({
                ativo: [true],
                vagas: [1, [Validators.required, Validators.min(1)]],
                candidatos: this.fb.array([])
            })
        });
    }

    ngOnInit() { }

    get membrosElegiveisArr(): FormArray {
        return this.eleicaoForm.get('membrosElegiveis') as FormArray;
    }

    get presbiteroCandidatos(): FormArray {
        return this.eleicaoForm.get('presbítero.candidatos') as FormArray;
    }

    get diaconoCandidatos(): FormArray {
        return this.eleicaoForm.get('diácono.candidatos') as FormArray;
    }

    createMembroGroup(membro: Membro): FormGroup {
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

    addCandidatosSelecionados(tipo: 'presbítero' | 'diácono', membroIndices: number[] | null, select: MatSelect) {
        if (!membroIndices || membroIndices.length === 0) return;

        const candidatosArr = tipo === 'presbítero' ? this.presbiteroCandidatos : this.diaconoCandidatos;
        let adicionados = 0;
        let duplicados = 0;

        for (const membroIndex of membroIndices) {
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

        select.value = null;

        if (adicionados > 0 && duplicados === 0) {
            this.snackBar.open(`${adicionados} candidato(s) adicionado(s).`, 'OK', { duration: 2000 });
        } else if (adicionados > 0 && duplicados > 0) {
            this.snackBar.open(`${adicionados} adicionado(s). ${duplicados} já existia(m).`, 'OK', { duration: 3000 });
        } else if (duplicados > 0) {
            this.snackBar.open(`${duplicados} candidato(s) selecionado(s) já existia(m).`, 'Fechar', { duration: 3000 });
        }
    }

    addAllMembrosAsCandidatos(tipo: 'presbítero' | 'diácono') {
        const todosOsIndices = Array.from(Array(this.membrosElegiveisArr.length).keys());
        const candidatosArr = tipo === 'presbítero' ? this.presbiteroCandidatos : this.diaconoCandidatos;
        let adicionados = 0;

        for (const membroIndex of todosOsIndices) {
            const membroSelecionado = this.membrosElegiveisArr.at(membroIndex).value as Membro;
            const jaExiste = candidatosArr.value.some((c: Candidato) => c.userId === membroSelecionado.id);

            if (!jaExiste) {
                const candidato: Candidato = {
                    userId: membroSelecionado.id,
                    nome: membroSelecionado.nome
                };
                candidatosArr.push(this.fb.group(candidato));
                adicionados++;
            }
        }

        this.snackBar.open(`${adicionados} candidato(s) adicionado(s).`, 'OK', { duration: 2000 });
    }

    removeCandidato(tipo: 'presbítero' | 'diácono', candidatoIndex: number) {
        const candidatosArr = tipo === 'presbítero' ? this.presbiteroCandidatos : this.diaconoCandidatos;
        const nomeRemovido = candidatosArr.at(candidatoIndex).value.nome;
        candidatosArr.removeAt(candidatoIndex);
        this.snackBar.open(`Candidato ${nomeRemovido} removido.`, 'OK', { duration: 2000 });
    }

    async onSubmit() {
        this.eleicaoForm.markAllAsTouched();

        if (this.eleicaoForm.invalid) {
            this.snackBar.open('Formulário inválido. Verifique os campos.', 'Fechar', { duration: 4000 });
            return;
        }

        this.isSaving = true;

        try {
            const formData = this.eleicaoForm.value;
            const cargos: any[] = [];

            // Adiciona Presbítero se ativo
            if (formData.presbítero.candidatos.length > 0) {
                cargos.push({
                    titulo: 'Presbítero',
                    vagas: formData.presbítero.vagas,
                    candidatos: formData.presbítero.candidatos
                });
            }

            // Adiciona Diácono se ativo
            if (formData.diácono.candidatos.length > 0) {
                cargos.push({
                    titulo: 'Diácono',
                    vagas: formData.diácono.vagas,
                    candidatos: formData.diácono.candidatos
                });
            }

            if (cargos.length === 0) {
                this.snackBar.open('Adicione candidatos a pelo menos um cargo.', 'Fechar', { duration: 4000 });
                this.isSaving = false;
                return;
            }

            await this.eleicaoOficialService.createEleicaoOficial(
                formData.titulo,
                formData.membrosElegiveis,
                cargos
            );

            this.snackBar.open('Eleição criada com sucesso!', 'OK', { duration: 4000 });
            this.router.navigate(['/dashboard']);
        } catch (e: any) {
            console.error('Erro ao salvar eleição:', e);
            this.snackBar.open(`Erro ao salvar: ${e.message || 'Erro desconhecido'}`, 'Fechar', { duration: 5000 });
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
                    throw new Error('A planilha está vazia.');
                }

                const keys = Object.keys(data[0]);
                const idKey = keys.find(k => k.trim().toLowerCase() === 'id' || k.trim().toLowerCase() === 'matricula');
                const nomeKey = keys.find(k => k.trim().toLowerCase() === 'nome');

                if (!idKey || !nomeKey) {
                    throw new Error("Planilha deve conter colunas 'ID' e 'Nome'.");
                }

                let adicionados = 0;
                let duplicados = 0;

                for (const row of data) {
                    const id = String(row[idKey]).trim();
                    const nome = String(row[nomeKey]).trim();

                    if (!id || !nome) continue;

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
                event.target.value = '';
            }
        };

        fileReader.readAsBinaryString(file);
    }
}
