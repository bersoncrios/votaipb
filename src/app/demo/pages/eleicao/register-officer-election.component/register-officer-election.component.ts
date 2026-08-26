import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators, FormArray, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
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
    private route = inject(ActivatedRoute);
    private eleicaoOficialService = inject(EleicaoOficialService);
    private snackBar = inject(MatSnackBar);

    eleicaoForm: FormGroup;
    isSaving = false;
    isEditMode = false;
    eleicaoId: string | null = null;

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

    ngOnInit() {
        this.eleicaoId = this.route.snapshot.paramMap.get('id');
        if (this.eleicaoId) {
            this.isEditMode = true;
            this.carregarEleicaoParaEdicao(this.eleicaoId);
        }
    }

    carregarEleicaoParaEdicao(id: string) {
        this.eleicaoOficialService.getEleicaoOficial(id).subscribe({
            next: (eleicao) => {
                if (!eleicao) {
                    this.snackBar.open('Eleição não encontrada.', 'Fechar', { duration: 3000 });
                    this.router.navigate(['/eleicoes/oficiais/gerenciar']);
                    return;
                }

                if (eleicao.status !== 'agendada' && (eleicao.status as string) !== 'aguardando') {
                    this.snackBar.open('Apenas eleições agendadas ou não iniciadas podem ser editadas.', 'Aviso', { duration: 4000 });

                    this.router.navigate(['/eleicoes/oficiais/gerenciar']);
                    return;
                }

                // Preenche Titulo
                this.eleicaoForm.patchValue({ titulo: eleicao.titulo });

                // Preenche Membros Elegíveis
                this.membrosElegiveisArr.clear();
                (eleicao.membrosElegiveis || []).forEach(membro => {
                    this.membrosElegiveisArr.push(this.createMembroGroup(membro));
                });

                // Preenche Cargos (Presbítero e Diácono)
                const presb = eleicao.cargos?.find(c => c.titulo === 'Presbítero');
                const diac = eleicao.cargos?.find(c => c.titulo === 'Diácono');

                if (presb) {
                    this.eleicaoForm.get('presbítero')?.patchValue({
                        ativo: true,
                        vagas: presb.vagas
                    });
                    this.presbiteroCandidatos.clear();
                    (presb.candidatos || []).forEach(cand => {
                        this.presbiteroCandidatos.push(this.fb.group({
                            userId: [cand.userId, Validators.required],
                            nome: [cand.nome, Validators.required]
                        }));
                    });
                }

                if (diac) {
                    this.eleicaoForm.get('diácono')?.patchValue({
                        ativo: true,
                        vagas: diac.vagas
                    });
                    this.diaconoCandidatos.clear();
                    (diac.candidatos || []).forEach(cand => {
                        this.diaconoCandidatos.push(this.fb.group({
                            userId: [cand.userId, Validators.required],
                            nome: [cand.nome, Validators.required]
                        }));
                    });
                }

                this.updateVagasValidators();
            },
            error: (err) => {
                console.error('Erro ao carregar eleição de oficiais:', err);
                this.snackBar.open('Erro ao carregar dados da eleição.', 'Fechar', { duration: 3000 });
            }
        });
    }


    getInitials(name: string): string {
        if (!name) return 'M';
        const parts = name.trim().split(' ');
        if (parts.length >= 2) {
            return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
        }
        return name.slice(0, 2).toUpperCase();
    }


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

    isCandidatoNoOutroCargo(tipo: 'presbítero' | 'diácono', memberId: string): boolean {

        const outroArr = tipo === 'presbítero' ? this.diaconoCandidatos : this.presbiteroCandidatos;
        return outroArr.value.some((c: Candidato) => c.userId === memberId);
    }

    updateVagasValidators() {
        const maxVotantes = Math.max(1, this.membrosElegiveisArr.length);
        const presbVagasCtrl = this.eleicaoForm.get('presbítero.vagas');
        const diacVagasCtrl = this.eleicaoForm.get('diácono.vagas');

        if (presbVagasCtrl) {
            presbVagasCtrl.setValidators([Validators.required, Validators.min(1), Validators.max(maxVotantes)]);
            presbVagasCtrl.updateValueAndValidity();
        }
        if (diacVagasCtrl) {
            diacVagasCtrl.setValidators([Validators.required, Validators.min(1), Validators.max(maxVotantes)]);
            diacVagasCtrl.updateValueAndValidity();
        }
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
            this.updateVagasValidators();
            idInput.value = '';
            nomeInput.value = '';
            idInput.focus();
            this.snackBar.open(`Membro ${nome} adicionado.`, 'OK', { duration: 2000 });
        } else {
            this.snackBar.open('Preencha o ID e o Nome do membro.', 'Fechar', { duration: 3000 });
        }
    }

    removeMembro(index: number) {
        const membroRemovido = this.membrosElegiveisArr.at(index).value;
        this.membrosElegiveisArr.removeAt(index);
        this.updateVagasValidators();

        // Remove do Presbítero se presente
        const pIndex = this.presbiteroCandidatos.controls.findIndex(c => c.value.userId === membroRemovido.id);
        if (pIndex !== -1) this.presbiteroCandidatos.removeAt(pIndex);

        // Remove do Diácono se presente
        const dIndex = this.diaconoCandidatos.controls.findIndex(c => c.value.userId === membroRemovido.id);
        if (dIndex !== -1) this.diaconoCandidatos.removeAt(dIndex);

        this.snackBar.open(`Membro ${membroRemovido.nome} removido.`, 'OK', { duration: 2000 });
    }

    addCandidatosSelecionados(tipo: 'presbítero' | 'diácono', membroIndices: number[] | null, select: MatSelect) {
        if (!membroIndices || membroIndices.length === 0) return;

        const candidatosArr = tipo === 'presbítero' ? this.presbiteroCandidatos : this.diaconoCandidatos;
        const outroTipo = tipo === 'presbítero' ? 'Diácono' : 'Presbítero';
        let adicionados = 0;
        let duplicados = 0;
        let bloqueadosOutroCargo = 0;

        for (const membroIndex of membroIndices) {
            const membroSelecionado = this.membrosElegiveisArr.at(membroIndex).value as Membro;

            // Regra 2: Impedir acumular Presbítero e Diácono
            if (this.isCandidatoNoOutroCargo(tipo, membroSelecionado.id)) {
                bloqueadosOutroCargo++;
                continue;
            }

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

        if (bloqueadosOutroCargo > 0) {
            this.snackBar.open(`${bloqueadosOutroCargo} membro(s) não pode(m) concorrer porque já é(são) candidato(s) a ${outroTipo}.`, 'Aviso', { duration: 4000 });
        } else if (adicionados > 0 && duplicados === 0) {
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
        const outroTipo = tipo === 'presbítero' ? 'Diácono' : 'Presbítero';
        let adicionados = 0;
        let bloqueadosOutroCargo = 0;

        for (const membroIndex of todosOsIndices) {
            const membroSelecionado = this.membrosElegiveisArr.at(membroIndex).value as Membro;

            // Regra 2: Impedir acumular Presbítero e Diácono
            if (this.isCandidatoNoOutroCargo(tipo, membroSelecionado.id)) {
                bloqueadosOutroCargo++;
                continue;
            }

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

        if (bloqueadosOutroCargo > 0) {
            this.snackBar.open(`${adicionados} adicionado(s). ${bloqueadosOutroCargo} ignorado(s) por já concorrer(em) a ${outroTipo}.`, 'OK', { duration: 4000 });
        } else {
            this.snackBar.open(`${adicionados} candidato(s) adicionado(s).`, 'OK', { duration: 2000 });
        }
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
            this.snackBar.open('Formulário inválido. Verifique os campos marcados.', 'Fechar', { duration: 4000 });
            return;
        }

        const totalVotantes = this.membrosElegiveisArr.length;
        const formData = this.eleicaoForm.value;
        const vagasPresb = Number(formData.presbítero?.vagas) || 0;
        const vagasDiac = Number(formData.diácono?.vagas) || 0;

        if (vagasPresb > totalVotantes) {
            this.snackBar.open(`O número de vagas para Presbítero (${vagasPresb}) não pode ser maior que o número de votantes (${totalVotantes}).`, 'Fechar', { duration: 5000 });
            return;
        }
        if (vagasDiac > totalVotantes) {
            this.snackBar.open(`O número de vagas para Diácono (${vagasDiac}) não pode ser maior que o número de votantes (${totalVotantes}).`, 'Fechar', { duration: 5000 });
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

            if (this.isEditMode && this.eleicaoId) {
                await this.eleicaoOficialService.updateEleicaoOficial(
                    this.eleicaoId,
                    formData.titulo,
                    formData.membrosElegiveis,
                    cargos
                );
                this.snackBar.open('Eleição de oficiais atualizada com sucesso!', 'OK', { duration: 4000 });
            } else {
                await this.eleicaoOficialService.createEleicaoOficial(
                    formData.titulo,
                    formData.membrosElegiveis,
                    cargos
                );
                this.snackBar.open('Eleição criada com sucesso!', 'OK', { duration: 4000 });
            }

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

                this.updateVagasValidators();
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
