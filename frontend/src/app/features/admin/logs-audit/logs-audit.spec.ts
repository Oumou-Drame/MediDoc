import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LogsAudit } from './logs-audit';

describe('LogsAudit', () => {
  let component: LogsAudit;
  let fixture: ComponentFixture<LogsAudit>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LogsAudit]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LogsAudit);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
