import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HistoriqueDetail } from './historique-detail';

describe('HistoriqueDetail', () => {
  let component: HistoriqueDetail;
  let fixture: ComponentFixture<HistoriqueDetail>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HistoriqueDetail]
    })
    .compileComponents();

    fixture = TestBed.createComponent(HistoriqueDetail);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
