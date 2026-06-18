import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SaisieValeurs } from './saisie-valeurs';

describe('SaisieValeurs', () => {
  let component: SaisieValeurs;
  let fixture: ComponentFixture<SaisieValeurs>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SaisieValeurs]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SaisieValeurs);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
