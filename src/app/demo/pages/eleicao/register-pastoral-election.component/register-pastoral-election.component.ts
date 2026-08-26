import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators, FormArray, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { EleicaoPastoralService } from '../../../../services/eleicao-pastoral.service';
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
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { SharedModule } from 'src/app/shared/shared.module';
import { OnlyNumbersDirective } from 'src/app/directives/OnlyNumbersDirective';
import * as XLSX from 'xlsx';

@Component({
    selector: 'app-register-pastoral-election',
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
        MatSnackBarModule,
        OnlyNumbersDirective
    ],
    templateUrl: './register-pastoral-election.component.html',
    styleUrls: ['./register-pastoral-election.component.scss']
})

export class RegisterPastoralElectionComponent implements OnInit {
    private fb = inject(FormBuilder);
    private router = inject(Router);
    private route = inject(ActivatedRoute);
    private eleicaoPastoralService = inject(EleicaoPastoralService);
    private snackBar = inject(MatSnackBar);

    eleicaoForm: FormGroup;
    isSaving = false;
    isEditMode = false;
    eleicaoId: string | null = null;
    selectedCargoIndex = 0;

    constructor() {
        this.eleicaoForm = this.fb.group({
            titulo: ['', Validators.required],
            membrosElegiveis: this.fb.array([], [Validators.required, Validators.minLength(1)]),
            cargos: this.fb.array([], [Validators.required, Validators.minLength(1)])
        });
    }

    ngOnInit() {
        this.eleicaoId = this.route.snapshot.paramMap.get('id');
        if (this.eleicaoId) {
            this.isEditMode = true;
            this.carregarEleicaoParaEdicao(this.eleicaoId);
        } else {
            // Adiciona cargo inicial de Pastor Titular por padrão
            this.addCargo('Pastor Titular');
        }
    }

    carregarEleicaoParaEdicao(id: string) {
        this.eleicaoPastoralService.getEleicaoPastoral(id).subscribe({
            next: (eleicao) => {
                if (!eleicao) {
                    this.snackBar.open('Eleição pastoral não encontrada.', 'Fechar', { duration: 3000 });
                    this.router.navigate(['/eleicoes/pastores/lista']);
                    return;
                }

                if (eleicao.status !== 'agendada' && (eleicao.status as string) !== 'aguardando') {
                    this.snackBar.open('Apenas eleições agendadas ou não iniciadas podem ser editadas.', 'Aviso', { duration: 4000 });
                    this.router.navigate(['/eleicoes/pastores/lista']);
                    return;
                }

                // Preenche Titulo
                this.eleicaoForm.patchValue({ titulo: eleicao.titulo });

                // Preenche Membros Elegíveis
                this.membrosElegiveisArr.clear();
                (eleicao.membrosElegiveis || []).forEach(membro => {
                    this.membrosElegiveisArr.push(this.createMembroGroup(membro));
                });

                // Preenche Cargos Pastorais
                this.cargosArr.clear();
                (eleicao.cargos || []).forEach(cargo => {
                    const cargoFG = this.fb.group({
                        id: [cargo.id || nanoid(8)],
                        titulo: [cargo.titulo, Validators.required],
                        vagas: [cargo.vagas || 1, [Validators.required, Validators.min(1)]],
                        candidatos: this.fb.array([], [Validators.required, Validators.minLength(1)])
                    });

                    const candidatosArr = cargoFG.get('candidatos') as FormArray;
                    (cargo.candidatos || []).forEach(cand => {
                        candidatosArr.push(this.fb.group({
                            userId: [cand.userId, Validators.required],
                            nome: [cand.nome, Validators.required]
                        }));
                    });

                    this.cargosArr.push(cargoFG);
                });

                if (this.cargosArr.length > 0) {
                    this.selectedCargoIndex = 0;
                }
            },
            error: (err) => {
                console.error('Erro ao carregar eleição pastoral:', err);
                this.snackBar.open('Erro ao carregar dados da eleição.', 'Fechar', { duration: 3000 });
            }
        });
    }

    getInitials(name: string): string {
        if (!name) return 'P';
        const parts = name.trim().split(' ');
        if (parts.length >= 2) {
            return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
        }
        return name.slice(0, 2).toUpperCase();
    }

    get membrosElegiveisArr(): FormArray {
        return this.eleicaoForm.get('membrosElegiveis') as FormArray;
    }

