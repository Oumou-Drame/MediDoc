import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Comptes } from './comptes';

describe('Comptes', () => {
  let component: Comptes;
  let fixture: ComponentFixture<Comptes>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Comptes]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Comptes);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
