import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AccesCode } from './acces-code';

describe('AccesCode', () => {
  let component: AccesCode;
  let fixture: ComponentFixture<AccesCode>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AccesCode]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AccesCode);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
