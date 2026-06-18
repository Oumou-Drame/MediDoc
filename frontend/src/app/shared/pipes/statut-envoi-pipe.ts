import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'statutEnvoi'
})
export class StatutEnvoiPipe implements PipeTransform {

  transform(value: unknown, ...args: unknown[]): unknown {
    return null;
  }

}
