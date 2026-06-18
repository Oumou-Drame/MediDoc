import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HistoriqueGlobal } from './historique-global';

describe('HistoriqueGlobal', () => {
  let component: HistoriqueGlobal;
  let fixture: ComponentFixture<HistoriqueGlobal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HistoriqueGlobal]
    })
    .compileComponents();

    fixture = TestBed.createComponent(HistoriqueGlobal);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
