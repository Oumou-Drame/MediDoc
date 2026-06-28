import { TestBed } from '@angular/core/testing';

import { PatientAccess } from './patient-access-service';

describe('PatientAccess', () => {
  let service: PatientAccess;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PatientAccess);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