    get cargosArr(): FormArray {
        return this.eleicaoForm.get('cargos') as FormArray;
    }

    createMembroGroup(membro: Membro): FormGroup {
        return this.fb.group({
            id: [membro.id, Validators.required],
            nome: [membro.nome, Validators.required]
        });
    }

    createCargoGroup(tituloInicial: string = 'Pastor Titular'): FormGroup {
        return this.fb.group({
            id: [nanoid(8)],
            titulo: [tituloInicial, Validators.required],
            vagas: [1, [Validators.required, Validators.min(1)]],
            candidatos: this.fb.array([], [Validators.required, Validators.minLength(1)])
        });
    }

    addCargo(titulo: string = 'Pastor Auxiliar') {
        const cargoFG = this.createCargoGroup(titulo);
        this.cargosArr.push(cargoFG);
        this.selectedCargoIndex = this.cargosArr.length - 1;
    }

    removeCargo(index: number) {
        const tituloRemovido = this.cargosArr.at(index).value.titulo || 'sem título';
        this.cargosArr.removeAt(index);
        this.snackBar.open(`Cargo ${tituloRemovido} removido.`, 'OK', { duration: 2000 });
        if (this.selectedCargoIndex >= this.cargosArr.length) {
            this.selectedCargoIndex = Math.max(0, this.cargosArr.length - 1);
        }
    }

    getCandidatosDoCargo(cargoIndex: number): FormArray {
        return (this.cargosArr.at(cargoIndex) as FormGroup).get('candidatos') as FormArray;
    }

    // REGRA DE NEGÓCIO: Adiciona Pastor Candidato Individualmente
    addCandidatoPastor(cargoIndex: number, idInput: HTMLInputElement, nomeInput: HTMLInputElement) {
        const userId = idInput.value.trim();
        const nome = nomeInput.value.trim();

        if (!userId || !nome) {
            this.snackBar.open('Preencha o ID e o Nome do Pastor Candidato.', 'Fechar', { duration: 3000 });
            return;
        }

        const candidatosArr = this.getCandidatosDoCargo(cargoIndex);

        // Verifica duplicata no mesmo cargo
        const jaExiste = candidatosArr.value.some((c: Candidato) => c.userId === userId);
        if (jaExiste) {
            this.snackBar.open(`Pastor candidato com ID ${userId} já foi adicionado.`, 'Fechar', { duration: 3000 });
            return;
        }

        // Adiciona Pastor Candidato
        candidatosArr.push(this.fb.group({
            userId: [userId, Validators.required],
            nome: [nome, Validators.required]
        }));

        // Se esse pastor candidato constar na lista de votantes, remove-o automaticamente
        const mIndex = this.membrosElegiveisArr.controls.findIndex(m => m.value.id === userId);
        if (mIndex !== -1) {
            this.membrosElegiveisArr.removeAt(mIndex);
            this.snackBar.open(`Pastor ${nome} foi cadastrado como candidato e desmarcado da lista de votantes.`, 'OK', { duration: 4000 });
        } else {
            this.snackBar.open(`Pastor ${nome} adicionado como candidato.`, 'OK', { duration: 2000 });
        }

        idInput.value = '';
        nomeInput.value = '';
        idInput.focus();
    }

    removeCandidatoPastor(cargoIndex: number, candidatoIndex: number) {
        const candidatosArr = this.getCandidatosDoCargo(cargoIndex);
        const nomeRemovido = candidatosArr.at(candidatoIndex).value.nome;
        candidatosArr.removeAt(candidatoIndex);
        this.snackBar.open(`Pastor ${nomeRemovido} removido da lista de candidatos.`, 'OK', { duration: 2000 });
    }

