import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HistoriqueTechnicien } from './historique-technicien';

describe('HistoriqueTechnicien', () => {
  let component: HistoriqueTechnicien;
  let fixture: ComponentFixture<HistoriqueTechnicien>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HistoriqueTechnicien]
    })
    .compileComponents();

    fixture = TestBed.createComponent(HistoriqueTechnicien);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
