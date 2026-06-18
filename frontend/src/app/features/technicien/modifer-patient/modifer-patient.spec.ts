import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ModiferPatient } from './modifer-patient';

describe('ModiferPatient', () => {
  let component: ModiferPatient;
  let fixture: ComponentFixture<ModiferPatient>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ModiferPatient]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ModiferPatient);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