    addMembro(idInput: HTMLInputElement, nomeInput: HTMLInputElement) {
        const id = idInput.value.trim();
        const nome = nomeInput.value.trim();

        if (id && nome) {
            // Regra: Verifica se o membro a adicionar é um Pastor Candidato
            const ehPastorCandidato = this.cargosArr.controls.some(cargoCtrl => {
                const cArr = (cargoCtrl as FormGroup).get('candidatos') as FormArray;
                return cArr.value.some((c: Candidato) => c.userId === id);
            });

            if (ehPastorCandidato) {
                this.snackBar.open(`O ID ${id} pertence a um Pastor Candidato e não pode votar nesta eleição.`, 'Aviso', { duration: 4000 });
                return;
            }

            const jaExiste = this.membrosElegiveisArr.value.some((m: Membro) => m.id === id);
            if (jaExiste) {
                this.snackBar.open(`Votante com ID ${id} já foi adicionado.`, 'Fechar', { duration: 3000 });
                return;
            }

            const novoMembro: Membro = { id, nome };
            this.membrosElegiveisArr.push(this.createMembroGroup(novoMembro));
            idInput.value = '';
            nomeInput.value = '';
            idInput.focus();
            this.snackBar.open(`Votante ${nome} adicionado.`, 'OK', { duration: 2000 });
        } else {
            this.snackBar.open('Preencha o ID e o Nome do votante.', 'Fechar', { duration: 3000 });
        }
    }

    removeMembro(index: number) {
        const membroRemovido = this.membrosElegiveisArr.at(index).value;
        this.membrosElegiveisArr.removeAt(index);
        this.snackBar.open(`Votante ${membroRemovido.nome} removido.`, 'OK', { duration: 2000 });
    }

    async onSubmit() {
        this.eleicaoForm.markAllAsTouched();

        if (this.eleicaoForm.invalid) {
            this.snackBar.open('Formulário inválido. Verifique os campos e passos marcados.', 'Fechar', { duration: 4000 });
            return;
        }

        const formData = this.eleicaoForm.value;
        const totalVotantes = this.membrosElegiveisArr.length;

        // Validação de Vagas por Votantes
        for (const cargo of formData.cargos) {
            if (cargo.vagas > totalVotantes) {
                this.snackBar.open(`As vagas para ${cargo.titulo} (${cargo.vagas}) não podem exceder o total de votantes (${totalVotantes}).`, 'Fechar', { duration: 5000 });
                return;
            }
            if (!cargo.candidatos || cargo.candidatos.length === 0) {
                this.snackBar.open(`Adicione pelo menos um pastor candidato para o cargo "${cargo.titulo}".`, 'Fechar', { duration: 4000 });
                return;
            }
        }

        this.isSaving = true;

        try {
            if (this.isEditMode && this.eleicaoId) {
                await this.eleicaoPastoralService.updateEleicaoPastoral(
                    this.eleicaoId,
                    formData.titulo,
                    formData.membrosElegiveis,
                    formData.cargos
                );
                this.snackBar.open('Eleição pastoral atualizada com sucesso!', 'OK', { duration: 4000 });
            } else {
                await this.eleicaoPastoralService.createEleicaoPastoral(
                    formData.titulo,
                    formData.membrosElegiveis,
                    formData.cargos
                );
                this.snackBar.open('Eleição pastoral criada com sucesso!', 'OK', { duration: 4000 });
            }

            this.router.navigate(['/dashboard']);
        } catch (e: any) {
            console.error('Erro ao salvar eleição pastoral:', e);
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

                if (data.length === 0) throw new Error('A planilha está vazia.');

                const keys = Object.keys(data[0]);
                const idKey = keys.find(k => k.trim().toLowerCase() === 'id' || k.trim().toLowerCase() === 'matricula');
                const nomeKey = keys.find(k => k.trim().toLowerCase() === 'nome');

                if (!idKey || !nomeKey) throw new Error("Planilha deve conter colunas 'ID' e 'Nome'.");

                let adicionados = 0;
                let duplicados = 0;
                let bloqueadosPastores = 0;

                // Coleta IDs de todos os pastores candidatos
                const pastoresIds = new Set<string>();
                this.cargosArr.controls.forEach(cGroup => {
                    const cArr = (cGroup as FormGroup).get('candidatos') as FormArray;
                    cArr.value.forEach((cand: Candidato) => pastoresIds.add(cand.userId));
                });

                for (const row of data) {
                    const id = String(row[idKey]).trim();
                    const nome = String(row[nomeKey]).trim();

                    if (!id || !nome) continue;

                    if (pastoresIds.has(id)) {
                        bloqueadosPastores++;
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

                this.snackBar.open(`Importação concluída: ${adicionados} votantes adicionados, ${duplicados} duplicados ignorados${bloqueadosPastores > 0 ? `, ${bloqueadosPastores} pastores candidatos ignorados` : ''}.`, 'OK', { duration: 5000 });

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
