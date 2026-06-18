import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HistoriqueValidations } from './historique-validations';

describe('HistoriqueValidations', () => {
  let component: HistoriqueValidations;
  let fixture: ComponentFixture<HistoriqueValidations>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HistoriqueValidations]
    })
    .compileComponents();

    fixture = TestBed.createComponent(HistoriqueValidations);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
