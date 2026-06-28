import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NouveauResultat } from './nouveau-resultat';

describe('NouveauResultat', () => {
  let component: NouveauResultat;
  let fixture: ComponentFixture<NouveauResultat>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NouveauResultat]
    })
    .compileComponents();

    fixture = TestBed.createComponent(NouveauResultat);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
