import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AccessPatient } from './access-patient';

describe('AccessPatient', () => {
  let component: AccessPatient;
  let fixture: ComponentFixture<AccessPatient>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AccessPatient]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AccessPatient);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
