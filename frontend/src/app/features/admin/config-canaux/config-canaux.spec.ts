import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ConfigCanaux } from './config-canaux';

describe('ConfigCanaux', () => {
  let component: ConfigCanaux;
  let fixture: ComponentFixture<ConfigCanaux>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConfigCanaux]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ConfigCanaux);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
