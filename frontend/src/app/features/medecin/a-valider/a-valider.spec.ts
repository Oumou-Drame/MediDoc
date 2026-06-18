import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AValider } from './a-valider';

describe('AValider', () => {
  let component: AValider;
  let fixture: ComponentFixture<AValider>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AValider]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AValider);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
