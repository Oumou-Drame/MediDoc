import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProfilSignature } from './profil-signature';

describe('ProfilSignature', () => {
  let component: ProfilSignature;
  let fixture: ComponentFixture<ProfilSignature>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProfilSignature]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProfilSignature);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
