import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InfoPatient } from './info-patient';

describe('InfoPatient', () => {
  let component: InfoPatient;
  let fixture: ComponentFixture<InfoPatient>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InfoPatient]
    })
    .compileComponents();

    fixture = TestBed.createComponent(InfoPatient);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
