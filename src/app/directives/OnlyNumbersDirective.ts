import { Directive, ElementRef, HostListener, Input } from '@angular/core';

@Directive({
  selector: '[appOnlyNumbers]',
  standalone: true
})
export class OnlyNumbersDirective {
  private regex: RegExp = new RegExp(/^[0-9]*$/g);

  private specialKeys: Array<string> = ['Backspace', 'Tab', 'End', 'Home', 'ArrowLeft', 'ArrowRight', 'Delete', 'Del'];

  constructor(private el: ElementRef) { }

  @HostListener('keydown', ['$event'])
  onKeyDown(event: KeyboardEvent) {
    if (this.specialKeys.indexOf(event.key) !== -1) {
      return;
    }

    if ((event.key === 'a' && (event.ctrlKey || event.metaKey)) ||
      (event.key === 'c' && (event.ctrlKey || event.metaKey)) ||
      (event.key === 'v' && (event.ctrlKey || event.metaKey)) ||
      (event.key === 'x' && (event.ctrlKey || event.metaKey))) {
      return;
    }

    const current: string = this.el.nativeElement.value;
    if (event.key && !String(event.key).match(/^[0-9]$/)) {
      event.preventDefault();
    }
  }

  @HostListener('paste', ['$event'])
  onPaste(event: ClipboardEvent) {
    event.preventDefault();
    const pastedInput: string = event.clipboardData?.getData('text/plain') || '';
    const sanitizedInput = pastedInput.replace(/[^0-9]/g, '');
    document.execCommand('insertText', false, sanitizedInput);
  }

  @HostListener('drop', ['$event'])
  onDrop(event: DragEvent) {
    event.preventDefault();
    const textData = event.dataTransfer?.getData('text') || '';
    const sanitizedInput = textData.replace(/[^0-9]/g, '');
    this.el.nativeElement.focus();
    document.execCommand('insertText', false, sanitizedInput);
  }
}
