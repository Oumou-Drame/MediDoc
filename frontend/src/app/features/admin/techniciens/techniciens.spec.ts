import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Techniciens } from './techniciens';

describe('Techniciens', () => {
  let component: Techniciens;
  let fixture: ComponentFixture<Techniciens>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Techniciens]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Techniciens);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
